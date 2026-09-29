"""Положить текст в поле ввода чата клиента — не отправляя.

Зачем отдельно от приветствий. Приветствие уходит само: бот написать
первым не может, а живой аккаунт может. Подтверждение заказа — другое
дело: отправлять его должен человек, когда клиент ответил и состав заказа
окончателен. Раньше менеджер копировал текст из карточки, переключался
в Telegram, вставлял и отправлял. Теперь текст ложится в строку ввода сам,
а нажатие «Отправить» остаётся за человеком.

Черновик Telegram синхронизируется между устройствами: положенный здесь
текст менеджер видит и на телефоне, и на компьютере.

Ничего не отправляет. Единственный вызов к Telegram — SaveDraftRequest.
"""
from __future__ import annotations

import json
import logging

import httpx
from telethon.errors import (
    FloodWaitError,
    RPCError,
    UserPrivacyRestrictedError,
    UsernameInvalidError,
    UsernameNotOccupiedError,
)
from telethon.tl.functions.messages import SaveDraftRequest

from signing import sign

log = logging.getLogger("greeter.drafts")
PREFIX = "/order-photo"


class DraftQueue:
    """Очередь черновиков: спросить у CRM, положить, отчитаться."""

    def __init__(self, http: httpx.AsyncClient, secret: str):
        self.http = http
        self.secret = secret
        # Очередь опрашивается каждые несколько секунд. Жаловаться на
        # недоступность при каждом опросе — это тысячи одинаковых строк
        # в журнале за сутки, в которых тонет всё остальное. Пишем один
        # раз при переходе «работало → сломалось» и один раз обратно.
        self._unavailable = False

    async def pending(self, limit: int = 5) -> list[dict]:
        # У GET тела нет, но подпись всё равно нужна: в строгом режиме
        # сервер отбивает неподписанный запрос независимо от метода.
        # Без неё очередь молча отвечает 401 и выглядит пустой.
        response = await self.http.get(
            PREFIX + "/draft/pending",
            params={"limit": limit},
            headers=sign(self.secret, ""),
        )
        response.raise_for_status()
        return response.json().get("items", [])

    async def mark(self, order_id: str, status: str) -> None:
        body = json.dumps({"id": order_id, "status": status}, separators=(",", ":"))
        response = await self.http.post(
            PREFIX + "/draft/mark",
            content=body,
            headers={"Content-Type": "application/json", **sign(self.secret, body)},
        )
        response.raise_for_status()

    async def process_one(self, client) -> bool:
        """Взять один черновик и положить. True — что-то сделали."""
        try:
            items = await self.pending(limit=1)
        except (httpx.HTTPError, OSError, ValueError) as exc:
            if not self._unavailable:
                self._unavailable = True
                log.warning(
                    "Очередь черновиков недоступна (%s) — молчу до восстановления",
                    type(exc).__name__,
                )
            return False
        if self._unavailable:
            self._unavailable = False
            log.info("Очередь черновиков снова отвечает")
        if not items:
            return False

        item = items[0]
        status = await save_draft(client, item["username"], item["text"])
        log.info(
            "Черновик заказа %s для @%s: %s",
            item.get("numberOrder", item["id"]),
            item["username"],
            status,
        )
        try:
            await self.mark(item["id"], status)
        except (httpx.HTTPError, OSError):
            # Отметку потеряли — CRM отдаст ту же строку снова. Повторно
            # положенный черновик просто перезапишет сам себя: вреда нет.
            log.warning("Не удалось отметить черновик заказа %s", item["id"])
        return True


async def save_draft(client, username: str, text: str) -> str:
    """Положить черновик. Итог — из закрытого списка, который знает CRM."""
    try:
        entity = await client.get_entity(username)
    except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
        return "not_found"
    except FloodWaitError:
        return "error"

    try:
        # no_webpage: ссылка в тексте не должна тянуть предпросмотр —
        # менеджер увидит в поле ввода ровно то, что собрала карточка.
        await client(SaveDraftRequest(peer=entity, message=text, no_webpage=True))
        return "saved"
    except UserPrivacyRestrictedError:
        return "privacy"
    except RPCError as exc:
        log.warning("  отказ Telegram: %s", type(exc).__name__)
        return "error"
