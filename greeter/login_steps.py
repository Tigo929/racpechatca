# -*- coding: utf-8 -*-
"""
Вход в Telegram в два шага, без интерактивного ввода на первом.

Зачем отдельно от login.py. В login.py всё в одном запуске: он спрашивает
номер, потом код, потом пароль. Это удобно человеку за терминалом, но
означает, что весь вход должен сделать один и тот же человек в одном
сеансе. А запрос кода и ввод кода — разные роли: запросить может кто
угодно, а прочитать код может только владелец аккаунта, в своём Telegram.

Поэтому здесь шаги разнесены:

    python login_steps.py request +79199990282   — отправить код
    python login_steps.py qr                     — вход по QR, без кода
    python login_steps.py sms                    — переслать код по СМС (не работает)
    python login_steps.py signin 12345           — войти по коду
    python login_steps.py password               — облачный пароль, если спросят

Между шагами сохраняется phone_code_hash: без него Telegram не примет код.
Сам по себе он ничего не открывает — это идентификатор попытки входа,
бесполезный без кода.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import (
    PasswordHashInvalidError,
    PhoneCodeExpiredError,
    PhoneCodeInvalidError,
    SendCodeUnavailableError,
    SessionPasswordNeededError,
)

from proxy_config import describe, parse_proxy

SESSION_PATH = Path(os.getenv("GREETER_SESSION", "/session/tg_greeter"))
PENDING = SESSION_PATH.parent / "login-pending.json"
API_ID = int(os.getenv("TG_API_ID", "0"))
API_HASH = os.getenv("TG_API_HASH", "")
PROXY_URL = os.getenv("TELEGRAM_PROXY_URL", "")

CODE_TYPES = {
    "SentCodeTypeApp": "в приложение Telegram, в чат «Telegram»",
    "SentCodeTypeSms": "по СМС",
    "SentCodeTypeCall": "звонком — робот продиктует цифры",
    "SentCodeTypeFlashCall": "звонком-сбросом",
    "SentCodeTypeMissedCall": "пропущенным звонком",
    "SentCodeTypeEmailCode": "на почту",
    "SentCodeTypeFragmentSms": "через Fragment",
}


def client() -> TelegramClient:
    return TelegramClient(
        str(SESSION_PATH), API_ID, API_HASH, proxy=parse_proxy(PROXY_URL)
    )


async def whoami(c: TelegramClient) -> None:
    me = await c.get_me()
    print(f"ГОТОВО. Вошли как {me.first_name} @{me.username or '—'} [id {me.id}]")
    print("Дальше: docker compose -f docker-compose.prod.yml up -d greeter")
    PENDING.unlink(missing_ok=True)


async def do_request(phone: str) -> int:
    c = client()
    await c.connect()
    if await c.is_user_authorized():
        print("Сессия уже авторизована — входить не нужно.")
        await whoami(c)
        await c.disconnect()
        return 0
    try:
        sent = await c.send_code_request(phone)
    except SendCodeUnavailableError:
        print("Telegram отказал: варианты отправки кода на этот номер исчерпаны.")
        print("Это временно. Повторите через час-другой, не чаще.")
        await c.disconnect()
        return 1
    PENDING.write_text(
        json.dumps({"phone": phone, "hash": sent.phone_code_hash}), encoding="utf-8"
    )
    kind = CODE_TYPES.get(type(sent.type).__name__, type(sent.type).__name__)
    print(f"Код отправлен: {kind}")
    print()
    print("Теперь введите его одной командой:")
    print("  docker compose -f docker-compose.prod.yml run --rm greeter \\")
    print("      python login_steps.py signin ЦИФРЫ")
    await c.disconnect()
    return 0


async def do_qr() -> int:
    """Вход по QR-коду — без кода подтверждения.

    Telegram перестал доставлять коды входа, запрошенные сторонним api_id:
    в приложение они не приходят, а force_sms в telethon помечен
    нерабочим. QR обходит выдачу кода целиком: мы показываем картинку,
    владелец подтверждает вход из своего Telegram, где он уже вошёл.

    Это штатный путь Telegram, тот же, которым входят в Telegram Desktop
    и Web: Настройки → Устройства → Подключить устройство.
    """
    import qrcode

    c = client()
    await c.connect()
    if await c.is_user_authorized():
        print("Сессия уже авторизована.")
        await whoami(c)
        await c.disconnect()
        return 0

    print()
    print("Откройте Telegram на телефоне:")
    print("  Настройки → Устройства → Подключить устройство")
    print("и наведите камеру на этот код.")
    print()

    deadline = asyncio.get_event_loop().time() + 300
    while asyncio.get_event_loop().time() < deadline:
        qr_login = await c.qr_login()
        img = qrcode.QRCode(border=1)
        img.add_data(qr_login.url)
        img.print_ascii(invert=True)
        print("Код действует около минуты, потом обновится сам. Жду…")
        try:
            await qr_login.wait(timeout=55)
        except asyncio.TimeoutError:
            print("Срок истёк, показываю новый код.")
            print()
            continue
        except SessionPasswordNeededError:
            print()
            print("Вход подтверждён. У аккаунта включена двухфакторная защита.")
            await c.disconnect()
            print("Осталось ввести облачный пароль:")
            print("  docker compose -f docker-compose.prod.yml run --rm greeter \\")
            print("      python login_steps.py password")
            return 2
        await whoami(c)
        await c.disconnect()
        return 0

    print("Пять минут прошло, подтверждения не было. Запустите команду заново.")
    await c.disconnect()
    return 1


async def do_sms() -> int:
    """Переслать код по СМС.

    Telegram не позволяет сразу просить СМС: сначала он пробует доставить
    код внутрь приложения, и только после этой попытки согласен на другой
    канал. Если в приложение код не приходит — а так бывает с кодами,
    запрошенными сторонним api_id, — СМС остаётся единственным путём.
    """
    if not PENDING.exists():
        print("Нет начатой попытки входа — сначала request.")
        return 1
    data = json.loads(PENDING.read_text(encoding="utf-8"))
    c = client()
    await c.connect()
    c._phone_code_hash[data["phone"]] = data["hash"]
    try:
        sent = await c.send_code_request(data["phone"], force_sms=True)
    except SendCodeUnavailableError:
        print("Telegram отказал: варианты отправки на этот номер исчерпаны.")
        print("Это временно — повторите через час-другой, не чаще.")
        await c.disconnect()
        return 1
    PENDING.write_text(
        json.dumps({"phone": data["phone"], "hash": sent.phone_code_hash}),
        encoding="utf-8",
    )
    kind = CODE_TYPES.get(type(sent.type).__name__, type(sent.type).__name__)
    print(f"Повторная отправка: {kind}")
    print()
    print("Код вводится так же:")
    print("  docker compose -f docker-compose.prod.yml run --rm greeter \\")
    print("      python login_steps.py signin ЦИФРЫ")
    await c.disconnect()
    return 0


async def do_signin(code: str) -> int:
    if not PENDING.exists():
        print("Нет начатой попытки входа — сначала request.")
        return 1
    data = json.loads(PENDING.read_text(encoding="utf-8"))
    c = client()
    await c.connect()
    # Хеш попытки кладём туда, откуда Telethon его берёт сам.
    c._phone_code_hash[data["phone"]] = data["hash"]
    try:
        await c.sign_in(data["phone"], code, phone_code_hash=data["hash"])
    except PhoneCodeInvalidError:
        print("Код неверный. Проверьте цифры и повторите signin — новый код не нужен.")
        await c.disconnect()
        return 1
    except PhoneCodeExpiredError:
        print("Код устарел. Начните заново с request.")
        PENDING.unlink(missing_ok=True)
        await c.disconnect()
        return 1
    except SessionPasswordNeededError:
        print("Код принят. У аккаунта включена двухфакторная защита.")
        print()
        print("Осталось ввести облачный пароль:")
        print("  docker compose -f docker-compose.prod.yml run --rm greeter \\")
        print("      python login_steps.py password")
        await c.disconnect()
        return 2
    await whoami(c)
    await c.disconnect()
    return 0


async def do_password() -> int:
    from getpass import getpass

    c = client()
    await c.connect()
    if await c.is_user_authorized():
        print("Уже авторизованы.")
        await whoami(c)
        await c.disconnect()
        return 0
    while True:
        try:
            import termios

            termios.tcflush(sys.stdin, termios.TCIFLUSH)
        except Exception:
            pass
        try:
            password = getpass("Облачный пароль (не отображается): ").strip()
        except EOFError:
            print("\nВвод закрыт — запустите команду в интерактивном терминале.")
            await c.disconnect()
            return 1
        if not password:
            print("Пусто. Введите пароль.")
            continue
        try:
            await c.sign_in(password=password)
            break
        except PasswordHashInvalidError:
            print("Пароль неверный. Попробуйте ещё раз — код вводить заново не нужно.")
    await whoami(c)
    await c.disconnect()
    return 0


def usage() -> int:
    print(__doc__.strip())
    return 2


async def main() -> int:
    if not API_ID or not API_HASH:
        print("TG_API_ID / TG_API_HASH не заданы в окружении контейнера.")
        return 1
    SESSION_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Соединение: {describe(PROXY_URL)}")
    args = sys.argv[1:]
    if not args:
        return usage()
    if args[0] == "request" and len(args) == 2:
        return await do_request(args[1].strip())
    if args[0] == "qr":
        return await do_qr()
    if args[0] == "sms":
        return await do_sms()
    if args[0] == "signin" and len(args) == 2:
        return await do_signin(args[1].strip())
    if args[0] == "password":
        return await do_password()
    return usage()


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print()
        sys.exit(1)
