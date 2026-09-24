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
    // Заказ сайта: рекламная атрибуция бывает только у него.
    sourceOrder: 'WEBSITE',
    yclid: null,
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

/**
 * Второй идентификатор и честные причины пропуска (этап сквозной атрибуции).
 *
 * До этого всё, у чего не было ClientID, копилось как `no_client_id` — и три
 * сотни ручных заказов Avito, которым ClientID иметь неоткуда, выглядели в
 * отчётах поломкой. Теперь причина называет, что произошло: чинить нужно
 * только заказы сайта.
 */
describe('идентификаторы заказа', () => {
  const TARGETS = { CREATED: 'crm_created_ad', PAID: 'crm_paid_ad', CANCELLED: '' };

  it('ручной заказ без ClientID — своя причина, а не «нет ClientID»', () => {
    const snap = buildOrderSnapshot(
      order({ yandexClientId: null, sourceOrder: 'AVITO' }),
      'PAID',
      SETTINGS,
      TZ,
      false,
    );
    expect(snap).toEqual({ kind: 'skip', reason: 'manual_order_no_web_identity' });
  });

  it('заказ сайта без ClientID и без метки клика — настоящий пропуск', () => {
    const snap = buildOrderSnapshot(
      order({ yandexClientId: null, sourceOrder: 'WEBSITE' }),
      'PAID',
      SETTINGS,
      TZ,
      false,
    );
    expect(snap).toEqual({ kind: 'skip', reason: 'no_client_id' });
  });

  it('есть yclid, но канал не настроен — так и сказано, а не «нет ClientID»', () => {
    const snap = buildOrderSnapshot(
      order({ yandexClientId: null, yclid: 'ABCdef123456' }),
      'PAID',
      SETTINGS,
      TZ,
      false,
    );
    expect(snap).toEqual({ kind: 'skip', reason: 'yclid_channel_disabled' });
  });

  it('есть yclid и цель — заказ уходит офлайн-конверсией по метке клика', () => {
    const snap = buildOrderSnapshot(
      order({ yandexClientId: null, yclid: 'ABCdef123456' }),
      'PAID',
      SETTINGS,
      TZ,
      false,
      TARGETS,
    );
    expect(snap).toEqual({
      kind: 'yclid',
      status: 'PAID',
      row: {
        yclid: 'ABCdef123456',
        target: 'crm_paid_ad',
        // Время события, а не загрузки: иначе вчерашняя оплата встанет
        // в отчёт сегодняшним днём.
        dateTime: Math.floor(new Date('2026-09-11T15:30:00Z').getTime() / 1000),
        price: 1500,
      },
    });
  });

  it('перехода без своей цели по yclid не отправляем', () => {
    const snap = buildOrderSnapshot(
      order({
        yandexClientId: null,
        yclid: 'ABCdef123456',
        statusHistory: [{ fromStatus: 'NEW', toStatus: 'CANCELLED' }],
      }),
      'CANCELLED',
      SETTINGS,
      TZ,
      false,
      TARGETS,
    );
    expect(snap).toEqual({ kind: 'skip', reason: 'yclid_channel_disabled' });
  });

  it('ClientID главнее: при обоих идентификаторах уходит загрузка заказов', () => {
    // Иначе один заказ дал бы и заказ CDP, и офлайн-конверсию — двойной счёт.
    const snap = buildOrderSnapshot(
      order({ yclid: 'ABCdef123456' }),
      'PAID',
      SETTINGS,
      TZ,
      false,
      TARGETS,
    );
    expect(snap.kind).toBe('row');
  });

  it('мусорный yclid не выдаётся за метку клика', () => {
    const snap = buildOrderSnapshot(
      order({ yandexClientId: null, yclid: 'нет' }),
      'PAID',
      SETTINGS,
      TZ,
      false,
      TARGETS,
    );
    expect(snap).toEqual({ kind: 'skip', reason: 'no_client_id' });
  });
});
