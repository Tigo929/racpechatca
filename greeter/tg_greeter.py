# -*- coding: utf-8 -*-
"""
Первое сообщение клиенту, оставившему заявку на сайте с телеграмом.

Зачем отдельный процесс. Бот Telegram написать первым не может: площадка
разрешает ему отвечать только тем, кто сам начал диалог. У заявки с сайта
такого диалога нет — есть только никнейм, введённый руками. Написать первым
может лишь живой аккаунт, а его сессия боту не отдаётся.

Как работает: раз в несколько секунд спрашивает у CRM очередь
(`/order-photo/greeting/pending`), пишет каждому и возвращает итог
(`/order-photo/greeting/mark`). Состояние живёт в CRM, а не здесь:
перезапуск контейнера ничего не теряет и никому не пишет дважды.

Что этот процесс НЕ делает: не хранит заказы, не знает телефонов и сумм,
не рассылает ничего массово. Одна заявка — одно сообщение.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import sys
from pathlib import Path

import httpx
from telethon import TelegramClient
from telethon.errors import (
    FloodWaitError,
    PeerFloodError,
    RPCError,
    UserIsBlockedError,
    UserPrivacyRestrictedError,
    UsernameInvalidError,
    UsernameNotOccupiedError,
)

from greeting_text import render
from proxy_config import describe, parse_proxy
from signing import sign

BASE_DIR = Path(__file__).resolve().parent
MESSAGE_DIR = Path(os.getenv("GREETER_MESSAGE_DIR", BASE_DIR))
SESSION_PATH = Path(os.getenv("GREETER_SESSION", "/session/tg_greeter"))

CRM_URL = os.getenv("CRM_BASE_URL", "http://backend:3000").rstrip("/")
CRM_TOKEN = os.getenv("CRM_LEAD_TOKEN", "")
#: Секрет подписи тела — тот же, которым подписывает сайт.
CRM_SIGNING_SECRET = os.getenv("CRM_LEAD_SIGNING_SECRET", "")

API_ID = int(os.getenv("TG_API_ID", "0"))
API_HASH = os.getenv("TG_API_HASH", "")
#: Тот же прокси, через который ходит бот CRM: напрямую Telegram
#: с этого сервера недоступен.
PROXY_URL = os.getenv("TELEGRAM_PROXY_URL", "")

#: Как часто спрашивать очередь.
#:
#: Пять секунд, а не «раз в минуту»: человек только что нажал «отправить»
#: и смотрит в экран. Сообщение через полчаса он прочтёт уже как рассылку,
#: а не как ответ на своё действие. Запрос идёт к соседнему контейнеру
#: по внутренней сети — стоит он практически ничего.
POLL_SECONDS = float(os.getenv("GREETER_POLL_SECONDS", "5"))
#: Пауза между сообщениями внутри одной пачки.
SEND_DELAY = float(os.getenv("GREETER_SEND_DELAY", "25"))
SEND_JITTER = float(os.getenv("GREETER_SEND_JITTER", "15"))
#: Сколько ждать после PeerFlood, прежде чем пробовать снова.
PEER_FLOOD_PAUSE = float(os.getenv("GREETER_PEER_FLOOD_PAUSE", "21600"))
#: Дольше этого FloodWait не пережидаем — отдаём заказ как flood.
MAX_FLOOD_WAIT = float(os.getenv("GREETER_MAX_FLOOD_WAIT", "600"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("greeter")
# Telethon и httpx на INFO печатают по строке на каждое действие. При опросе
# раз в пять секунд это семнадцать тысяч строк в сутки — в них тонет
# единственное, ради чего журнал и нужен: кому написали и с каким итогом.
for noisy in ("telethon", "httpx", "httpcore"):
    logging.getLogger(noisy).setLevel(logging.WARNING)


class Fatal(Exception):
    """Настройки неверны — работать нельзя, перезапуск не поможет."""


def load_templates() -> dict[str, str]:
    """
    Тексты по направлениям.

    У фотопечати, холста и футболки разный следующий шаг: у одних нужны
    фотографии, у других макет, у третьих — показать кадрирование. Одно
    сообщение на всех заставляло бы человека догадываться, что от него
    хотят, а догадываться он не станет — просто не ответит.

    Общий message.txt — запасной: на случай направления, под которое
    текста ещё не написали. Без него новая категория молча осталась бы
    без приветствия.
    """
    templates: dict[str, str] = {}
    for key, filename in (
        ("PHOTO", "message-photo.txt"),
        ("CANVAS", "message-canvas.txt"),
        ("TSHIRT", "message-tshirt.txt"),
        ("", "message.txt"),
    ):
        path = MESSAGE_DIR / filename
        if path.exists():
            text = path.read_text(encoding="utf-8").strip()
            if text:
                templates[key] = text

    if "" not in templates:
        raise Fatal(f"нет запасного текста {MESSAGE_DIR / 'message.txt'}")
    return templates


class Crm:
    """Очередь и отметки. Ошибки сети не роняют процесс — просто ждём."""

    def __init__(self) -> None:
        if not CRM_TOKEN:
            raise Fatal("CRM_LEAD_TOKEN не задан")
        self._client = httpx.AsyncClient(
            base_url=CRM_URL,
            headers={"Authorization": f"Bearer {CRM_TOKEN}"},
            timeout=15,
        )

    async def pending(self, limit: int = 10) -> list[dict]:
        # У GET тела нет, но подпись всё равно нужна: в строгом режиме
        # сервер отбивает неподписанный запрос независимо от метода.
        response = await self._client.get(
            "/order-photo/greeting/pending",
            params={"limit": limit},
            headers=sign(CRM_SIGNING_SECRET, ""),
        )
        response.raise_for_status()
        return response.json().get("items", [])

    async def mark(self, order_id: str, status: str) -> None:
        # Тело сериализуем сами и его же подписываем: если отдать json=
        # библиотеке, она может расставить пробелы иначе, и подпись
        # перестанет совпадать с тем, что дойдёт до сервера.
        body = json.dumps({"id": order_id, "status": status}, separators=(",", ":"))
        response = await self._client.post(
            "/order-photo/greeting/mark",
            content=body,
            headers={
                "Content-Type": "application/json",
                **sign(CRM_SIGNING_SECRET, body),
            },
        )
        response.raise_for_status()

    async def close(self) -> None:
        await self._client.aclose()


async def send_one(client: TelegramClient, username: str, text: str) -> str:
    """
    Одно сообщение. Возвращает итог из закрытого списка, который знает CRM.

    Все отказы, кроме PeerFlood, закрывают заказ: писать человеку, который
    запретил сообщения от незнакомых, второй раз бессмысленно, а очередь
    от таких заказов надо чистить, иначе она встанет колом.
    """
    try:
        entity = await client.get_entity(username)
    except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
        return "not_found"
    except FloodWaitError as exc:
        if exc.seconds > MAX_FLOOD_WAIT:
            return "flood"
        await asyncio.sleep(exc.seconds + 1)
        return "flood"

    try:
        await client.send_message(entity, text, link_preview=False)
        return "sent"
    except UserPrivacyRestrictedError:
        return "privacy"
    except UserIsBlockedError:
        return "blocked"
    except PeerFloodError:
        raise
    except FloodWaitError as exc:
        if exc.seconds > MAX_FLOOD_WAIT:
            return "flood"
        await asyncio.sleep(exc.seconds + 1)
        try:
            await client.send_message(entity, text, link_preview=False)
            return "sent"
        except RPCError:
            return "error"
    except RPCError as exc:
        log.warning("  отказ Telegram: %s", type(exc).__name__)
        return "error"


async def main() -> int:
    templates = load_templates()
    if not API_ID or not API_HASH:
        raise Fatal("TG_API_ID / TG_API_HASH не заданы")

    crm = Crm()
    client = TelegramClient(
        str(SESSION_PATH), API_ID, API_HASH, proxy=parse_proxy(PROXY_URL)
    )
    log.info("Соединение: %s", describe(PROXY_URL))
    await client.connect()

    if not await client.is_user_authorized():
        raise Fatal(
            f"сессия {SESSION_PATH} не авторизована — войдите один раз "
            "локально и положите файл сессии в том"
        )

    me = await client.get_me()
    log.info("Аккаунт: %s [id %s]", me.username or me.first_name, me.id)
    log.info("CRM: %s", CRM_URL)
    log.info("Пауза между сообщениями: %.0f–%.0f с", SEND_DELAY, SEND_DELAY + SEND_JITTER)
    log.info("Тексты: %s", ", ".join(sorted(k or "общий" for k in templates)))
    log.info("Жду заявки...")

    try:
        while True:
            try:
                queue = await crm.pending()
            except (httpx.HTTPError, OSError) as exc:
                # CRM перезапускается или сеть моргнула — не повод падать.
                log.warning("CRM недоступна (%s), жду", type(exc).__name__)
                await asyncio.sleep(POLL_SECONDS)
                continue

            if not queue:
                await asyncio.sleep(POLL_SECONDS)
                continue

            log.info("В очереди: %d", len(queue))
            for index, item in enumerate(queue):
                username = item["username"]
                # Нет текста под направление — берём общий, а не пропускаем:
                # молчание хуже неточной формулировки.
                template = templates.get(item.get("category", ""), templates[""])
                text = render(
                    template,
                    item.get("name"),
                    item["numberOrder"],
                    item.get("items"),
                    item.get("total"),
                    item.get("deliveryMethod"),
                    item.get("deliveryCost"),
                )

                try:
                    status = await send_one(client, username, text)
                except PeerFloodError:
                    # Telegram ограничил массовые действия. Продолжать —
                    # значит продлить ограничение. Заказ не помечаем:
                    # он останется в очереди и уйдёт после паузы.
                    log.error(
                        "PeerFlood: аккаунт ограничен. Пауза %.0f ч.",
                        PEER_FLOOD_PAUSE / 3600,
                    )
                    await asyncio.sleep(PEER_FLOOD_PAUSE)
                    break

                try:
                    await crm.mark(item["id"], status)
                except (httpx.HTTPError, OSError):
                    # Сообщение ушло, а отметка нет. Хуже всего — написать
                    # второй раз, поэтому пробуем ещё раз сразу же.
                    log.warning("Отметка не прошла, повторяю")
                    await asyncio.sleep(2)
                    try:
                        await crm.mark(item["id"], status)
                    except (httpx.HTTPError, OSError):
                        log.error(
                            "Заказ %s: отметка не сохранена — возможен повтор",
                            item["numberOrder"],
                        )

                log.info("  %s  @%s  %s", item["numberOrder"], username, status)

                if index < len(queue) - 1:
                    await asyncio.sleep(SEND_DELAY + random.uniform(0, SEND_JITTER))
    finally:
        await crm.close()
        await client.disconnect()

    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except Fatal as exc:
        log.error("Не запускается: %s", exc)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(0)
