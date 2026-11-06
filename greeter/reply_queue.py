"""Ответ клиента на приветствие — прочитать и отдать CRM.

Единственное место, где этот аккаунт читает переписку, а не пишет в неё.
Зачем: приветствие уходит само, а дальше всё делал человек — увидеть ответ,
отправить подтверждение с суммой, перевести заявку в заказ. Клиент в этот
момент готов платить, и ждать менеджера ему незачем.

Что читаем. Только диалоги, которые CRM назвала сама: заявка с сайта,
приветствие ушло, ответа ещё нет. Только сообщения клиента и только те,
что пришли после приветствия. Первый такой ответ отдаём в CRM и больше
к этому диалогу не возвращаемся — CRM перестаёт отдавать заказ в очередь.

Чего здесь нет: решения. Согласие это или разговор, решает CRM одним
правилом на весь проект. Воркер не должен знать, что «да» означает счёт.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx
from telethon.errors import (
    FloodWaitError,
    RPCError,
    UsernameInvalidError,
    UsernameNotOccupiedError,
)

from signing import sign

log = logging.getLogger("greeter.replies")
PREFIX = "/order-photo"

# Сколько последних сообщений диалога смотрим. Ответ на приветствие лежит
# у самого верха; глубже — переписка, которая нас не касается.
HISTORY_DEPTH = 20

# Вложение без подписи: текста нет, но ответ был. Отдаём маркер — CRM
# не признает его согласием и позовёт человека, а он увидит, что клиент
# откликнулся, и не будет ждать впустую.
ATTACHMENT_MARK = "[вложение без текста]"


class ReplyQueue:
    """Очередь чтения: спросить у CRM, прочитать диалог, отдать ответ."""

    def __init__(self, http: httpx.AsyncClient, secret: str):
        self.http = http
        self.secret = secret
        # Жаловаться на недоступность CRM при каждом опросе — тысячи
        # одинаковых строк за сутки. Пишем на переходах.
        self._unavailable = False

    async def pending(self, limit: int = 5) -> list[dict]:
        # Подпись нужна и у GET: в строгом режиме сервер отбивает
        # неподписанный запрос независимо от метода.
        response = await self.http.get(
            PREFIX + "/reply/pending",
            params={"limit": limit},
            headers=sign(self.secret, ""),
        )
        response.raise_for_status()
        return response.json().get("items", [])

    async def report(self, order_id: str, text: str) -> dict:
        body = json.dumps({"id": order_id, "text": text}, separators=(",", ":"))
        response = await self.http.post(
            PREFIX + "/reply",
            content=body,
            headers={"Content-Type": "application/json", **sign(self.secret, body)},
        )
        response.raise_for_status()
        return response.json()

    async def process_one(self, client) -> bool:
        """Проверить ожидающие диалоги. True — что-то нашли и отдали."""
        try:
            items = await self.pending()
        except (httpx.HTTPError, OSError, ValueError) as exc:
            if not self._unavailable:
                self._unavailable = True
                log.warning(
                    "Очередь ответов недоступна (%s) — молчу до восстановления",
                    type(exc).__name__,
                )
            return False
        if self._unavailable:
            self._unavailable = False
            log.info("Очередь ответов снова отвечает")
        if not items:
            return False

        found = False
        for item in items:
            text = await read_reply(client, item["username"], item["greetedAt"])
            if not text:
                continue
            number = item.get("numberOrder", item["id"])
            try:
                result = await self.report(item["id"], text)
            except (httpx.HTTPError, OSError):
                # Не отдали — CRM вернёт заказ в очередь, и мы прочитаем
                # тот же ответ снова. Повторная отдача безопасна: CRM
                # принимает ответ один раз.
                log.warning("Не удалось отдать ответ по заказу %s", number)
                continue
            found = True
            log.info(
                "Заказ %s: клиент ответил «%s» — согласие: %s",
                number,
                text[:60],
                "да" if result.get("confirmed") else "нет",
            )
        return found


async def read_reply(client, username: str, greeted_at: str) -> str | None:
    """Первый ответ клиента после приветствия. None — клиент молчит."""
    greeted = parse_time(greeted_at)
    if greeted is None:
        return None

    try:
        entity = await client.get_entity(username)
    except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
        # Ник сменился или исчез — приветствие уже ушло, а читать нечего.
        return None
    except FloodWaitError:
        return None

    try:
        messages = await client.get_messages(entity, limit=HISTORY_DEPTH)
    except (FloodWaitError, RPCError) as exc:
        log.warning("  не прочитать диалог @%s: %s", username, type(exc).__name__)
        return None

    # get_messages отдаёт от новых к старым. Нужен самый ранний ответ после
    # приветствия — то, чем человек откликнулся, а не последняя реплика.
    first: str | None = None
    for message in messages:
        if getattr(message, "out", False):
            continue  # наши собственные сообщения
        when = getattr(message, "date", None)
        if when is None or when <= greeted:
            continue
        text = (getattr(message, "message", "") or "").strip()
        first = text or ATTACHMENT_MARK
    return first


def parse_time(value: str) -> datetime | None:
    """ISO-время из CRM в datetime с зоной. None — разобрать не вышло."""
    try:
        parsed = datetime.fromisoformat((value or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    # Без зоны сравнение с датой сообщения Telegram упало бы с ошибкой.
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
