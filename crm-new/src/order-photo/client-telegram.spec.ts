import {
  ClientTelegramError,
  normalizeClientTelegram,
} from './client-telegram';
import { waitsForAutoReview } from './review-reminder-rules';

/**
 * Telegram покупателя: один вид записи и один способ его получить.
 *
 * Менеджер вставляет в поле что попало — «@name», «name», ссылку из
 * профиля, иногда с пробелами. В заказе это должно лежать одинаково:
 * иначе один и тот же человек выглядит разными записями, а воркер,
 * которому нужен голый ник, вынужден догадываться.
 */
describe('Telegram покупателя', () => {
  it('ник, @ник и ссылка дают одну запись', () => {
    for (const value of [
      'client_name',
      '@client_name',
      '  @client_name  ',
      'https://t.me/client_name',
      't.me/client_name',
    ]) {
      expect(normalizeClientTelegram(value)).toEqual({
        stored: '@client_name',
        username: 'client_name',
      });
    }
  });

  it('пусто — это «убрать запись», а не ошибка', () => {
    // Клиент дал не тот ник: держать мусор в заказе хуже, чем ничего.
    expect(normalizeClientTelegram('')).toEqual({ stored: null, username: null });
    expect(normalizeClientTelegram('   ')).toEqual({ stored: null, username: null });
    expect(normalizeClientTelegram(null)).toEqual({ stored: null, username: null });
  });

  it('приглашение в чат и мусор отбиваются с объяснением', () => {
    /*
      t.me/+AbCd — это приглашение, а не аккаунт. Запиши его, и в карточке
      появится кнопка «написать», ведущая в пустоту, а автоматическая
      просьба об отзыве будет уходить в никуда.
    */
    for (const value of ['https://t.me/+AbCdEf', 't.me/joinchat/XXX', 'ник с пробелом', '@a']) {
      expect(() => normalizeClientTelegram(value)).toThrow(ClientTelegramError);
    }
  });
});

describe('кто отправляет просьбу об отзыве', () => {
  const marketplace = {
    isMarketplacePrint: true,
    marketplaceDeliveredAt: new Date('2026-11-04T10:00:00Z'),
    sentAt: new Date('2026-11-01T10:00:00Z'),
  };
  const now = new Date('2026-11-04T11:00:00Z');

  it('есть Telegram и попытки не было — ждём автоматику, владельца не трогаем', () => {
    /*
      Иначе владелец получит напоминание, отправит текст руками, а через
      минуту то же сообщение отправит автоматика: клиент прочитает
      просьбу об отзыве дважды.
    */
    expect(
      waitsForAutoReview(
        { ...marketplace, clientTelegram: '@client', reviewRequestStatus: null },
        now,
      ),
    ).toBe(true);
  });

  it('Telegram не записан — отправляет человек', () => {
    expect(
      waitsForAutoReview(
        { ...marketplace, clientTelegram: null, reviewRequestStatus: null },
        now,
      ),
    ).toBe(false);
  });

  it('автоматика уже пробовала — дальше человек', () => {
    for (const status of ['sent', 'privacy', 'not_found', 'blocked', 'error']) {
      expect(
        waitsForAutoReview(
          { ...marketplace, clientTelegram: '@client', reviewRequestStatus: status },
          now,
        ),
      ).toBe(false);
    }
  });

  it('воркер молчит дольше выдержки — зовём человека', () => {
    // Сессию перевыпускают, контейнер упал: ждать вечно значит не
    // отправить просьбу вообще и не узнать об этом.
    const late = new Date('2026-11-04T20:00:00Z');
    expect(
      waitsForAutoReview(
        { ...marketplace, clientTelegram: '@client', reviewRequestStatus: null },
        late,
      ),
    ).toBe(false);
  });
});
