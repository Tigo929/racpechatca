import { TshirtPartnerTelegramService } from './tshirt-partner-telegram.service';

/**
 * Куда уходит задание исполнителю.
 *
 * Чат и тема неразделимы: тема существует внутри своего чата. Раньше чат
 * площадки подставлялся из общего, а тема бралась своя — получалась пара,
 * которой не существует. Telegram отвечал «message thread not found»,
 * задание не уходило, и выглядело это как молчание исполнителя: макет
 * прикреплён, кнопка нажата, а печатник ничего не получил.
 */

type Env = Record<string, string | undefined>;

function routeFor(env: Env, marketplace: boolean) {
  const service = new TshirtPartnerTelegramService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { get: (key: string) => env[key] } as never,
  );
  // routeFor закрыт: обращаемся как к внутреннему устройству — проверяем
  // именно его, а не всю отправку с сетью и файлами.
  return (
    service as unknown as {
      routeFor: (m: boolean) => { chatId: string; threadId: string };
    }
  ).routeFor(marketplace);
}

const COMMON = {
  TSHIRT_PARTNER_TELEGRAM_CHAT_ID: '-100111',
  TSHIRT_PARTNER_TELEGRAM_THREAD_ID: '8',
};

describe('маршрут задания исполнителю', () => {
  it('обычный заказ идёт в общий чат и тему', () => {
    expect(routeFor(COMMON, false)).toEqual({ chatId: '-100111', threadId: '8' });
  });

  it('у площадки свой чат — идём туда вместе с её темой', () => {
    const route = routeFor(
      {
        ...COMMON,
        MARKETPLACE_PARTNER_TELEGRAM_CHAT_ID: '-100222',
        MARKETPLACE_PARTNER_TELEGRAM_THREAD_ID: '2280',
      },
      true,
    );
    expect(route).toEqual({ chatId: '-100222', threadId: '2280' });
  });

  it('чат площадки не задан — тема площадки не берётся тоже', () => {
    /*
      Ровно этот случай и стоял на бою: тема 2280 задана, чат — нет.
      Тема подставлялась к общему чату, где её нет, и пять заданий
      подряд не ушли к печатнику.
    */
    const route = routeFor(
      { ...COMMON, MARKETPLACE_PARTNER_TELEGRAM_THREAD_ID: '2280' },
      true,
    );
    expect(route).toEqual({ chatId: '-100111', threadId: '8' });
  });

  it('пустая строка в настройке — это «не задано», а не чат', () => {
    const route = routeFor(
      {
        ...COMMON,
        MARKETPLACE_PARTNER_TELEGRAM_CHAT_ID: '   ',
        MARKETPLACE_PARTNER_TELEGRAM_THREAD_ID: '2280',
      },
      true,
    );
    expect(route).toEqual({ chatId: '-100111', threadId: '8' });
  });
});
