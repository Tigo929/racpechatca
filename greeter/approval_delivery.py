"""Send explicitly requested approval photos using the existing user session.

Claim once, send once. A network failure during send is UNKNOWN, never retried
automatically. Only the completion request may be retried safely.
"""
from __future__ import annotations

import asyncio
import io
import json
import logging
import uuid

import httpx
from telethon.errors import (
    FloodWaitError, PeerFloodError, UserIsBlockedError,
    UserPrivacyRestrictedError, UsernameInvalidError, UsernameNotOccupiedError,
)
from telethon.tl.types import User

from signing import sign

log = logging.getLogger("greeter.approvals")
PREFIX = "/order-photo-approval-delivery"


class ApprovalQueue:
    def __init__(self, http: httpx.AsyncClient, secret: str):
        self.http = http
        self.secret = secret

    async def post(self, path: str, payload: dict) -> httpx.Response:
        body = json.dumps(payload, separators=(",", ":"))
        response = await self.http.post(
            PREFIX + path, content=body,
            headers={"Content-Type": "application/json", **sign(self.secret, body)},
        )
        response.raise_for_status()
        return response

    async def process_one(self, client, peer_flood_pause: float = 21600) -> float:
        """Return required account cooldown, zero when queue is empty.

        A claim whose HTTP response was lost is deliberately not reclaimed.
        Backend exposes UNKNOWN after five minutes for manual reconciliation.
        """
        token = str(uuid.uuid4())
        try:
            item = (await self.post("/claim", {"claimToken": token})).json().get("item")
        except (httpx.HTTPError, OSError, ValueError):
            log.warning("Очередь макетов недоступна")
            return 0
        if not item:
            return 0

        result = {"claimToken": token, "status": "FAILED", "errorCode": "unavailable"}
        cooldown = 0
        send_started = False
        try:
            # No arbitrary URL fetching: both recipient and bytes come from CRM.
            photo = (await self.post(f"/{item['id']}/image", {"claimToken": token})).content
            if not photo.startswith(b"\xff\xd8\xff") or len(photo) > 10 * 1024 * 1024:
                result["errorCode"] = "file"
            else:
                entity = await asyncio.wait_for(client.get_entity(item["recipient"]), 30)
                if not isinstance(entity, User) or entity.bot or entity.deleted or entity.is_self:
                    result["errorCode"] = "not_user"
                else:
                    file = io.BytesIO(photo)
                    file.name = "approval.jpg"
                    send_started = True
                    message = await asyncio.wait_for(client.send_file(
                        entity, file, caption=item["caption"], parse_mode=None,
                        force_document=False,
                    ), 120)
                    if not message or not message.id:
                        raise RuntimeError("No Telegram message ID")
                    result = {"claimToken": token, "status": "SENT", "messageId": message.id}
        except (UsernameInvalidError, UsernameNotOccupiedError):
            result["errorCode"] = "not_found"
        except UserPrivacyRestrictedError:
            result["errorCode"] = "privacy"
        except UserIsBlockedError:
            result["errorCode"] = "blocked"
        except FloodWaitError as exc:
            result["errorCode"] = "flood"
            cooldown = exc.seconds + 1
        except PeerFloodError:
            result["errorCode"] = "flood"
            cooldown = peer_flood_pause
        except Exception as exc:
            # Never log URLs, credentials, captions or raw Telegram exceptions.
            log.warning("Макет %s: %s", item["id"], type(exc).__name__)
            if send_started:
                result.update(status="UNKNOWN", errorCode="uncertain")
            elif isinstance(exc, ValueError):
                result["errorCode"] = "not_found"

        for attempt in range(3):
            try:
                await self.post(f"/{item['id']}/complete", result)
                break
            except (httpx.HTTPError, OSError):
                if attempt < 2:
                    await asyncio.sleep(2)
                else:
                    log.error("Макет %s: результат не записан; повторной отправки не будет", item["id"])
        log.info("Макет %s: %s", item["id"], result["status"])
        # Space approvals and greetings on the same account as well.
        return max(cooldown, 25)
