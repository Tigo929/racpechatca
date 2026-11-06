"""Чтение ответа клиента на приветствие.

Что здесь сторожится:
  * берём ответ клиента, а не своё же приветствие;
  * берём ПЕРВЫЙ ответ после приветствия, а не последнюю реплику диалога;
  * всё, что было до приветствия, к заявке не относится;
  * вложение без подписи тоже ответ — о нём должен узнать человек;
  * решение «согласие или нет» здесь не принимается: его принимает CRM.
"""
import asyncio
import unittest
from datetime import datetime, timedelta, timezone

from telethon.errors import UsernameNotOccupiedError

from reply_queue import ATTACHMENT_MARK, parse_time, read_reply

GREETED = datetime(2026, 11, 6, 10, 0, tzinfo=timezone.utc)


class FakeMessage:
    def __init__(self, text, minutes, out=False, has_text=True):
        self.message = text if has_text else None
        self.date = GREETED + timedelta(minutes=minutes)
        self.out = out


class FakeClient:
    def __init__(self, messages, entity_error=None):
        # Telethon отдаёт от новых к старым — повторяем порядок.
        self._messages = sorted(messages, key=lambda m: m.date, reverse=True)
        self._entity_error = entity_error
        self.limit = None

    async def get_entity(self, username):
        if self._entity_error:
            raise self._entity_error
        return object()

    async def get_messages(self, entity, limit=20):
        self.limit = limit
        return self._messages


def read(messages, greeted=GREETED):
    client = FakeClient(messages)
    return asyncio.run(read_reply(client, "client", greeted.isoformat()))


class ReadReplyTest(unittest.TestCase):
    def test_client_reply_is_returned(self):
        self.assertEqual(read([FakeMessage("да", 5)]), "да")

    def test_our_own_messages_are_ignored(self):
        # Приветствие отправили мы: принять его за ответ значит выставить
        # счёт человеку, который ещё ничего не сказал.
        # Время берём ПОСЛЕ приветствия: иначе проверку делала бы отсечка
        # по времени, а не признак «это написали мы».
        messages = [FakeMessage("И ещё: фото уже у нас", 1, out=True)]
        self.assertIsNone(read(messages))

    def test_first_reply_wins_not_the_last(self):
        # Человек ответил «да», а потом дописал «ой, подождите». Счёт
        # решает первый ответ — его и отдаём, остальное читает человек.
        messages = [
            FakeMessage("да", 2),
            FakeMessage("а когда будет готово?", 7),
        ]
        self.assertEqual(read(messages), "да")

    def test_messages_before_greeting_are_not_a_reply(self):
        # Переписка могла идти и раньше: старое «да» по другому поводу
        # не должно оплатить новую заявку.
        old = FakeMessage("да", -120)
        self.assertIsNone(read([old]))

    def test_attachment_without_caption_is_still_a_reply(self):
        # Клиент прислал фото без подписи. Текста нет, но ответ был —
        # CRM не признает маркер согласием и позовёт человека.
        messages = [FakeMessage(None, 3, has_text=False)]
        self.assertEqual(read(messages), ATTACHMENT_MARK)

    def test_unknown_username_is_quiet(self):
        client = FakeClient([], entity_error=UsernameNotOccupiedError(None))
        self.assertIsNone(
            asyncio.run(read_reply(client, "ghost", GREETED.isoformat()))
        )

    def test_broken_greeting_time_reads_nothing(self):
        # Без времени приветствия нельзя отличить ответ от старой переписки.
        client = FakeClient([FakeMessage("да", 5)])
        self.assertIsNone(asyncio.run(read_reply(client, "client", "вчера")))


class ParseTimeTest(unittest.TestCase):
    def test_zulu_time_gets_a_zone(self):
        parsed = parse_time("2026-11-06T10:00:00.000Z")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed, GREETED)

    def test_time_without_zone_is_treated_as_utc(self):
        # Сравнение с датой сообщения Telegram упало бы на наивном времени.
        parsed = parse_time("2026-11-06T10:00:00")
        self.assertEqual(parsed.tzinfo, timezone.utc)

    def test_garbage_is_none(self):
        self.assertIsNone(parse_time("не дата"))
        self.assertIsNone(parse_time(""))


if __name__ == "__main__":
    unittest.main()
