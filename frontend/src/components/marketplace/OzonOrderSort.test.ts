import { describe, expect, it } from 'vitest';
import { formatAccepted, sortByAccepted } from './ozon-order-sort';

/**
 * Очередь отправлений.
 *
 * Макеты делают в порядке прихода заказов, и список должен совпадать
 * с кабинетом Ozon строка в строку. Если порядок «поплывёт», оператор снова
 * начнёт сверять время у каждой строки — ровно то, от чего уходили.
 */

const order = (postingNumber: string, createdAt: string | null) => ({
  postingNumber,
  createdAt,
});

describe('порядок по времени приёма', () => {
  const list = [
    order('15690855-0274-1', '2026-10-07T10:06:00Z'),
    order('0151387649-0013-1', '2026-10-06T17:19:00Z'),
    order('51321756-0445-1', '2026-10-06T22:55:00Z'),
  ];

  it('сначала ранние — первым идёт тот, что пришёл раньше всех', () => {
    expect(sortByAccepted(list, 'earliest').map((o) => o.postingNumber)).toEqual([
      '0151387649-0013-1',
      '51321756-0445-1',
      '15690855-0274-1',
    ]);
  });

  it('сначала поздние — порядок разворачивается целиком', () => {
    expect(sortByAccepted(list, 'latest').map((o) => o.postingNumber)).toEqual([
      '15690855-0274-1',
      '51321756-0445-1',
      '0151387649-0013-1',
    ]);
  });

  it('исходный список не трогаем: его читает соседний экран', () => {
    const before = list.map((o) => o.postingNumber);
    sortByAccepted(list, 'latest');
    expect(list.map((o) => o.postingNumber)).toEqual(before);
  });

  it('отправления одного заказа идут по номеру, а не как придётся', () => {
    // У них одно и то же время приёма: без второго признака список
    // переставлялся бы при каждом обновлении.
    const same = [
      order('08092213-0275-3', '2026-10-07T13:35:00Z'),
      order('08092213-0275-1', '2026-10-07T13:35:00Z'),
    ];
    expect(sortByAccepted(same, 'earliest').map((o) => o.postingNumber)).toEqual([
      '08092213-0275-1',
      '08092213-0275-3',
    ]);
    expect(sortByAccepted(same, 'latest').map((o) => o.postingNumber)).toEqual([
      '08092213-0275-1',
      '08092213-0275-3',
    ]);
  });

  it('без времени приёма — в конец при любом порядке: места в очереди нет', () => {
    const withGap = [
      order('нет-времени', null),
      order('ранний', '2026-10-06T17:19:00Z'),
      order('поздний', '2026-10-07T10:06:00Z'),
    ];
    expect(sortByAccepted(withGap, 'earliest').map((o) => o.postingNumber)).toEqual([
      'ранний',
      'поздний',
      'нет-времени',
    ]);
    expect(sortByAccepted(withGap, 'latest').map((o) => o.postingNumber)).toEqual([
      'поздний',
      'ранний',
      'нет-времени',
    ]);
  });

  it('битая дата не ломает список', () => {
    const broken = [order('битый', 'не дата'), order('целый', '2026-10-06T17:19:00Z')];
    expect(() => sortByAccepted(broken, 'earliest')).not.toThrow();
  });
});

describe('подпись времени', () => {
  it('пишется как в кабинете: «6 окт 17:19»', () => {
    // Берём местное время: в кабинете оператор видит своё, и колонки
    // сверяются глазами.
    const d = new Date(2026, 9, 6, 17, 19);
    expect(formatAccepted(d.toISOString())).toBe('6 окт 17:19');
  });

  it('часы и минуты всегда двузначные', () => {
    expect(formatAccepted(new Date(2026, 9, 8, 4, 5).toISOString())).toBe(
      '8 окт 04:05',
    );
  });

  it('времени нет — прочерк, а не «Invalid Date»', () => {
    expect(formatAccepted(null)).toBe('—');
    expect(formatAccepted('не дата')).toBe('—');
  });
});
