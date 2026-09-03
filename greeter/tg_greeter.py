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

BASE_DIR = Path(__file__).resolve().parent
MESSAGE_PATH = Path(os.getenv("GREETER_MESSAGE_PATH", BASE_DIR / "message.txt"))
SESSION_PATH = Path(os.getenv("GREETER_SESSION", "/session/tg_greeter"))

CRM_URL = os.getenv("CRM_BASE_URL", "http://backend:3000").rstrip("/")
CRM_TOKEN = os.getenv("CRM_LEAD_TOKEN", "")

API_ID = int(os.getenv("TG_API_ID", "0"))
API_HASH = os.getenv("TG_API_HASH", "")

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
# Telethon на INFO печатает служебное каждые несколько секунд — лишний шум.
logging.getLogger("telethon").setLevel(logging.WARNING)


class Fatal(Exception):
    """Настройки неверны — работать нельзя, перезапуск не поможет."""


def load_message() -> str:
    if not MESSAGE_PATH.exists():
        raise Fatal(f"нет файла {MESSAGE_PATH}")
    text = MESSAGE_PATH.read_text(encoding="utf-8").strip()
    if not text:
        raise Fatal(f"{MESSAGE_PATH} пуст")
    return text


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
        response = await self._client.get(
            "/order-photo/greeting/pending", params={"limit": limit}
        )
        response.raise_for_status()
        return response.json().get("items", [])

    async def mark(self, order_id: str, status: str) -> None:
        response = await self._client.post(
            "/order-photo/greeting/mark", json={"id": order_id, "status": status}
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
    template = load_message()
    if not API_ID or not API_HASH:
        raise Fatal("TG_API_ID / TG_API_HASH не заданы")

    crm = Crm()
    client = TelegramClient(str(SESSION_PATH), API_ID, API_HASH)
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
                text = render(template, item.get("name"), item["numberOrder"])

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
