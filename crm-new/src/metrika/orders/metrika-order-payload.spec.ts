import { costSettingsFrom } from 'src/reports/order-cogs';
import {
  buildOrderSnapshot,
  maskClientId,
  type OrderForMetrika,
} from './metrika-order-payload';

/**
 * Снимок заказа для Метрики (этап 06, разделы 7–12, 23–27, 53; FIX_01 § 1–3).
 * Статус — из перехода (строки очереди), остальное — из заказа.
 */
const SETTINGS = costSettingsFrom(null);
const TZ = 'Europe/Moscow';

function order(partial: Partial<OrderForMetrika> = {}): OrderForMetrika {
  return {
    id: 'order-1',
    createdAt: new Date('2026-09-11T15:30:00Z'),
    yandexClientId: '17263548291736450123',
    totalOrder: 1500,
    productCategory: 'PHOTO',
    items: [
      { formatPaper: '10x15', quantity: 50, pricePosition: 1200, printOnClientItem: false, thermalCost: 0 },
    ],
    tshirtItems: [],
    canvasItems: [],
    statusHistory: [
      { fromStatus: 'LEAD', toStatus: 'NEW' },
      { fromStatus: 'NEW', toStatus: 'PAID' },
    ],
    ...partial,
  };
}

describe('снимок заказа', () => {
  it('строка: id заказа, дата в поясе счётчика, ClientID строкой, статус перехода, сумма, себестоимость', () => {
    const snap = buildOrderSnapshot(order(), 'PAID', SETTINGS, TZ, false);
    expect(snap).toEqual({
      kind: 'row',
      status: 'PAID',
      costReliable: true,
      row: {
        id: 'order-1',
        createDateTime: '2026-09-11 18:30:00',
        clientId: '17263548291736450123',
        status: 'PAID',
        revenue: 1500,
        cost: 80, // 50 листов × 1,6 ₽
      },
    });
  });

  it('статус берётся из перехода, а не из заказа: тот же заказ даёт IN_PROGRESS, PAID, CANCELLED по строкам', () => {
    for (const target of ['IN_PROGRESS', 'PAID', 'CANCELLED'] as const) {
      const snap = buildOrderSnapshot(order(), target, SETTINGS, TZ, false);
      expect(snap).toMatchObject({ kind: 'row', status: target, row: { status: target } });
    }
  });

  it('revenue — totalOrder целиком (с доставкой, дизайном, срочностью), что платит клиент', () => {
    const snap = buildOrderSnapshot(order({ totalOrder: 2345 }), 'PAID', SETTINGS, TZ, false);
    expect(snap.kind === 'row' && snap.row.revenue).toBe(2345);
  });

  it('дата создания не зависит от перехода и не подменяется датой оплаты', () => {
    const a = buildOrderSnapshot(order(), 'IN_PROGRESS', SETTINGS, TZ, false);
    const b = buildOrderSnapshot(order(), 'PAID', SETTINGS, TZ, false);
    expect(a.kind === 'row' && a.row.createDateTime).toBe('2026-09-11 18:30:00');
    expect(b.kind === 'row' && b.row.createDateTime).toBe('2026-09-11 18:30:00');
  });

  it('себестоимость ненадёжна (нет позиций) — cost пустой, а не ноль', () => {
    const snap = buildOrderSnapshot(order({ items: [] }), 'PAID', SETTINGS, TZ, false);
    expect(snap).toMatchObject({ kind: 'row', costReliable: false, row: { cost: null } });
  });

  it('детерминизм: одна и та же строка дважды — один и тот же файл', () => {
    const a = buildOrderSnapshot(order(), 'PAID', SETTINGS, TZ, false);
    const b = buildOrderSnapshot(order(), 'PAID', SETTINGS, TZ, false);
    expect(a).toEqual(b);
  });
});

describe('пропуски', () => {
  it('без ClientID — skip no_client_id (телефон и почта из note не используются)', () => {
    expect(buildOrderSnapshot(order({ yandexClientId: null }), 'PAID', SETTINGS, TZ, false)).toEqual({
      kind: 'skip',
      reason: 'no_client_id',
    });
    expect(buildOrderSnapshot(order({ yandexClientId: '  ' }), 'PAID', SETTINGS, TZ, false)).toEqual({
      kind: 'skip',
      reason: 'no_client_id',
    });
  });

  it('ClientID не из цифр — skip invalid_client_id', () => {
    expect(
      buildOrderSnapshot(order({ yandexClientId: '12ab' }), 'PAID', SETTINGS, TZ, false),
    ).toEqual({ kind: 'skip', reason: 'invalid_client_id' });
  });

  it('CANCELLED у никогда не принятой заявки — skip not_eligible_rejected_lead', () => {
    expect(
      buildOrderSnapshot(
        order({ statusHistory: [{ fromStatus: 'LEAD', toStatus: 'CANCELLED' }] }),
        'CANCELLED',
        SETTINGS,
        TZ,
        false,
      ),
    ).toEqual({ kind: 'skip', reason: 'not_eligible_rejected_lead' });
  });

  it('CANCELLED после принятия — отправляется', () => {
    expect(
      buildOrderSnapshot(
        order({
          statusHistory: [
            { fromStatus: 'LEAD', toStatus: 'NEW' },
            { fromStatus: 'NEW', toStatus: 'CANCELLED' },
          ],
        }),
        'CANCELLED',
        SETTINGS,
        TZ,
        false,
      ),
    ).toMatchObject({ kind: 'row', status: 'CANCELLED' });
  });

  it('право проверяется раньше ClientID: отклонённая заявка без ClientID — причина «заявка»', () => {
    expect(
      buildOrderSnapshot(
        order({ yandexClientId: null, statusHistory: [{ fromStatus: 'LEAD', toStatus: 'CANCELLED' }] }),
        'CANCELLED',
        SETTINGS,
        TZ,
        false,
      ),
    ).toEqual({ kind: 'skip', reason: 'not_eligible_rejected_lead' });
  });
});

describe('маскирование ClientID для логов', () => {
  it('показывает четыре цифры и длину', () => {
    expect(maskClientId('17263548291736450123')).toBe('1726…(20 цифр)');
    expect(maskClientId('12')).toBe('****');
  });
});
