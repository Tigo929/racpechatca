import {
  ACCEPTED_ORDER_STATUSES,
  findSourceTransition,
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

describe('право перехода уйти в Метрику (eligibility)', () => {
  it('IN_PROGRESS и PAID — да, без оглядки на историю: сам переход означает принятие', () => {
    for (const target of ['IN_PROGRESS', 'PAID'] as const) {
      expect(orderEligibility({ target, history: [], previouslySynced: false })).toEqual({
        eligible: true,
      });
    }
  });

  it('LEAD → CANCELLED без принятия — отклонённая заявка, не отменённый заказ', () => {
    expect(
      orderEligibility({
        target: 'CANCELLED',
        history: [{ fromStatus: 'LEAD', toStatus: 'CANCELLED' }],
        previouslySynced: false,
      }),
    ).toEqual({ eligible: false, reason: 'rejected_lead' });
  });

  it('CANCELLED после NEW — отменённый заказ: правило A по toStatus', () => {
    expect(
      orderEligibility({
        target: 'CANCELLED',
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
        target: 'CANCELLED',
        history: [{ fromStatus: 'NEW', toStatus: 'CANCELLED' }],
        previouslySynced: false,
      }),
    ).toEqual({ eligible: true });
  });

  it('правило C: уже уходил в Метрику — отмена отправляется даже без истории', () => {
    expect(
      orderEligibility({ target: 'CANCELLED', history: [], previouslySynced: true }),
    ).toEqual({ eligible: true });
  });

  it('CANCELLED вовсе без истории и без синхронизации — не отправляем', () => {
    expect(
      orderEligibility({ target: 'CANCELLED', history: [], previouslySynced: false }),
    ).toEqual({ eligible: false, reason: 'rejected_lead' });
  });

  it('история после перехода не учитывается: отклонённая заявка, позже возвращённая в работу', () => {
    // LEAD → CANCELLED (эта строка), затем CANCELLED → NEW. Право на отмену
    // решается тем, что было ДО неё — воркер передаёт историю до перехода.
    const upToCancel = [{ fromStatus: 'LEAD', toStatus: 'CANCELLED' }];
    expect(
      orderEligibility({ target: 'CANCELLED', history: upToCancel, previouslySynced: false }),
    ).toEqual({ eligible: false, reason: 'rejected_lead' });
  });
});

describe('источник контрольной отправки (live write)', () => {
  const at = (s: string) => new Date(s);
  // История заказа 20260909-091 на бою (12.09.2026).
  const history = [
    { id: 'h1', fromStatus: 'LEAD', toStatus: 'NEW', createdAt: at('2026-09-09T11:49:00Z') },
    { id: 'h2', fromStatus: 'NEW', toStatus: 'FOLDER_STRUCTURE_CREATED', createdAt: at('2026-09-11T12:48:00Z') },
    { id: 'h3', fromStatus: 'FOLDER_STRUCTURE_CREATED', toStatus: 'NEW', createdAt: at('2026-09-11T14:15:00Z') },
  ];

  it('для IN_PROGRESS — реальный переход LEAD → NEW, а не внутренние шаги', () => {
    expect(findSourceTransition(history, 'IN_PROGRESS')?.id).toBe('h1');
  });

  it('для PAID берётся последний переход в PAID; при повторной оплате — самый свежий', () => {
    const paidTwice = [
      ...history,
      { id: 'h4', fromStatus: 'NEW', toStatus: 'PAID', createdAt: at('2026-09-12T10:00:00Z') },
      { id: 'h5', fromStatus: 'PAID', toStatus: 'NEW', createdAt: at('2026-09-12T11:00:00Z') },
      { id: 'h6', fromStatus: 'NEW', toStatus: 'PAID', createdAt: at('2026-09-12T12:00:00Z') },
    ];
    expect(findSourceTransition(paidTwice, 'PAID')?.id).toBe('h6');
    expect(findSourceTransition(paidTwice, 'IN_PROGRESS')?.id).toBe('h5');
  });

  it('заказ заведён сразу в NEW (истории нет) — источника нет, CLI поставит ручную строку', () => {
    expect(findSourceTransition([], 'IN_PROGRESS')).toBeNull();
    expect(
      findSourceTransition([{ fromStatus: 'NEW', toStatus: 'READY', createdAt: at('2026-09-01T00:00:00Z') }], 'IN_PROGRESS'),
    ).toBeNull();
  });
});
