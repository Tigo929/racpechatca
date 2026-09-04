# -*- coding: utf-8 -*-
"""
Одноразовый вход в Telegram для воркера.

Запускается вручную на сервере, один раз:

    docker compose -f docker-compose.prod.yml run --rm greeter python login.py

Отличие от простого client.start(): скрипт показывает, КУДА Telegram
отправил код, и умеет переслать его по СМС. Это не украшение — при первой
попытке код ушёл в приложение, человек его там не нашёл, и без подсказки
понять, ждать дальше или нет, было невозможно.

Переслать по СМС можно только после попытки через приложение: таково
правило Telegram, сразу запросить СМС нельзя.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import (
    PhoneCodeExpiredError,
    PhoneCodeInvalidError,
    SessionPasswordNeededError,
)

from proxy_config import describe, parse_proxy

SESSION_PATH = Path(os.getenv("GREETER_SESSION", "/session/tg_greeter"))
API_ID = int(os.getenv("TG_API_ID", "0"))
API_HASH = os.getenv("TG_API_HASH", "")
PROXY_URL = os.getenv("TELEGRAM_PROXY_URL", "")


def describe_code_type(sent) -> str:
    """Человеческое название способа доставки кода."""
    name = type(sent.type).__name__
    known = {
        "SentCodeTypeApp": "в приложение Telegram (чат «Telegram»)",
        "SentCodeTypeSms": "по СМС",
        "SentCodeTypeCall": "звонком — робот продиктует цифры",
        "SentCodeTypeFlashCall": "звонком-сбросом, код в номере звонящего",
        "SentCodeTypeMissedCall": "пропущенным звонком, код в конце номера",
        "SentCodeTypeEmailCode": "на почту",
        "SentCodeTypeFragmentSms": "через Fragment",
    }
    return known.get(name, name)


def describe_next(sent) -> str:
    """Чем можно переслать, если не дошло."""
    if not getattr(sent, "next_type", None):
        return "переслать другим способом Telegram не предлагает"
    name = type(sent.next_type).__name__
    known = {
        "SentCodeTypeSms": "СМС",
        "SentCodeTypeCall": "звонком",
        "SentCodeTypeFlashCall": "звонком-сбросом",
    }
    return f"можно переслать: {known.get(name, name)}"


async def main() -> int:
    if not API_ID or not API_HASH:
        print("TG_API_ID / TG_API_HASH не заданы в окружении контейнера.")
        return 1

    SESSION_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Соединение: {describe(PROXY_URL)}")

    client = TelegramClient(
        str(SESSION_PATH), API_ID, API_HASH, proxy=parse_proxy(PROXY_URL)
    )
    await client.connect()

    if await client.is_user_authorized():
        me = await client.get_me()
        print(f"Уже авторизованы: {me.first_name} @{me.username or '—'}")
        await client.disconnect()
        return 0

    phone = input("Номер телефона (например +79199990282): ").strip()

    sent = await client.send_code_request(phone)
    print()
    print(f"Код отправлен: {describe_code_type(sent)}")
    print(f"({describe_next(sent)})")
    print()
    print("Введите код цифрами. Если он не пришёл — напишите  смс  и нажмите Enter.")

    code = input("Код: ").strip()

    if code.lower() in {"смс", "sms"}:
        # Пересылаем тем способом, который Telegram предложил следующим.
        sent = await client.send_code_request(phone, force_sms=True)
        print()
        print(f"Отправлено повторно: {describe_code_type(sent)}")
        code = input("Код: ").strip()

    try:
        await client.sign_in(phone, code)
    except SessionPasswordNeededError:
        # Двухфакторная. Пароль при вводе не отображается — это норма.
        from getpass import getpass

        password = getpass("Пароль двухфакторной защиты: ")
        await client.sign_in(password=password)
    except PhoneCodeInvalidError:
        print("Код неверный. Запустите команду заново — придёт новый.")
        await client.disconnect()
        return 1
    except PhoneCodeExpiredError:
        print("Код устарел. Запустите команду заново — придёт новый.")
        await client.disconnect()
        return 1

    me = await client.get_me()
    print()
    print(f"Готово. Вошли как {me.first_name} @{me.username or '—'} [id {me.id}]")
    print(f"Сессия: {SESSION_PATH}")
    print("Теперь: docker compose -f docker-compose.prod.yml up -d greeter")
    await client.disconnect()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print()
        sys.exit(1)
