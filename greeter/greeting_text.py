# -*- coding: utf-8 -*-
"""
Подстановка в шаблон сообщения.

Отдельным модулем без Telethon и httpx: это единственная в воркере логика,
которую можно проверить, не подключаясь к Telegram. Ошибка здесь видна
клиенту дословно, поэтому она закреплена тестами.

Составные метки (`{greeting}`, `{order}`) вместо голых значений — потому
что данных может не быть. У заявки бывает не указано имя, а у заказа
может не быть позиции: подставлять в текст пустоту нельзя, получится
«Здравствуйте, !» и «заказ — , 0 шт.», то есть явная поломка.
"""

from __future__ import annotations


def greeting_for(name: str | None) -> str:
    """
    Обращение целиком, а не только имя.

    У заявки имени может не быть — человек оставил только контакт.
    Подставлять пустую строку нельзя: «Здравствуйте, !» читается
    как сбой, а не как вежливость.
    """
    clean = (name or "").strip()
    return f"Здравствуйте, {clean}!" if clean else "Здравствуйте!"


def order_line(number: str, product: str | None, quantity: int) -> str:
    """
    Строка заказа: номер, что заказали и сколько.

    Именно она отличает ответ на действие от рассылки. «Вы оставили
    заявку» человек читает как спам; «заказ 20260904-035 — Фото 10×15
    с полями, 10 шт.» невозможно спутать с массовой отправкой, потому
    что таких данных у спамера нет.

    Позиции может не быть (обращение без товара) — тогда остаётся номер.
    """
    title = (product or "").strip()
    if title and quantity > 0:
        return f"Ваш заказ {number} — {title}, {quantity} шт."
    if title:
        return f"Ваш заказ {number} — {title}."
    return f"Ваш заказ {number}."


def render(
    template: str,
    name: str | None,
    number: str,
    product: str | None = None,
    quantity: int = 0,
) -> str:
    """Готовый текст сообщения. Неизвестные метки остаются как есть."""
    return (
        template.replace("{greeting}", greeting_for(name))
        .replace("{order}", order_line(number, product, quantity))
        .replace("{name}", (name or "").strip())
        .replace("{number}", number)
        .replace("{product}", (product or "").strip())
        .replace("{quantity}", str(quantity) if quantity > 0 else "")
    )
