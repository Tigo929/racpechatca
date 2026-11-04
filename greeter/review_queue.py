"""Просьба об отзыве — клиенту, сама.

Зачем отдельная очередь. Приветствие пишут человеку, который ещё ничего не
спрашивал: там первое сообщение, и его нельзя отправить ботом. Просьба об
отзыве — другое: диалог уже есть, клиент сам написал нам в Telegram (мы об
этом просим в разговоре на площадке), и ответить в него можно без человека.

Раньше просьбу отправлял владелец руками: CRM присылала ему текст и ссылку
на диалог. Для заказа с площадки это и была вся автоматизация — в чат
кабинета из фона не напишешь. Теперь, если Telegram покупателя записан
в заказе, сообщение уходит отсюда, а владельцу приходит только отчёт.

Текст собирает CRM: тот же самый она показывает владельцу, когда отправлять
приходится руками. Две сборки одного текста разошлись бы при первой правке.

Чего здесь нет: чата площадки. Переписка там модерируется, и рассылка из
фона — путь к блокировке продавца.
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

log = logging.getLogger("greeter.reviews")
PREFIX = "/order-photo"

# Дольше этого не ждём: отзыв не срочный, а держать процесс в сне полчаса
# означает не отправить и всё остальное.
MAX_FLOOD_WAIT = 300


class ReviewQueue:
    """Очередь просьб об отзыве: спросить у CRM, отправить, отчитаться."""

    def __init__(self, http: httpx.AsyncClient, secret: str):
        self.http = http
        self.secret = secret
        # Жаловаться на недоступность CRM при каждом опросе — это тысячи
        # одинаковых строк за сутки. Пишем на переходах «работало →
        # сломалось» и обратно.
        self._unavailable = False

    async def pending(self, limit: int = 1) -> list[dict]:
        # Подпись нужна и у GET: в строгом режиме сервер отбивает
        # неподписанный запрос независимо от метода, и очередь без неё
        # молча выглядит пустой.
        response = await self.http.get(
            PREFIX + "/review/pending",
            params={"limit": limit},
            headers=sign(self.secret, ""),
        )
        response.raise_for_status()
        return response.json().get("items", [])

    async def mark(self, order_id: str, status: str) -> None:
        body = json.dumps({"id": order_id, "status": status}, separators=(",", ":"))
        response = await self.http.post(
            PREFIX + "/review/mark",
            content=body,
            headers={"Content-Type": "application/json", **sign(self.secret, body)},
        )
        response.raise_for_status()

    async def process_one(self, client) -> bool:
        """Взять одну просьбу и отправить. True — что-то сделали."""
        try:
            items = await self.pending(limit=1)
        except (httpx.HTTPError, OSError, ValueError) as exc:
            if not self._unavailable:
                self._unavailable = True
                log.warning(
                    "Очередь отзывов недоступна (%s) — молчу до восстановления",
                    type(exc).__name__,
                )
            return False
        if self._unavailable:
            self._unavailable = False
            log.info("Очередь отзывов снова отвечает")
        if not items:
            return False

        item = items[0]
        text = (item.get("text") or "").strip()
        if not text:
            # Текст собирает CRM. Пустой означает рассогласование версий —
            # писать клиенту отсебятину о отзыве хуже, чем не писать:
            # просьбу отправит владелец, ему напомнят.
            log.warning(
                "Заказ %s: CRM не прислала текст просьбы — отдаю человеку",
                item.get("numberOrder", item["id"]),
            )
            await self._mark_quietly(item["id"], "error")
            return True

        status = await send_review_request(client, item["username"], text)
        log.info(
            "Просьба об отзыве по заказу %s для @%s: %s",
            item.get("numberOrder", item["id"]),
            item["username"],
            status,
        )
        await self._mark_quietly(item["id"], status)
        return True

    async def _mark_quietly(self, order_id: str, status: str) -> None:
        try:
            await self.mark(order_id, status)
        except (httpx.HTTPError, OSError):
            # Отметку потеряли — CRM отдаст заказ снова, и клиент получит
            # просьбу дважды. Неприятно, но лучше, чем молча не отправить:
            # повтор заметен, а тишина — нет.
            log.warning(
                "Не удалось отметить просьбу об отзыве по заказу %s", order_id
            )


async def send_review_request(client, username: str, text: str) -> str:
    """Отправить просьбу. Итог — из закрытого списка, который знает CRM."""
    try:
        entity = await client.get_entity(username)
    except (UsernameNotOccupiedError, UsernameInvalidError, ValueError):
        return "not_found"
    except FloodWaitError:
        return "flood"

    try:
        # Без предпросмотра ссылки: в тексте ссылка на отзыв, и картинка
        # площадки под сообщением делает из просьбы рекламный блок.
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
        # Telegram назвал срок — ждём его и пробуем один раз. Дольше
        # MAX_FLOOD_WAIT не ждём: заказ вернётся в очередь позже.
        await asyncio.sleep(exc.seconds + 1)
        try:
            await client.send_message(entity, text, link_preview=False)
            return "sent"
        except RPCError:
            return "error"
    except RPCError as exc:
        log.warning("  отказ Telegram: %s", type(exc).__name__)
        return "error"
