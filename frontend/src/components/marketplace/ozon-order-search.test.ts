import { describe, expect, it } from 'vitest';
import {
  matchesOzonOrder,
  normalizeSearch,
  type SearchableOzonOrder,
} from './ozon-order-search';

/**
 * Поиск отправления.
 *
 * Проверяем не вид строки, а то, что человек реально вставляет в поле:
 * номер из кабинета, номер из письма, наш номер, ссылку на чат, ник в
 * Telegram — с дефисами и без, со схемой и без, с «собакой» и без.
 * Если хоть один из этих способов перестанет находить заказ, человек
 * вернётся к перелистыванию двухсот строк глазами.
 */

const order = (over: Partial<SearchableOzonOrder> = {}): SearchableOzonOrder => ({
  postingNumber: '88870356-0049-1',
  orderNumber: '88870356-0049',
  crm: {
    numberOrder: '20261002-016',
    urlCommunication: 'https://seller.ozon.ru/app/chat/88870356-0049',
    clientTelegram: '@ivan_petrov',
  },
  ...over,
});

describe('что принимает строка поиска', () => {
  it('номер отправления и номер заказа Ozon', () => {
    expect(matchesOzonOrder(order(), '88870356-0049-1')).toBe(true);
    expect(matchesOzonOrder(order(), '88870356-0049')).toBe(true);
  });

  it('номер заказа в CRM', () => {
    expect(matchesOzonOrder(order(), '20261002-016')).toBe(true);
  });

  it('часть номера — чтобы не набирать целиком', () => {
    expect(matchesOzonOrder(order(), '0049')).toBe(true);
  });

  it('номер без дефисов', () => {
    // Из письма или из разговора номер часто приходит одной строкой цифр.
    expect(matchesOzonOrder(order(), '888703560049')).toBe(true);
  });

  it('номер с ведущим нулём, набранный без него', () => {
    expect(
      matchesOzonOrder(
        order({ orderNumber: '0148856258-0138', postingNumber: '0148856258-0138-1' }),
        '148856258-0138',
      ),
    ).toBe(true);
  });

  it('ссылка на переписку Ozon', () => {
    expect(matchesOzonOrder(order(), 'seller.ozon.ru/app/chat/88870356-0049')).toBe(true);
  });

  it('Telegram в любом написании', () => {
    for (const q of ['@ivan_petrov', 'ivan_petrov', 'https://t.me/ivan_petrov', 'IVAN_PETROV']) {
      expect(matchesOzonOrder(order(), q)).toBe(true);
    }
  });

  it('Telegram ищется и когда в заказе он записан ссылкой', () => {
    const withLink = order({
      crm: { numberOrder: '20261002-016', clientTelegram: 'https://t.me/ivan_petrov' },
    });
    expect(matchesOzonOrder(withLink, '@ivan_petrov')).toBe(true);
  });
});

describe('чего поиск делать не должен', () => {
  it('пустой запрос не прячет список', () => {
    expect(matchesOzonOrder(order(), '')).toBe(true);
    expect(matchesOzonOrder(order(), '   ')).toBe(true);
  });

  it('чужой номер не находится', () => {
    expect(matchesOzonOrder(order(), '12345678-0001')).toBe(false);
    expect(matchesOzonOrder(order(), 'petrov_ivan')).toBe(false);
  });

  it('короткий обрывок цифр не притягивает всё подряд', () => {
    // «88» есть в номере, но по двум символам поиск отдавал бы половину
    // списка — это не поиск, а случайная выборка.
    expect(matchesOzonOrder(order({ postingNumber: '77-1', orderNumber: '77' }), '12')).toBe(false);
  });

  it('заказ без CRM ищется по номерам площадки', () => {
    const fresh = order({ crm: null });
    expect(matchesOzonOrder(fresh, '88870356-0049-1')).toBe(true);
    expect(matchesOzonOrder(fresh, '20261002-016')).toBe(false);
  });
});

describe('приведение к голому виду', () => {
  it('снимает схему, домен Telegram, собаку и регистр', () => {
    expect(normalizeSearch('  HTTPS://t.me/@Ivan  ')).toBe('ivan');
    expect(normalizeSearch('@Ivan')).toBe('ivan');
    expect(normalizeSearch('https://telegram.me/Ivan')).toBe('ivan');
  });
});
