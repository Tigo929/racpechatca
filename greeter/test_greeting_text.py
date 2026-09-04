# -*- coding: utf-8 -*-
"""Текст первого сообщения. Запуск: python -m unittest test_greeting_text"""

import unittest

from greeting_text import greeting_for, items_list, money, render


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


class TestRender(unittest.TestCase):
    TEMPLATE = (
        "{greeting} Получили заявку."
        + chr(10) * 2
        + "{{СПИСОК_ТОВАРОВ}}"
        + chr(10) * 2
        + "Сумма: {{СУММА}} ₽"
    )

    def test_полные_данные(self):
        out = render(
            self.TEMPLATE, "Пётр", "035",
            [{"title": "Фото 10×15", "quantity": 10}], 2490,
        )
        self.assertIn("Здравствуйте, Пётр!", out)
        self.assertIn("• Фото 10×15 — 10 шт.", out)
        self.assertIn("Сумма: 2 490 ₽", out)
        self.assertNotIn("{", out)

    def test_пустые_данные_не_ломают_текст(self):
        out = render(self.TEMPLATE, None, "035", None, 0)
        self.assertIn("Здравствуйте!", out)
        self.assertIn("•", out)
        self.assertIn("—", out)
        self.assertNotIn("{", out)


if __name__ == "__main__":
    unittest.main()
