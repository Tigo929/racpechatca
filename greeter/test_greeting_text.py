# -*- coding: utf-8 -*-
"""Проверки текста первого сообщения. Запуск: python -m unittest discover greeter"""

import unittest

from greeting_text import greeting_for, order_line, render

TEMPLATE = "{greeting}\n\nВы оставили заявку — номер обращения {number}."


class TestGreeting(unittest.TestCase):
    def test_с_именем(self):
        self.assertEqual(greeting_for("Пётр"), "Здравствуйте, Пётр!")

    def test_без_имени(self):
        # Главное, ради чего обращение вынесено отдельной меткой:
        # «Здравствуйте, !» клиент читает как поломку.
        self.assertEqual(greeting_for(None), "Здравствуйте!")
        self.assertEqual(greeting_for(""), "Здравствуйте!")
        self.assertEqual(greeting_for("   "), "Здравствуйте!")

    def test_имя_с_пробелами(self):
        self.assertEqual(greeting_for("  Анна  "), "Здравствуйте, Анна!")


class TestRender(unittest.TestCase):
    def test_подставляет_обращение_и_номер(self):
        out = render(TEMPLATE, "Пётр", "1043")
        self.assertIn("Здравствуйте, Пётр!", out)
        self.assertIn("номер обращения 1043.", out)
        self.assertNotIn("{", out)

    def test_без_имени_текст_остаётся_целым(self):
        out = render(TEMPLATE, None, "1043")
        self.assertIn("Здравствуйте!", out)
        self.assertIn("1043", out)
        self.assertNotIn("{", out)

    def test_метка_name_отдельно(self):
        self.assertEqual(render("привет, {name}", "Пётр", "1"), "привет, Пётр")
        self.assertEqual(render("привет, {name}", None, "1"), "привет, ")


class TestOrderLine(unittest.TestCase):
    """
    Строка заказа — то, что отличает ответ на действие от рассылки.
    Пустых мест в ней быть не должно ни при каком наборе данных.
    """

    def test_полные_данные(self):
        self.assertEqual(
            order_line("20260904-035", "Фото 10×15 с полями", 10),
            "Ваш заказ 20260904-035 — Фото 10×15 с полями, 10 шт.",
        )

    def test_без_тиража(self):
        self.assertEqual(
            order_line("035", "Холст 30×40", 0), "Ваш заказ 035 — Холст 30×40."
        )

    def test_без_позиции(self):
        # Обращение без товара: остаётся один номер, и это нормально.
        self.assertEqual(order_line("035", None, 0), "Ваш заказ 035.")
        self.assertEqual(order_line("035", "   ", 5), "Ваш заказ 035.")

    def test_нигде_не_остаётся_пустот(self):
        for product in (None, "", "  ", "Фото"):
            for qty in (0, 1, 10):
                line = order_line("035", product, qty)
                self.assertNotIn(" — ,", line)
                # Именно нулевой тираж, а не любая цифра ноль:
                # «10 шт.» тоже содержит «0 шт».
                self.assertNotIn(", 0 шт", line)
                self.assertTrue(line.endswith("."))


class TestRenderFull(unittest.TestCase):
    TEMPLATE = "{greeting}" + chr(10) * 2 + "{order}" + chr(10) * 2 + "Пришлите фотографии."

    def test_все_метки_подставлены(self):
        out = render(self.TEMPLATE, "Пётр", "035", "Фото 10×15", 10)
        self.assertIn("Здравствуйте, Пётр!", out)
        self.assertIn("Ваш заказ 035 — Фото 10×15, 10 шт.", out)
        self.assertNotIn("{", out)

    def test_пустые_данные_не_ломают_текст(self):
        out = render(self.TEMPLATE, None, "035", None, 0)
        self.assertIn("Здравствуйте!", out)
        self.assertIn("Ваш заказ 035.", out)
        self.assertNotIn("{", out)


if __name__ == "__main__":
    unittest.main()