import {
  ACCEPTED_ORDER_STATUSES,
  normalizeMetrikaStatus,
  orderEligibility,
  transitionToMetrikaStatus,
} from './metrika-order-status';

/**
 * Статусы CRM → статусы Метрики (этап 06, разделы 16–22, 54).
 * Главное, что здесь охраняется: заявка не становится заказом, отклонённая
 * заявка не становится «отменённым заказом», внутренние шаги производства
 * не плодят отправок.
 */
describe('нормализация статуса', () => {
  it('LEAD — не заказ; PAID и CANCELLED — как есть; всё рабочее — IN_PROGRESS', () => {
    expect(normalizeMetrikaStatus('LEAD')).toBeNull();
    expect(normalizeMetrikaStatus(null)).toBeNull();
    expect(normalizeMetrikaStatus('PAID')).toBe('PAID');
    expect(normalizeMetrikaStatus('CANCELLED')).toBe('CANCELLED');
    for (const s of ACCEPTED_ORDER_STATUSES) {
      if (s === 'PAID') continue;
      expect(normalizeMetrikaStatus(s)).toBe('IN_PROGRESS');
    }
  });

  it('PROBLEM (строка в истории, не enum) — рабочий статус принятого заказа', () => {
    expect(normalizeMetrikaStatus('PROBLEM')).toBe('IN_PROGRESS');
  });
});

describe('переходы: что попадает в очередь', () => {
  const cases: [string | null, string, string | null][] = [
    ['LEAD', 'NEW', 'IN_PROGRESS'], // заявка стала заказом
    ['NEW', 'APPROVAL_SENT', null], // внутренний шаг — дубля нет
    ['IN_PROGRESS', 'READY', null],
    ['READY', 'PROBLEM', null],
    ['NEW', 'PAID', 'PAID'],
    ['SENT', 'PAID', 'PAID'],
    ['NEW', 'CANCELLED', 'CANCELLED'],
    ['LEAD', 'CANCELLED', 'CANCELLED'], // ставится; право решает eligibility
    ['CANCELLED', 'NEW', 'IN_PROGRESS'], // возврат в работу
    ['PAID', 'CANCELLED', 'CANCELLED'],
    ['PAID', 'NEW', 'IN_PROGRESS'], // сняли оплату — заказ снова в работе
    ['NEW', 'LEAD', null], // откат в заявку — в Метрике ничего не меняем
    [null, 'NEW', 'IN_PROGRESS'], // истории нет — считаем первым принятием
  ];
  it.each(cases)('%s → %s даёт %s', (from, to, expected) => {
    expect(transitionToMetrikaStatus(from, to)).toBe(expected);
  });
});

describe('право заказа быть в Метрике (eligibility)', () => {
  it('LEAD — нет: заявка не заказ', () => {
    expect(orderEligibility({ status: 'LEAD', history: [], previouslySynced: false })).toEqual({
      eligible: false,
      reason: 'lead',
    });
  });

  it('рабочий статус и PAID — да, без оглядки на историю', () => {
    for (const status of ['NEW', 'IN_PROGRESS', 'SENT', 'PAID', 'COMPLETED']) {
      expect(orderEligibility({ status, history: [], previouslySynced: false })).toEqual({
        eligible: true,
      });
    }
  });

  it('LEAD → CANCELLED без принятия — отклонённая заявка, не отменённый заказ', () => {
    expect(
      orderEligibility({
        status: 'CANCELLED',
        history: [{ fromStatus: 'LEAD', toStatus: 'CANCELLED' }],
        previouslySynced: false,
      }),
    ).toEqual({ eligible: false, reason: 'rejected_lead' });
  });

  it('CANCELLED после NEW — отменённый заказ: правило A по toStatus', () => {
    expect(
      orderEligibility({
        status: 'CANCELLED',
        history: [
          { fromStatus: 'LEAD', toStatus: 'NEW' },
          { fromStatus: 'NEW', toStatus: 'CANCELLED' },
        ],
        previouslySynced: false,
      }),
    ).toEqual({ eligible: true });
  });

  it('заказ, заведённый руками сразу в NEW: строки «→ NEW» нет, но fromStatus = NEW доказывает принятие', () => {
    expect(
      orderEligibility({
        status: 'CANCELLED',
        history: [{ fromStatus: 'NEW', toStatus: 'CANCELLED' }],
        previouslySynced: false,
      }),
    ).toEqual({ eligible: true });
  });

  it('правило C: уже уходил в Метрику — отмена отправляется даже без истории', () => {
    expect(
      orderEligibility({ status: 'CANCELLED', history: [], previouslySynced: true }),
    ).toEqual({ eligible: true });
  });

  it('CANCELLED вовсе без истории и без синхронизации — не отправляем', () => {
    expect(
      orderEligibility({ status: 'CANCELLED', history: [], previouslySynced: false }),
    ).toEqual({ eligible: false, reason: 'rejected_lead' });
  });
});
