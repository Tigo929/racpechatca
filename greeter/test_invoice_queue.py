"""Счёт клиенту уходит — и только тем текстом, что дала CRM.

Что здесь сторожится:
  * сообщение действительно отправляется (это не черновик);
  * текст идёт как есть, без предпросмотра ссылок;
  * отказы превращаются в итоги из закрытого списка, который знает CRM;
  * пустой текст не превращается в отсебятину: в счёте деньги, и выдумать
    их нельзя ни при каких обстоятельствах — заказ уходит человеку.
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

from invoice_queue import InvoiceQueue, send_invoice

TEXT = "✅ Отлично, ваш заказ подтверждён!\nИтого к оплате: 1 490 ₽"


class FakeClient:
    def __init__(self, entity_error=None, send_error=None):
        self._entity_error = entity_error
        self._send_error = send_error
        self.sent = []

    async def get_entity(self, username):
        if self._entity_error:
            raise self._entity_error
        return object()

    async def send_message(self, entity, text, link_preview=True):
        if self._send_error:
            raise self._send_error
        self.sent.append((text, link_preview))


class SendTest(unittest.TestCase):
    def test_invoice_is_sent_as_is(self):
        client = FakeClient()
        status = asyncio.run(send_invoice(client, "client", TEXT))
        self.assertEqual(status, "sent")
        self.assertEqual(client.sent, [(TEXT, False)])

    def test_unknown_username(self):
        client = FakeClient(entity_error=UsernameNotOccupiedError(None))
        self.assertEqual(asyncio.run(send_invoice(client, "ghost", TEXT)), "not_found")
        self.assertEqual(client.sent, [])

    def test_refusals_are_distinct(self):
        cases = {
            "privacy": UserPrivacyRestrictedError(None),
            "blocked": UserIsBlockedError(None),
            "flood": PeerFloodError(None),
            "error": RPCError(None, "boom"),
        }
        for expected, error in cases.items():
            client = FakeClient(send_error=error)
            self.assertEqual(
                asyncio.run(send_invoice(client, "client", TEXT)), expected
            )


class QueueTest(unittest.TestCase):
    def test_empty_text_is_handed_to_a_human(self):
        marks = []

        class Queue(InvoiceQueue):
            async def pending(self, limit=1):
                return [{"id": "o1", "numberOrder": "1", "username": "c", "text": "  "}]

            async def mark(self, order_id, status):
                marks.append((order_id, status))

        client = FakeClient()
        done = asyncio.run(Queue(None, "secret").process_one(client))
        self.assertTrue(done)
        # Ничего не отправили и честно сказали, что нужен человек.
        self.assertEqual(client.sent, [])
        self.assertEqual(marks, [("o1", "error")])

    def test_sent_invoice_is_marked(self):
        marks = []

        class Queue(InvoiceQueue):
            async def pending(self, limit=1):
                return [
                    {"id": "o1", "numberOrder": "1", "username": "c", "text": TEXT}
                ]

            async def mark(self, order_id, status):
                marks.append((order_id, status))

        client = FakeClient()
        asyncio.run(Queue(None, "secret").process_one(client))
        self.assertEqual(client.sent, [(TEXT, False)])
        self.assertEqual(marks, [("o1", "sent")])


if __name__ == "__main__":
    unittest.main()
