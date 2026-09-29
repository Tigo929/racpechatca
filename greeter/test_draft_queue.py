"""Черновик кладётся в поле ввода и ничего не отправляет.

Главное, что здесь сторожится: единственный вызов к Telegram —
SaveDraftRequest. Если кто-нибудь однажды «упростит» это до send_message,
клиент получит недописанное подтверждение раньше, чем его увидит менеджер.
"""
import asyncio
import unittest

from telethon.errors import RPCError, UsernameNotOccupiedError
from telethon.tl.functions.messages import SaveDraftRequest

from draft_queue import save_draft


class FakeClient:
    """Минимальный двойник: помнит вызовы и умеет падать по заказу."""

    def __init__(self, entity_error=None, call_error=None):
        self._entity_error = entity_error
        self._call_error = call_error
        self.calls = []
        self.sent = []

    async def get_entity(self, username):
        if self._entity_error:
            raise self._entity_error
        return object()

    async def __call__(self, request):
        if self._call_error:
            raise self._call_error
        self.calls.append(request)

    async def send_message(self, *args, **kwargs):
        self.sent.append((args, kwargs))


class SaveDraftTest(unittest.TestCase):
    def test_draft_is_saved_and_nothing_is_sent(self):
        client = FakeClient()
        status = asyncio.run(save_draft(client, "client", "Ваш заказ подтверждён"))
        self.assertEqual(status, "saved")
        self.assertEqual(len(client.calls), 1)
        request = client.calls[0]
        self.assertIsInstance(request, SaveDraftRequest)
        self.assertEqual(request.message, "Ваш заказ подтверждён")
        self.assertTrue(request.no_webpage)
        # Главное обещание: клиенту ничего не ушло.
        self.assertEqual(client.sent, [])

    def test_unknown_username_is_reported_not_retried(self):
        client = FakeClient(entity_error=UsernameNotOccupiedError(None))
        self.assertEqual(asyncio.run(save_draft(client, "ghost", "текст")), "not_found")
        self.assertEqual(client.calls, [])

    def test_telegram_refusal_becomes_error(self):
        client = FakeClient(call_error=RPCError(None, "boom"))
        self.assertEqual(asyncio.run(save_draft(client, "client", "текст")), "error")
        self.assertEqual(client.sent, [])


class PendingSignatureTest(unittest.TestCase):
    """Очередь спрашивается подписанным запросом.

    Без подписи сервер в строгом режиме отвечает 401, и очередь выглядит
    пустой: черновики молча никуда не кладутся. Один раз уже наступили.
    """

    def test_pending_request_is_signed(self):
        from draft_queue import DraftQueue

        seen = {}

        class FakeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"items": []}

        class FakeHttp:
            async def get(self, path, params=None, headers=None):
                seen["path"] = path
                seen["headers"] = headers or {}
                return FakeResponse()

        queue = DraftQueue(FakeHttp(), "секрет")
        asyncio.run(queue.pending())
        self.assertIn("/draft/pending", seen["path"])
        self.assertTrue(
            any(k.lower() == "x-lead-signature" for k in seen["headers"]),
            f"запрос ушёл без подписи: {list(seen['headers'])}",
        )

if __name__ == "__main__":
    unittest.main()
