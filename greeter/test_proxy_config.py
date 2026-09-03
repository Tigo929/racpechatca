# -*- coding: utf-8 -*-
"""Разбор адреса прокси. Запуск: python -m unittest test_proxy_config"""

import unittest

from proxy_config import describe, parse_proxy


class TestDescribe(unittest.TestCase):
    """Строка для лога не должна содержать логин и пароль."""

    def test_прячет_учётные_данные(self):
        out = describe("http://user:secret@10.0.0.1:3128")
        self.assertNotIn("secret", out)
        self.assertNotIn("user", out)
        self.assertIn("10.0.0.1", out)
        self.assertIn("3128", out)

    def test_без_прокси(self):
        self.assertEqual(describe(""), "напрямую, без прокси")
        self.assertEqual(describe(None), "напрямую, без прокси")


class TestParse(unittest.TestCase):
    def test_пусто_значит_напрямую(self):
        self.assertIsNone(parse_proxy(""))
        self.assertIsNone(parse_proxy(None))
        self.assertIsNone(parse_proxy("   "))

    def test_http_с_логином(self):
        p = parse_proxy("http://vasya:pass@10.0.0.1:3128")
        self.assertEqual(p["proxy_type"], "http")
        self.assertEqual(p["addr"], "10.0.0.1")
        self.assertEqual(p["port"], 3128)
        self.assertTrue(p["rdns"])
        self.assertEqual(p["username"], "vasya")
        self.assertEqual(p["password"], "pass")

    def test_socks5(self):
        p = parse_proxy("socks5://10.0.0.2:1080")
        self.assertEqual(p["proxy_type"], "socks5")
        self.assertEqual(p["addr"], "10.0.0.2")
        self.assertEqual(p["port"], 1080)

    def test_без_логина_ключей_учётных_данных_нет(self):
        # Пустые username/password python-socks трактует как попытку
        # авторизации — лучше не передавать их вовсе.
        p = parse_proxy("http://10.0.0.1:3128")
        self.assertNotIn("username", p)

    def test_порт_по_умолчанию(self):
        self.assertEqual(parse_proxy("socks5://10.0.0.2")["port"], 1080)
        self.assertEqual(parse_proxy("http://10.0.0.1")["port"], 8080)

    def test_без_схемы_считаем_http(self):
        p = parse_proxy("10.0.0.1:3128")
        self.assertEqual(p["addr"], "10.0.0.1")
        self.assertEqual(p["port"], 3128)

    def test_чужая_схема_это_ошибка(self):
        # Молча ходить напрямую нельзя: напрямую Telegram недоступен,
        # и «тихий» переход означал бы неработающий воркер без объяснения.
        with self.assertRaises(ValueError):
            parse_proxy("ftp://10.0.0.1:21")


if __name__ == "__main__":
    unittest.main()
