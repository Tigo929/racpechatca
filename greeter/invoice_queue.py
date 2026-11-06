"""Счёт клиенту, который сказал «да».

Клиент ответил согласием — CRM перевела заявку в заказ и положила сюда
готовое подтверждение: состав, сумма, реквизиты. Отправляем тем же живым
аккаунтом, что здоровался: разговор уже идёт, и ответить в него можно
без человека.

Текст собирает CRM — тот же, что менеджер копирует из карточки кнопкой
«Подтверждение». Воркер ничего не сочиняет: в сообщении деньги, и две
сборки одного письма разошлись бы при первой правке.

Неудача ничего не ломает: заказ уже «Новый», владельцу уходит сообщение
с причиной, и подтверждение он отправит руками.
"""
from __future__ import annotations

import asyncio
import json
import logging

import httpx
from telethon.errors import (
    FloodWaitError,
    PeerFloodError,
    RPCError,
    UserIsBlockedError,
    UserPrivacyRestrictedError,
    UsernameInvalidError,
    UsernameNotOccupiedError,
)

from signing import sign

log = logging.getLogger("greeter.invoices")
PREFIX = "/order-photo"

# Дольше этого не ждём: счёт срочный, но держать процесс в сне полчаса
# означает не отправить и всё остальное.
MAX_FLOOD_WAIT = 300


class InvoiceQueue:
    """Очередь счетов: спросить у CRM, отправить, отчитаться."""

    def __init__(self, http: httpx.AsyncClient, secret: str):
        self.http = http
        self.secret = secret
        self._unavailable = False

    async def pending(self, limit: int = 1) -> list[dict]:
        # Подпись нужна и у GET: иначе в строгом режиме очередь молча
        # выглядит пустой.
        response = await self.http.get(
            PREFIX + "/invoice/pending",
            params={"limit": limit},
            headers=sign(self.secret, ""),
        )
        response.raise_for_status()
        return response.json().get("items", [])

    async def mark(self, order_id: str, status: str) -> None:
        body = json.dumps({"id": order_id, "status": status}, separators=(",", ":"))
        response = await self.http.post(
            PREFIX + "/invoice/mark",
            content=body,
            headers={"Content-Type": "application/json", **sign(self.secret, body)},
        )
        response.raise_for_status()

    async def process_one(self, client) -> bool:
        """Взять один счёт и отправить. True — что-то сделали."""
        try:
            items = await self.pending(limit=1)
        except (httpx.HTTPError, OSError, ValueError) as exc:
            if not self._unavailable:
                self._unavailable = True
                log.warning(
                    "Очередь счетов недоступна (%s) — молчу до восстановления",
                    type(exc).__name__,
                )
            return False
        if self._unavailable:
            self._unavailable = False
            log.info("Очередь счетов снова отвечает")
        if not items:
            return False

        item = items[0]
        text = (item.get("text") or "").strip()
        number = item.get("numberOrder", item["id"])
        if not text:
            # Текст собирает CRM. Пустой означает рассогласование версий —
            # выдумывать счёт на деньги нельзя ни при каких условиях.
            log.warning("Заказ %s: CRM не прислала текст счёта — отдаю человеку", number)
            await self._mark_quietly(item["id"], "error")
            return True

        status = await send_invoice(client, item["username"], text)
        log.info("Счёт по заказу %s для @%s: %s", number, item["username"], status)
        await self._mark_quietly(item["id"], status)
        return True

    async def _mark_quietly(self, order_id: str, status: str) -> None:
        try:
            await self.mark(order_id, status)
        except (httpx.HTTPError, OSError):
            # Отметку потеряли — CRM отдаст заказ снова, и клиент получит
            # счёт дважды. Неприятно, но лучше, чем молча не отправить:
            # повтор заметен, а тишина — нет.
            log.warning("Не удалось отметить счёт по заказу %s", order_id)


async def send_invoice(client, username: str, text: str) -> str:
    """Отправить счёт. Итог — из закрытого списка, который знает CRM."""
    try:
        entity = await client.get_entity(username)
    except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
        return "not_found"
    except FloodWaitError:
        return "flood"

    try:
        # Без предпросмотра: в тексте может быть ссылка, и картинка под
        # счётом превращает деловое сообщение в рекламное.
        await client.send_message(entity, text, link_preview=False)
        return "sent"
    except UserPrivacyRestrictedError:
        return "privacy"
    except UserIsBlockedError:
        return "blocked"
    except PeerFloodError:
        # Общее ограничение аккаунта: сдаёмся до следующего круга, но
        # отдаём «flood» — заказ вернётся в очередь, а не пропадёт.
        return "flood"
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
