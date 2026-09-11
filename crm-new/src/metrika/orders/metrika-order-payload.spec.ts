import { costSettingsFrom } from 'src/reports/order-cogs';
import {
  buildOrderSnapshot,
  maskClientId,
  type OrderForMetrika,
} from './metrika-order-payload';

/**
 * Снимок заказа для Метрики (этап 06, разделы 7–12, 23–27, 53).
 */
const SETTINGS = costSettingsFrom(null);
const TZ = 'Europe/Moscow';

function order(partial: Partial<OrderForMetrika> = {}): OrderForMetrika {
  return {
    id: 'order-1',
    createdAt: new Date('2026-09-11T15:30:00Z'),
    status: 'PAID',
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
  it('строка: id заказа, дата в поясе счётчика, ClientID строкой, статус, сумма, себестоимость', () => {
    const snap = buildOrderSnapshot(order(), SETTINGS, TZ, false);
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

  it('revenue — totalOrder целиком (с доставкой, дизайном, срочностью), что платит клиент', () => {
    const snap = buildOrderSnapshot(order({ totalOrder: 2345 }), SETTINGS, TZ, false);
    expect(snap.kind === 'row' && snap.row.revenue).toBe(2345);
  });

  it('дата создания не подменяется датой оплаты и не зависит от статуса', () => {
    const a = buildOrderSnapshot(order({ status: 'NEW' }), SETTINGS, TZ, false);
    const b = buildOrderSnapshot(order({ status: 'PAID' }), SETTINGS, TZ, false);
    expect(a.kind === 'row' && a.row.createDateTime).toBe('2026-09-11 18:30:00');
    expect(b.kind === 'row' && b.row.createDateTime).toBe('2026-09-11 18:30:00');
  });

  it('себестоимость ненадёжна (нет позиций) — cost пустой, а не ноль', () => {
    const snap = buildOrderSnapshot(order({ items: [] }), SETTINGS, TZ, false);
    expect(snap).toMatchObject({ kind: 'row', costReliable: false, row: { cost: null } });
  });

  it('статус берётся из текущего состояния заказа', () => {
    expect(
      buildOrderSnapshot(order({ status: 'IN_PROGRESS' }), SETTINGS, TZ, false),
    ).toMatchObject({ status: 'IN_PROGRESS' });
    expect(
      buildOrderSnapshot(order({ status: 'CANCELLED' }), SETTINGS, TZ, false),
    ).toMatchObject({ status: 'CANCELLED' });
  });
});

describe('пропуски', () => {
  it('без ClientID — skip no_client_id (телефон и почта из note не используются)', () => {
    expect(buildOrderSnapshot(order({ yandexClientId: null }), SETTINGS, TZ, false)).toEqual({
      kind: 'skip',
      reason: 'no_client_id',
    });
    expect(buildOrderSnapshot(order({ yandexClientId: '  ' }), SETTINGS, TZ, false)).toEqual({
      kind: 'skip',
      reason: 'no_client_id',
    });
  });

  it('ClientID не из цифр — skip invalid_client_id', () => {
    expect(
      buildOrderSnapshot(order({ yandexClientId: '12ab' }), SETTINGS, TZ, false),
    ).toEqual({ kind: 'skip', reason: 'invalid_client_id' });
  });

  it('LEAD — skip not_eligible_lead', () => {
    expect(
      buildOrderSnapshot(order({ status: 'LEAD', statusHistory: [] }), SETTINGS, TZ, false),
    ).toEqual({ kind: 'skip', reason: 'not_eligible_lead' });
  });

  it('отклонённая заявка — skip not_eligible_rejected_lead', () => {
    expect(
      buildOrderSnapshot(
        order({
          status: 'CANCELLED',
          statusHistory: [{ fromStatus: 'LEAD', toStatus: 'CANCELLED' }],
        }),
        SETTINGS,
        TZ,
        false,
      ),
    ).toEqual({ kind: 'skip', reason: 'not_eligible_rejected_lead' });
  });

  it('право проверяется раньше ClientID: у заявки без ClientID причина — «заявка»', () => {
    expect(
      buildOrderSnapshot(
        order({ status: 'LEAD', yandexClientId: null, statusHistory: [] }),
        SETTINGS,
        TZ,
        false,
      ),
    ).toEqual({ kind: 'skip', reason: 'not_eligible_lead' });
  });
});

describe('маскирование ClientID для логов', () => {
  it('показывает четыре цифры и длину', () => {
    expect(maskClientId('17263548291736450123')).toBe('1726…(20 цифр)');
    expect(maskClientId('12')).toBe('****');
  });
});
