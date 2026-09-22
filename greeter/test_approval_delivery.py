import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from telethon.tl.types import User, Channel
from telethon.errors import UserPrivacyRestrictedError, FloodWaitError
from approval_delivery import ApprovalQueue


class DeliveryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.calls = []
        self.completion_failures = 0
        self.item = {"id": "delivery", "recipient": "client_test", "caption": "Макет на согласование"}
        def handler(request):
            data = json.loads(request.content)
            self.calls.append((request.url.path, data))
            self.assertTrue(request.headers.get("authorization"))
            if request.url.path.endswith("/claim"):
                return httpx.Response(200, json={"item": self.item})
            if request.url.path.endswith("/image"):
                return httpx.Response(200, content=b"\xff\xd8\xffphoto")
            if self.completion_failures:
                self.completion_failures -= 1
                return httpx.Response(503)
            return httpx.Response(200, json={"ok": True})
        self.http = httpx.AsyncClient(base_url="https://crm.test", headers={"Authorization": "Bearer test"}, transport=httpx.MockTransport(handler))
        self.queue = ApprovalQueue(self.http, "test-signing-key")
        self.client = AsyncMock()
        self.client.get_entity.return_value = User(id=42, first_name="Test")
        self.client.send_file.return_value.id = 123
        self.sleep = patch("approval_delivery.asyncio.sleep", new_callable=AsyncMock)
        self.sleep.start()

    async def asyncTearDown(self):
        self.sleep.stop()
        await self.http.aclose()

    async def test_sends_photo_and_caption_and_records_message_id(self):
        await self.queue.process_one(self.client)
        self.client.send_file.assert_awaited_once()
        self.assertEqual(self.client.send_file.call_args.kwargs["caption"], self.item["caption"])
        self.assertIsNone(self.client.send_file.call_args.kwargs["parse_mode"])
        self.assertEqual(self.calls[-1][1]["status"], "SENT")
        self.assertEqual(self.calls[-1][1]["messageId"], 123)

    async def test_lost_completion_retries_only_metadata(self):
        self.completion_failures = 2
        await self.queue.process_one(self.client)
        self.client.send_file.assert_awaited_once()
        completions = [data for path, data in self.calls if path.endswith("/complete")]
        self.assertEqual(len(completions), 3)
        self.assertTrue(all(data == completions[0] for data in completions))

    async def test_send_timeout_is_unknown_and_never_retried(self):
        self.client.send_file.side_effect = TimeoutError()
        await self.queue.process_one(self.client)
        self.client.send_file.assert_awaited_once()
        self.assertEqual(self.calls[-1][1]["status"], "UNKNOWN")

    async def test_privacy_refusal_is_safe_to_retry_manually(self):
        self.client.send_file.side_effect = UserPrivacyRestrictedError(request=None)
        await self.queue.process_one(self.client)
        self.assertEqual(self.calls[-1][1]["status"], "FAILED")
        self.assertEqual(self.calls[-1][1]["errorCode"], "privacy")

    async def test_flood_wait_is_observed(self):
        self.client.send_file.side_effect = FloodWaitError(request=None, capture=120)
        self.assertGreaterEqual(await self.queue.process_one(self.client), 120)
        self.assertEqual(self.calls[-1][1]["errorCode"], "flood")

    async def test_never_sends_to_bots_groups_or_self(self):
        for entity in [User(id=1, bot=True), User(id=1, is_self=True), Channel(id=1, title="group", photo=None, date=None)]:
            self.client.get_entity.return_value = entity
            await self.queue.process_one(self.client)
            self.assertEqual(self.calls[-1][1]["errorCode"], "not_user")
        self.client.send_file.assert_not_awaited()

    async def test_empty_queue_does_not_send(self):
        self.item = None
        self.assertEqual(await self.queue.process_one(self.client), 0)
        self.client.send_file.assert_not_awaited()

    async def test_recipient_lookup_failure_does_not_send(self):
        self.client.get_entity.side_effect = ValueError()
        await self.queue.process_one(self.client)
        self.client.send_file.assert_not_awaited()
        self.assertEqual(self.calls[-1][1]["errorCode"], "not_found")


if __name__ == '__main__':
    unittest.main()
