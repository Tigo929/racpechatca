"""Просьба об отзыве уходит клиенту — и только тем текстом, что дала CRM.

Что здесь сторожится:
  * сообщение действительно отправляется (это не черновик);
  * текст идёт как есть, без предпросмотра ссылки на отзыв;
  * отказы превращаются в итоги из закрытого списка, который знает CRM;
  * пустой текст не превращается в отсебятину — просьбу отдаём человеку.
"""
import asyncio
import unittest

from telethon.errors import (
    PeerFloodError,
    RPCError,
    UserIsBlockedError,
    UserPrivacyRestrictedError,
    UsernameNotOccupiedError,
)

from review_queue import ReviewQueue, send_review_request


class FakeClient:
    def __init__(self, entity_error=None, send_error=None):
        self._entity_error = entity_error
        self._send_error = send_error
        self.sent = []
        self.calls = []

    async def get_entity(self, username):
        if self._entity_error:
            raise self._entity_error
        return object()

    async def send_message(self, entity, text, link_preview=True):
        if self._send_error:
            raise self._send_error
        self.sent.append((text, link_preview))

    async def __call__(self, request):
        self.calls.append(request)


class SendTest(unittest.TestCase):
    def test_message_is_sent_without_link_preview(self):
        client = FakeClient()
        status = asyncio.run(
            send_review_request(client, "client", "Как вам футболка?")
        )
        self.assertEqual(status, "sent")
        self.assertEqual(client.sent, [("Как вам футболка?", False)])

    def test_unknown_username(self):
        client = FakeClient(entity_error=UsernameNotOccupiedError(None))
        self.assertEqual(
            asyncio.run(send_review_request(client, "ghost", "текст")), "not_found"
        )
        self.assertEqual(client.sent, [])

    def test_privacy_and_blocked_are_distinct(self):
        # Разные причины — разные подсказки владельцу: «проверьте ник» и
        # «клиент заблокировал» требуют разных действий.
        privacy = FakeClient(send_error=UserPrivacyRestrictedError(None))
        blocked = FakeClient(send_error=UserIsBlockedError(None))
        self.assertEqual(
            asyncio.run(send_review_request(privacy, "c", "т")), "privacy"
        )
        self.assertEqual(
            asyncio.run(send_review_request(blocked, "c", "т")), "blocked"
        )

    def test_peer_flood_returns_flood_not_error(self):
        # «flood» CRM повторит позже, «error» — нет. Спутать их значит
        # потерять просьбу из-за временного ограничения аккаунта.
        client = FakeClient(send_error=PeerFloodError(None))
        self.assertEqual(asyncio.run(send_review_request(client, "c", "т")), "flood")

    def test_other_refusal_becomes_error(self):
        client = FakeClient(send_error=RPCError(None, "boom"))
        self.assertEqual(asyncio.run(send_review_request(client, "c", "т")), "error")


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class FakeHttp:
    def __init__(self, items):
        self._items = items
        self.get_headers = {}
        self.posted = []

    async def get(self, path, params=None, headers=None):
        self.get_path = path
        self.get_headers = headers or {}
        return FakeResponse({"items": self._items})

    async def post(self, path, content=None, headers=None):
        self.posted.append((path, content))
        return FakeResponse({"ok": True})


class QueueTest(unittest.TestCase):
    def test_pending_request_is_signed(self):
        # Без подписи сервер в строгом режиме отвечает 401, и очередь
        # выглядит пустой: просьбы молча никуда не уходят.
        http = FakeHttp([])
        queue = ReviewQueue(http, "секрет")
        asyncio.run(queue.pending())
        self.assertIn("/review/pending", http.get_path)
        self.assertTrue(
            any(k.lower() == "x-lead-signature" for k in http.get_headers),
            f"запрос ушёл без подписи: {list(http.get_headers)}",
        )

    def test_sent_status_is_reported(self):
        http = FakeHttp(
            [{"id": "o1", "numberOrder": "20261104-001", "username": "client",
              "text": "Как вам футболка?"}]
        )
        client = FakeClient()
        queue = ReviewQueue(http, "секрет")
        self.assertTrue(asyncio.run(queue.process_one(client)))
        self.assertEqual(client.sent, [("Как вам футболка?", False)])
        self.assertEqual(len(http.posted), 1)
        path, body = http.posted[0]
        self.assertIn("/review/mark", path)
        self.assertIn('"status":"sent"', body)

    def test_empty_text_is_not_invented(self):
        # Текст собирает CRM. Пустой — рассогласование версий: отправить
        # клиенту отсебятину о отзыве хуже, чем отдать просьбу человеку.
        http = FakeHttp([{"id": "o1", "username": "client", "text": "  "}])
        client = FakeClient()
        queue = ReviewQueue(http, "секрет")
        asyncio.run(queue.process_one(client))
        self.assertEqual(client.sent, [])
        self.assertIn('"status":"error"', http.posted[0][1])

    def test_empty_queue_does_nothing(self):
        http = FakeHttp([])
        client = FakeClient()
        queue = ReviewQueue(http, "секрет")
        self.assertFalse(asyncio.run(queue.process_one(client)))
        self.assertEqual(http.posted, [])


if __name__ == "__main__":
    unittest.main()
