# -*- coding: utf-8 -*-
"""
Подстановка в шаблон сообщения.

Отдельным модулем без Telethon и httpx: это единственная в воркере логика,
которую можно проверить, не подключаясь к Telegram. Ошибка здесь видна
клиенту дословно, поэтому она закреплена тестами.

Составные метки (`{greeting}`, `{{СПИСОК_ТОВАРОВ}}`) вместо голых значений —
потому что данных может не быть. У заявки бывает не указано имя, а у заказа
может не быть позиций: подставлять пустоту нельзя, получится
«Здравствуйте, !» и пустая строка вместо списка, то есть явная поломка.
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


def items_list(items: list[dict] | None) -> str:
    """
    Список позиций — по строке на позицию.

    Именно он отличает ответ на действие от рассылки: «Фото 10×15 с полями
    — 10 шт.» невозможно спутать с массовой отправкой, потому что таких
    данных у спамера нет.

    Позиций может не быть (обращение без товара) — тогда строка нейтральная,
    и текст вокруг неё не разваливается.
    """
    rows = []
    for item in items or []:
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        quantity = item.get("quantity") or 0
        rows.append(f"• {title} — {quantity} шт." if quantity > 0 else f"• {title}")

    return "\n".join(rows) if rows else "• уточним состав заказа в переписке"


def money(total: int | None) -> str:
    """
    Сумма с пробелами между разрядами: 2 490, а не 2490.

    Ноль означает, что позиций в заказе нет и сумму называть нечего —
    отдаём прочерк, чтобы в сообщении не появилось «Сумма заказа: 0 ₽».
    """
    value = int(total or 0)
    if value <= 0:
        return "—"
    return f"{value:,}".replace(",", " ")


def render(
    template: str,
    name: str | None,
    number: str,
    items: list[dict] | None = None,
    total: int | None = 0,
) -> str:
    """Готовый текст сообщения. Неизвестные метки остаются как есть."""
    return (
        template.replace("{greeting}", greeting_for(name))
        .replace("{{СПИСОК_ТОВАРОВ}}", items_list(items))
        .replace("{{СУММА}}", money(total))
        .replace("{{НОМЕР}}", number)
        .replace("{name}", (name or "").strip())
        .replace("{number}", number)
    )
