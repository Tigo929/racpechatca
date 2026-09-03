# -*- coding: utf-8 -*-
"""
Одноразовый вход в Telegram для воркера.

Запускается вручную на сервере, один раз:

    docker compose -f docker-compose.prod.yml run --rm greeter python login.py

Спросит номер, код из приложения и пароль двухфакторной аутентификации,
если он включён. После этого в томе появится файл сессии, и воркер будет
подниматься сам — код больше не понадобится.

Сессия делается отдельная от той, что лежит в скриптах на компьютере:
у каждого процесса свой файл. Аккаунт один, но потерять или отозвать
доступ можно по отдельности, не трогая второй процесс.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from telethon import TelegramClient

from proxy_config import describe, parse_proxy

SESSION_PATH = Path(os.getenv("GREETER_SESSION", "/session/tg_greeter"))
API_ID = int(os.getenv("TG_API_ID", "0"))
API_HASH = os.getenv("TG_API_HASH", "")
PROXY_URL = os.getenv("TELEGRAM_PROXY_URL", "")


async def main() -> int:
    if not API_ID or not API_HASH:
        print("TG_API_ID / TG_API_HASH не заданы в окружении контейнера.")
        return 1

    SESSION_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Соединение: {describe(PROXY_URL)}")
    client = TelegramClient(
        str(SESSION_PATH), API_ID, API_HASH, proxy=parse_proxy(PROXY_URL)
    )

    # start() сам спросит номер, код и пароль 2FA, если они нужны.
    await client.start()

    me = await client.get_me()
    print()
    print(f"Готово. Вошли как {me.first_name} @{me.username or '—'} [id {me.id}]")
    print(f"Сессия: {SESSION_PATH}")
    print("Теперь можно поднимать воркер: docker compose up -d greeter")
    await client.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
