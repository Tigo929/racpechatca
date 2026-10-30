import {
  GREETING_ALERT_REPEAT_MS,
  greetingStuckMessage,
  shouldAlertGreetingStuck,
} from './greeting-stuck';

/**
 * Тревога о том, что приветствия не уходят.
 *
 * Проверяется граница в обе стороны. Промолчать — люди с сайта снова
 * останутся без ответа на несколько дней, как это уже было дважды.
 * Говорить слишком часто — сообщение выключат вместе со всеми
 * остальными, и следующий отказ опять пройдёт незамеченным.
 */
describe('тревога о приветствиях', () => {
  const now = new Date('2026-10-30T12:00:00Z');

  it('очередь встала и об этом ещё не говорили — говорим', () => {
    expect(
      shouldAlertGreetingStuck({ stuck: 1, lastAlertAt: null, now }),
    ).toBe(true);
  });

  it('очередь пуста — молчим', () => {
    expect(
      shouldAlertGreetingStuck({ stuck: 0, lastAlertAt: null, now }),
    ).toBe(false);
  });

  it('только что сказали — второй раз не повторяем', () => {
    const justNow = new Date(now.getTime() - 10 * 60 * 1000);
    expect(
      shouldAlertGreetingStuck({ stuck: 3, lastAlertAt: justNow, now }),
    ).toBe(false);
  });

  it('тревога не затухает: через шесть часов напоминаем', () => {
    // Отказ длится днями. Сказать один раз и замолчать — значит
    // понадеяться, что сообщение заметили в тот же час.
    const long = new Date(now.getTime() - GREETING_ALERT_REPEAT_MS);
    expect(
      shouldAlertGreetingStuck({ stuck: 2, lastAlertAt: long, now }),
    ).toBe(true);
  });
});

describe('текст тревоги', () => {
  it('называет номера заказов — по ним и пишут людям руками', () => {
    const text = greetingStuckMessage(['20261028-319', '20261028-320']);
    expect(text).toContain('20261028-319');
    expect(text).toContain('20261028-320');
    expect(text).toContain('Скопировать сообщение клиенту');
  });

  it('об одном заказе говорит в единственном числе', () => {
    // «Клиентам не ушли сообщения (1)» читается как сбой самого сообщения.
    expect(greetingStuckMessage(['20261028-319'])).toContain(
      'Клиенту с сайта не ушло первое сообщение',
    );
  });
});
