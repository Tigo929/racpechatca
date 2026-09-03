# -*- coding: utf-8 -*-
"""Проверки текста первого сообщения. Запуск: python -m unittest discover greeter"""

import unittest

from greeting_text import greeting_for, render

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


if __name__ == "__main__":
    unittest.main()
