# -*- coding: utf-8 -*-
"""
Подстановка в шаблон сообщения.

Отдельным модулем без Telethon и httpx: это единственная в воркере логика,
которую можно проверить, не подключаясь к Telegram. Ошибка здесь видна
клиенту дословно, поэтому она закреплена тестами.
"""

from __future__ import annotations


def greeting_for(name: str | None) -> str:
    """
    Обращение целиком, а не только имя.

    У заявки имени может не быть — человек оставил только контакт. Подставлять
    в «Здравствуйте, {name}!» пустую строку нельзя: получится «Здравствуйте, !»,
    и это выглядит как поломка, а не как вежливость.
    """
    clean = (name or "").strip()
    return f"Здравствуйте, {clean}!" if clean else "Здравствуйте!"


def render(template: str, name: str | None, number: str) -> str:
    """Готовый текст сообщения. Неизвестные метки остаются как есть."""
    return (
        template.replace("{greeting}", greeting_for(name))
        .replace("{name}", (name or "").strip())
        .replace("{number}", number)
    )
