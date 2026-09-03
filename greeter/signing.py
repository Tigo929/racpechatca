# -*- coding: utf-8 -*-
"""
Подпись запросов к CRM.

CRM принимает машинные запросы по двум рубежам: токен подтверждает, что
запрос вообще наш, подпись тела — что его не подменили по дороге и не
переигрывают повторно. На боевом сервере включён строгий режим
(CRM_LEAD_REQUIRE_SIGNATURE=true), поэтому запрос без подписи отбивается.

Правило подписи повторяет серверное (site-lead-token.guard.ts):
HMAC-SHA256 от строки «метка_времени.тело» ключом CRM_LEAD_SIGNING_SECRET.
Метка внутри подписи не случайно: иначе её можно было бы подменить.
"""

from __future__ import annotations

import hmac
import time
from hashlib import sha256


def sign(secret: str, body: str, timestamp: int | None = None) -> dict[str, str]:
    """
    Заголовки подписи. Пустой секрет — пустой словарь: пусть CRM решает,
    пускать такой запрос или нет, а не мы притворяемся подписанными.
    """
    if not secret:
        return {}
    ts = str(timestamp if timestamp is not None else int(time.time()))
    digest = hmac.new(
        secret.encode("utf-8"), f"{ts}.{body}".encode("utf-8"), sha256
    ).hexdigest()
    return {"x-lead-timestamp": ts, "x-lead-signature": f"sha256={digest}"}
