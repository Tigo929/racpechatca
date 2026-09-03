# -*- coding: utf-8 -*-
"""
Разбор адреса прокси для Telethon.

Зачем это нужно. С боевого сервера Telegram недоступен напрямую: ни
api.telegram.org, ни серверы MTProto (149.154.167.x:443) не отвечают.
Бот CRM ходит через прокси, и воркер обязан ходить через тот же — иначе
он просто не соединится, что и произошло при первой проверке.

Формат берём из той же переменной, что и бот: TELEGRAM_PROXY_URL,
вида http://user:pass@host:port или socks5://host:port.
"""

from __future__ import annotations

from urllib.parse import urlparse

#: Схемы, которые понимает python-socks. Ключ — то, что пишут в адресе.
_SCHEMES = {
    "http": "http",
    "https": "http",
    "socks5": "socks5",
    "socks5h": "socks5",
    "socks4": "socks4",
}


def parse_proxy(url: str | None):
    """
    Словарь для Telethon или None, если прокси не задан.

    Формат именно словаря python-socks, а не кортежа PySocks: у Telethon
    этой версии поддержка прокси завязана на python-socks, и с кортежем
    от PySocks он молча пишет «proxy argument will be ignored» и идёт
    напрямую — то есть никуда.

    rdns=True — имена резолвит прокси, а не мы: с этого сервера DNS
    Telegram тоже может не отвечать, и резолвить у себя значило бы
    упереться в то же самое.
    """
    value = (url or "").strip()
    if not value:
        return None

    parsed = urlparse(value if "://" in value else f"http://{value}")
    kind = _SCHEMES.get((parsed.scheme or "http").lower())
    if not kind or not parsed.hostname:
        raise ValueError(f"не разбирается адрес прокси: схема {parsed.scheme!r}")

    proxy = {
        "proxy_type": kind,
        "addr": parsed.hostname,
        "port": parsed.port or (1080 if kind.startswith("socks") else 8080),
        "rdns": True,
    }
    if parsed.username:
        proxy["username"] = parsed.username
        proxy["password"] = parsed.password or ""
    return proxy


def describe(url: str | None) -> str:
    """Строка для лога — без логина и пароля."""
    value = (url or "").strip()
    if not value:
        return "напрямую, без прокси"
    parsed = urlparse(value if "://" in value else f"http://{value}")
    return f"через прокси {parsed.scheme}://{parsed.hostname}:{parsed.port or '?'}"
