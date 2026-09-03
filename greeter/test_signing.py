# -*- coding: utf-8 -*-
"""Подпись запросов к CRM. Запуск: python -m unittest test_signing"""

import hmac
import unittest
from hashlib import sha256

from signing import sign


class TestSign(unittest.TestCase):
    SECRET = "s3cret"

    def test_совпадает_с_правилом_сервера(self):
        # Ровно то, что считает site-lead-token.guard.ts: hmac(«метка.тело»).
        body = '{"id":"x"}'
        headers = sign(self.SECRET, body, timestamp=1700000000)
        expected = hmac.new(
            self.SECRET.encode(), f"1700000000.{body}".encode(), sha256
        ).hexdigest()
        self.assertEqual(headers["x-lead-signature"], f"sha256={expected}")
        self.assertEqual(headers["x-lead-timestamp"], "1700000000")

    def test_пустое_тело_тоже_подписывается(self):
        # У GET тела нет, но подпись всё равно нужна: сервер проверяет
        # «метка.» и без неё в строгом режиме отвечает 401.
        headers = sign(self.SECRET, "", timestamp=1700000000)
        expected = hmac.new(
            self.SECRET.encode(), b"1700000000.", sha256
        ).hexdigest()
        self.assertEqual(headers["x-lead-signature"], f"sha256={expected}")

    def test_без_секрета_не_притворяемся(self):
        self.assertEqual(sign("", "тело"), {})

    def test_метка_меняет_подпись(self):
        a = sign(self.SECRET, "x", timestamp=1)["x-lead-signature"]
        b = sign(self.SECRET, "x", timestamp=2)["x-lead-signature"]
        self.assertNotEqual(a, b)


if __name__ == "__main__":
    unittest.main()
