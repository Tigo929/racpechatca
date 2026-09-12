import {
  deriveOrderLifecycle,
  type LifecycleOrder,
  type LifecycleTransition,
} from './order-lifecycle';

/**
 * Жизненный цикл заказа (этап 08, разделы 10–14, 42). История пишется
 * только на переходах, поэтому заказ, созданный сразу в NEW, истории не
 * имеет — и его принятие равно созданию.
 */
const T = (iso: string) => new Date(iso);

function order(over: Partial<LifecycleOrder> = {}): LifecycleOrder {
  return {
    createdAt: T('2026-09-01T09:00:00Z'),
    status: 'NEW',
    productCategory: 'PHOTO',
    clientPaidAt: null,
    completedAt: null,
    statusChangedAt: null,
    sentAt: null,
    ...over,
  };
}

function h(from: string | null, to: string, at: string): LifecycleTransition {
  return { fromStatus: from, toStatus: to, createdAt: T(at) };
}

describe('deriveOrderLifecycle', () => {
  it('LEAD → NEW: заявка в момент создания, принят в момент перехода', () => {
    const lc = deriveOrderLifecycle(order({ status: 'NEW' }), [
      h('LEAD', 'NEW', '2026-09-01T12:00:00Z'),
    ]);
    expect(lc).toMatchObject({
      initialStatus: 'LEAD',
      hadLeadStage: true,
      leadAt: T('2026-09-01T09:00:00Z'),
      acceptedAt: T('2026-09-01T12:00:00Z'),
      paidAt: null,
      firstCancelledAt: null,
      lastCancelledAt: null,
      currentlyCancelled: false,
      realizedAt: null,
      wasEverCancelled: false,
      paidWithoutDate: false,
    });
  });

  it('LEAD → NEW → PAID: оплата — только clientPaidAt; реализация по правилу отчёта', () => {
    const lc = deriveOrderLifecycle(
      order({
        status: 'PAID',
        clientPaidAt: T('2026-09-03T10:00:00Z'),
        statusChangedAt: T('2026-09-03T10:05:00Z'),
      }),
      [
        h('LEAD', 'NEW', '2026-09-01T12:00:00Z'),
        h('NEW', 'PAID', '2026-09-03T10:05:00Z'),
      ],
    );
    expect(lc.acceptedAt).toEqual(T('2026-09-01T12:00:00Z'));
    expect(lc.paidAt).toEqual(T('2026-09-03T10:00:00Z'));
    // recognitionDate: clientPaidAt первый в приоритете
    expect(lc.realizedAt).toEqual(T('2026-09-03T10:00:00Z'));
  });

  it('A: LEAD → NEW → CANCELLED: принят = да; first = last = момент отмены, отменён сейчас и когда-либо', () => {
    const lc = deriveOrderLifecycle(order({ status: 'CANCELLED' }), [
      h('LEAD', 'NEW', '2026-09-01T12:00:00Z'),
      h('NEW', 'CANCELLED', '2026-09-02T08:00:00Z'),
    ]);
    expect(lc.acceptedAt).toEqual(T('2026-09-01T12:00:00Z'));
    expect(lc.firstCancelledAt).toEqual(T('2026-09-02T08:00:00Z'));
    expect(lc.lastCancelledAt).toEqual(T('2026-09-02T08:00:00Z'));
    expect(lc.currentlyCancelled).toBe(true);
    expect(lc.wasEverCancelled).toBe(true);
    expect(lc.cancellationTimes).toEqual([T('2026-09-02T08:00:00Z')]);
    expect(lc.realizedAt).toBeNull();
  });

  it('E: LEAD → CANCELLED: не принят, но отменён', () => {
    const lc = deriveOrderLifecycle(order({ status: 'CANCELLED' }), [
      h('LEAD', 'CANCELLED', '2026-09-02T08:00:00Z'),
    ]);
    expect(lc.leadAt).toEqual(T('2026-09-01T09:00:00Z'));
    expect(lc.acceptedAt).toBeNull();
    expect(lc.firstCancelledAt).toEqual(T('2026-09-02T08:00:00Z'));
    expect(lc.currentlyCancelled).toBe(true);
  });

  it('C: NEW → CANCELLED → NEW → CANCELLED: first — первая, last — вторая, два события, отменён сейчас', () => {
    const lc = deriveOrderLifecycle(order({ status: 'CANCELLED' }), [
      h('NEW', 'CANCELLED', '2026-09-02T08:00:00Z'),
      h('CANCELLED', 'NEW', '2026-09-03T08:00:00Z'),
      h('NEW', 'CANCELLED', '2026-09-05T08:00:00Z'),
    ]);
    expect(lc.firstCancelledAt).toEqual(T('2026-09-02T08:00:00Z'));
    expect(lc.lastCancelledAt).toEqual(T('2026-09-05T08:00:00Z'));
    expect(lc.cancellationTimes).toHaveLength(2);
    expect(lc.currentlyCancelled).toBe(true);
    expect(lc.wasEverCancelled).toBe(true);
    expect(lc.acceptedAt).toEqual(T('2026-09-01T09:00:00Z'));
  });

  it('создан отменённым без истории: одна отмена в момент смены статуса (или создания)', () => {
    const lc = deriveOrderLifecycle(
      order({
        status: 'CANCELLED',
        statusChangedAt: T('2026-09-01T10:00:00Z'),
      }),
      [],
    );
    expect(lc.firstCancelledAt).toEqual(T('2026-09-01T10:00:00Z'));
    expect(lc.cancellationTimes).toHaveLength(1);
    expect(lc.currentlyCancelled).toBe(true);
    expect(lc.acceptedAt).toBeNull();
  });

  it('оператор создал сразу NEW: истории нет, принят в момент создания, заявкой не был', () => {
    const lc = deriveOrderLifecycle(order({ status: 'NEW' }), []);
    expect(lc).toMatchObject({
      initialStatus: 'NEW',
      hadLeadStage: false,
      leadAt: null,
      acceptedAt: T('2026-09-01T09:00:00Z'),
    });
  });

  it('оператор создал сразу NEW и позже перевёл в PAID: принят при создании, оплачен по clientPaidAt', () => {
    const lc = deriveOrderLifecycle(
      order({ status: 'PAID', clientPaidAt: T('2026-09-05T15:00:00Z') }),
      [h('NEW', 'PAID', '2026-09-05T15:01:00Z')],
    );
    expect(lc.acceptedAt).toEqual(T('2026-09-01T09:00:00Z'));
    expect(lc.paidAt).toEqual(T('2026-09-05T15:00:00Z'));
    expect(lc.hadLeadStage).toBe(false);
  });

  it('B: LEAD → NEW → CANCELLED → NEW (возврат в работу): отмена в истории остаётся, сейчас не отменён', () => {
    const lc = deriveOrderLifecycle(order({ status: 'NEW' }), [
      h('LEAD', 'NEW', '2026-09-01T12:00:00Z'),
      h('NEW', 'CANCELLED', '2026-09-02T08:00:00Z'),
      h('CANCELLED', 'NEW', '2026-09-04T09:00:00Z'),
    ]);
    expect(lc.acceptedAt).toEqual(T('2026-09-01T12:00:00Z'));
    expect(lc.firstCancelledAt).toEqual(T('2026-09-02T08:00:00Z'));
    expect(lc.lastCancelledAt).toEqual(T('2026-09-02T08:00:00Z'));
    expect(lc.currentlyCancelled).toBe(false);
    expect(lc.wasEverCancelled).toBe(true);
  });

  it('PAID → READY (вернули в работу): дата первой оплаты остаётся, выручка по статусу больше не признана', () => {
    const lc = deriveOrderLifecycle(
      order({ status: 'READY', clientPaidAt: T('2026-09-03T10:00:00Z') }),
      [
        h('NEW', 'PAID', '2026-09-03T10:00:00Z'),
        h('PAID', 'READY', '2026-09-06T10:00:00Z'),
      ],
    );
    expect(lc.paidAt).toEqual(T('2026-09-03T10:00:00Z'));
    expect(lc.realizedAt).toBeNull();
    expect(lc.acceptedAt).toEqual(T('2026-09-01T09:00:00Z'));
  });

  it('статус PAID без clientPaidAt: paidAt null, отмечен paidWithoutDate, дата не угадывается', () => {
    const lc = deriveOrderLifecycle(
      order({ status: 'PAID', statusChangedAt: T('2026-09-03T10:00:00Z') }),
      [h('NEW', 'PAID', '2026-09-03T10:00:00Z')],
    );
    expect(lc.paidAt).toBeNull();
    expect(lc.paidWithoutDate).toBe(true);
    // реализация по отчёту всё равно есть — заказ оплачен по статусу; дата признания — statusChangedAt
    expect(lc.realizedAt).toEqual(T('2026-09-03T10:00:00Z'));
  });

  it('NEW → LEAD (вернули в заявки): заявка с момента перехода, принятие — создание', () => {
    const lc = deriveOrderLifecycle(order({ status: 'LEAD' }), [
      h('NEW', 'LEAD', '2026-09-02T08:00:00Z'),
    ]);
    expect(lc.hadLeadStage).toBe(true);
    expect(lc.leadAt).toEqual(T('2026-09-02T08:00:00Z'));
    expect(lc.acceptedAt).toEqual(T('2026-09-01T09:00:00Z'));
  });

  it('заявка без истории (LEAD сейчас): leadAt = createdAt, не принят', () => {
    const lc = deriveOrderLifecycle(order({ status: 'LEAD' }), []);
    expect(lc).toMatchObject({
      initialStatus: 'LEAD',
      leadAt: T('2026-09-01T09:00:00Z'),
      acceptedAt: null,
      hadLeadStage: true,
    });
  });

  it('SENT у футболок — не реализация; SENT у фото — реализация по sentAt', () => {
    const tshirt = deriveOrderLifecycle(
      order({
        status: 'SENT',
        productCategory: 'TSHIRT',
        sentAt: T('2026-09-04T10:00:00Z'),
      }),
      [],
    );
    expect(tshirt.realizedAt).toBeNull();
    const photo = deriveOrderLifecycle(
      order({
        status: 'SENT',
        productCategory: 'PHOTO',
        sentAt: T('2026-09-04T10:00:00Z'),
      }),
      [],
    );
    expect(photo.realizedAt).toEqual(T('2026-09-04T10:00:00Z'));
  });

  it('история приходит неупорядоченной — сортируется по времени', () => {
    const lc = deriveOrderLifecycle(
      order({ status: 'PAID', clientPaidAt: T('2026-09-03T10:00:00Z') }),
      [
        h('NEW', 'PAID', '2026-09-03T10:00:00Z'),
        h('LEAD', 'NEW', '2026-09-01T12:00:00Z'),
      ],
    );
    expect(lc.initialStatus).toBe('LEAD');
    expect(lc.acceptedAt).toEqual(T('2026-09-01T12:00:00Z'));
  });
});
