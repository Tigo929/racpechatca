# -*- coding: utf-8 -*-
"""Текст первого сообщения. Запуск: python -m unittest test_greeting_text"""

import unittest

from greeting_text import delivery_line, greeting_for, items_list, money, render


class TestGreeting(unittest.TestCase):
    def test_с_именем(self):
        self.assertEqual(greeting_for("Пётр"), "Здравствуйте, Пётр!")

    def test_без_имени(self):
        # Главное, ради чего обращение вынесено отдельной меткой:
        # «Здравствуйте, !» клиент читает как поломку.
        for empty in (None, "", "   "):
            self.assertEqual(greeting_for(empty), "Здравствуйте!")

    def test_имя_с_пробелами(self):
        self.assertEqual(greeting_for("  Анна  "), "Здравствуйте, Анна!")


class TestItemsList(unittest.TestCase):
    def test_одна_позиция(self):
        out = items_list([{"title": "Фото 10×15 с полями", "quantity": 10}])
        self.assertEqual(out, "• Фото 10×15 с полями — 10 шт.")

    def test_несколько_позиций_каждая_со_своей_строки(self):
        out = items_list([
            {"title": "Polaroid", "quantity": 20},
            {"title": "Фото 10×15", "quantity": 50},
        ])
        self.assertEqual(out.split(chr(10)), ["• Polaroid — 20 шт.", "• Фото 10×15 — 50 шт."])

    def test_без_позиций_строка_не_пустая(self):
        # Пустое место посреди сообщения выглядит как сбой вёрстки.
        for empty in (None, [], [{"title": "  ", "quantity": 5}]):
            self.assertTrue(items_list(empty).startswith("•"))

    def test_без_тиража_без_хвоста(self):
        self.assertEqual(items_list([{"title": "Холст 30×40", "quantity": 0}]), "• Холст 30×40")


class TestMoney(unittest.TestCase):
    def test_разряды_разделены(self):
        self.assertEqual(money(1350), "1 350")
        self.assertEqual(money(12490), "12 490")

    def test_маленькая_сумма(self):
        self.assertEqual(money(630), "630")

    def test_ноль_это_прочерк(self):
        # «Сумма заказа: 0 ₽» — обещание бесплатной работы.
        for empty in (0, None, -5):
            self.assertEqual(money(empty), "—")


class TestDeliveryLine(unittest.TestCase):
    def test_яндекс_с_ценой(self):
        self.assertEqual(
            delivery_line("YANDEX_PVZ", 300),
            "🚚 Доставка в пункт выдачи Яндекса: 300 ₽",
        )

    def test_самовывоз_бесплатно(self):
        self.assertEqual(delivery_line("PICKUP", 0), "🏠 Самовывоз — бесплатно")

    def test_яндекс_без_цены_не_обещает_бесплатно(self):
        # Заказ мог быть заведён до того, как цену стали проставлять.
        # Обещать бесплатно то, что стоит денег, дороже, чем уточнить.
        out = delivery_line("YANDEX_PVZ", 0)
        self.assertIn("уточним", out)
        self.assertNotIn("бесплатно", out)

    def test_строка_никогда_не_пустая(self):
        # Пустая строка оставила бы дыру между списком и суммой.
        for method in (None, "", "PICKUP", "YANDEX_PVZ", "ЧТО-ТО"):
            for cost in (None, 0, 300):
                self.assertTrue(delivery_line(method, cost).strip())


class TestRender(unittest.TestCase):
    TEMPLATE = (
        "{greeting} Получили заявку."
        + chr(10) * 2
        + "{{СПИСОК_ТОВАРОВ}}"
        + chr(10) * 2
        + "{{ДОСТАВКА}}"
        + chr(10) * 2
        + "Сумма: {{СУММА}} ₽"
    )

    def test_полные_данные(self):
        out = render(
            self.TEMPLATE, "Пётр", "035",
            [{"title": "Фото 10×15", "quantity": 10}], 2790,
            "YANDEX_PVZ", 300,
        )
        self.assertIn("Здравствуйте, Пётр!", out)
        self.assertIn("• Фото 10×15 — 10 шт.", out)
        self.assertIn("Доставка в пункт выдачи Яндекса: 300 ₽", out)
        self.assertIn("Сумма: 2 790 ₽", out)
        self.assertNotIn("{", out)

    def test_сумма_включает_доставку(self):
        # Главное правило: названная сумма равна тому, что человек заплатит.
        out = render(
            self.TEMPLATE, "Пётр", "035",
            [{"title": "Фото", "quantity": 10}], 2490 + 300, "YANDEX_PVZ", 300,
        )
        self.assertIn("Сумма: 2 790 ₽", out)

    def test_пустые_данные_не_ломают_текст(self):
        out = render(self.TEMPLATE, None, "035", None, 0)
        self.assertIn("Здравствуйте!", out)
        self.assertIn("•", out)
        self.assertIn("—", out)
        self.assertNotIn("{", out)


if __name__ == "__main__":
    unittest.main()
