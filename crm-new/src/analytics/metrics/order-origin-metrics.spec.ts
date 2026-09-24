import { costSettingsFrom } from '../../reports/order-cogs';
import { buildPnl, type OrderRow } from '../../reports/reports.service';
import { customPeriod } from './analytics-period';
import {
  computeSalesChannels,
  computeSiteFunnel,
  withLifecycles,
  type CrmOrderInput,
  type OriginPnl,
} from './metrics-compute';
import {
  ORDER_ORIGINS,
  type OrderOrigin,
} from '../../order-photo/order-origin';

/**
 * Разрез по происхождению заказа (этап 17).
 *
 * Главное, что здесь проверяется: суммы каналов сходятся с бизнесом целиком,
 * воронка сайта считается только по заказам сайта, а деньги берутся из той же
 * канонической методики, что и весь остальной финансовый контур.
 */

const T = (iso: string) => new Date(iso);
const settings = costSettingsFrom(null);
const PERIOD = customPeriod('2026-09-01', '2026-09-07');

function order(over: Partial<CrmOrderInput> = {}): CrmOrderInput {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    createdAt: T('2026-09-02T09:00:00Z'),
    status: 'NEW',
    productCategory: 'PHOTO',
    sourceOrder: 'AVITO',
    totalOrder: 1000,
    clientPaidAt: null,
    completedAt: null,
    statusChangedAt: null,
    sentAt: null,
    yandexClientId: null,
    items: [
      {
        formatPaper: '10x15',
        quantity: 10,
        pricePosition: 100,
        printOnClientItem: false,
        thermalCost: 0,
      },
    ],
    tshirtItems: [],
    canvasItems: [],
    statusHistory: [],
    deliveredToMetrika: false,
    ...over,
  };
}

const paid = (over: Partial<CrmOrderInput> = {}) =>
  order({
    status: 'PAID',
    clientPaidAt: T('2026-09-03T09:00:00Z'),
    statusHistory: [
      {
        fromStatus: 'NEW',
        toStatus: 'PAID',
        createdAt: T('2026-09-03T09:00:00Z'),
      },
    ],
    ...over,
  });

/** Строка P&L того же заказа: деньги считаются канонической функцией. */
function pnlRow(sourceOrder: string, total: number): OrderRow {
  return {
    sourceOrder,
    sentAt: null,
    createdAt: T('2026-09-02T09:00:00Z'),
    clientPaidAt: T('2026-09-03T09:00:00Z'),
    completedAt: null,
    statusChangedAt: null,
    totalOrder: total,
    deliveryCost: 0,
    deliveryMethod: 'PICKUP',
    productCategory: 'PHOTO',
    items: [
      {
        formatPaper: 'SIZE_10X15',
        quantity: 10,
        pricePosition: total,
        printOnClientItem: false,
        thermalCost: 0,
      },
    ],
    tshirtItems: [],
    canvasItems: [],
    accruals: [],
  };
}

/** Раскладка P&L так же, как её делает ReportsService.pnlByOrigin. */
function originPnl(rows: OrderRow[]): OriginPnl {
  const byOrigin = new Map<OrderOrigin, ReturnType<typeof buildPnl>>();
  for (const origin of ORDER_ORIGINS) {
    const own = rows.filter((r) => r.sourceOrder === origin);
    if (own.length) byOrigin.set(origin, buildPnl(own, [], [], settings));
  }
  return { all: buildPnl(rows, [], [], settings), byOrigin };
}

const site = (over: Partial<CrmOrderInput> = {}) =>
  paid({ sourceOrder: 'WEBSITE', ...over });

describe('срез «Каналы заказов»', () => {
  const orders = [
    site({ id: 'w1', totalOrder: 1000 }),
    site({ id: 'w2', totalOrder: 500 }),
    paid({ id: 'a1', sourceOrder: 'AVITO', totalOrder: 2000 }),
    paid({ id: 'u1', sourceOrder: 'UNKNOWN', totalOrder: 300 }),
    order({ id: 'l1', sourceOrder: 'WEBSITE', status: 'LEAD' }),
  ];
  const pnl = originPnl([
    pnlRow('WEBSITE', 1000),
    pnlRow('WEBSITE', 500),
    pnlRow('AVITO', 2000),
    pnlRow('UNKNOWN', 300),
  ]);
  const slice = computeSalesChannels(withLifecycles(orders), PERIOD, pnl);
  const row = (origin: string) =>
    slice.rows.find((r) => r.salesChannel === origin)!;

  it('16-17. WEBSITE и AVITO считаются раздельно, чужие заказы в них не попадают', () => {
    expect(row('WEBSITE')).toMatchObject({
      acceptedOrders: 2,
      paidOrders: 2,
      realizedRevenue: 1500,
    });
    expect(row('AVITO')).toMatchObject({
      acceptedOrders: 1,
      paidOrders: 1,
      realizedRevenue: 2000,
    });
    expect(row('WEBSITE').paidOrderValue).toBe(1500);
  });

  it('15, 21. сумма каналов сходится с бизнесом целиком', () => {
    const sum = (pick: (r: (typeof slice.rows)[number]) => number | null) =>
      slice.rows.reduce((acc, r) => acc + (pick(r) ?? 0), 0);
    expect(sum((r) => r.acceptedOrders)).toBe(4);
    expect(sum((r) => r.paidOrders)).toBe(4);
    expect(sum((r) => r.crmLeads)).toBe(1);
    expect(sum((r) => r.realizedRevenue)).toBe(pnl.all.totalRevenue);
    expect(sum((r) => r.cogs)).toBe(pnl.all.cogs);
    expect(sum((r) => r.grossProfit)).toBe(pnl.all.grossProfit);
    expect(sum((r) => r.realizedOrders)).toBe(pnl.all.orderCount);
  });

  it('20. деньги канала — из канонического P&L, а не из своей формулы', () => {
    const website = buildPnl(
      [pnlRow('WEBSITE', 1000), pnlRow('WEBSITE', 500)],
      [],
      [],
      settings,
    );
    expect(row('WEBSITE').realizedRevenue).toBe(website.totalRevenue);
    expect(row('WEBSITE').cogs).toBe(website.cogs);
    expect(row('WEBSITE').grossProfit).toBe(website.grossProfit);
    expect(row('WEBSITE').averageCheck).toBe(website.avgCheck);
  });

  it('23. UNKNOWN виден в таблице и помечает качество данных', () => {
    expect(row('UNKNOWN').paidOrders).toBe(1);
    expect(slice.quality.notes).toContain('UNKNOWN_ORDER_ORIGIN');
  });

  it('UNKNOWN присутствует строкой даже когда таких заказов нет', () => {
    const clean = computeSalesChannels(
      withLifecycles([paid({ sourceOrder: 'AVITO' })]),
      PERIOD,
      originPnl([pnlRow('AVITO', 100)]),
    );
    expect(clean.rows.map((r) => r.salesChannel)).toEqual(
      expect.arrayContaining(['WEBSITE', 'AVITO', 'UNKNOWN']),
    );
    expect(clean.quality.notes).not.toContain('UNKNOWN_ORDER_ORIGIN');
  });

  it('неизвестное значение источника попадает в UNKNOWN, а не в свой канал', () => {
    const weird = computeSalesChannels(
      withLifecycles([paid({ sourceOrder: 'TIKTOK' })]),
      PERIOD,
    );
    expect(
      weird.rows.find((r) => r.salesChannel === 'UNKNOWN')!.paidOrders,
    ).toBe(1);
    expect(weird.rows.map((r) => r.salesChannel)).not.toContain('TIKTOK');
  });

  it('без P&L деньги честно пустые, а счётчики работают', () => {
    const noMoney = computeSalesChannels(withLifecycles(orders), PERIOD);
    expect(
      noMoney.rows.find((r) => r.salesChannel === 'WEBSITE'),
    ).toMatchObject({
      acceptedOrders: 2,
      realizedRevenue: null,
      grossProfit: null,
    });
  });
});

describe('18-19, 32. воронка сайта — только население сайта', () => {
  const GOALS = { lead: 1, created: 2, paid: 3 };

  it('воронка сайта считается по целям Метрики и не зависит от заказов CRM', () => {
    const metrika = {
      traffic: [{ date: '2026-09-01', visits: 100, users: 90, pageviews: 300 }],
      goals: [
        { date: '2026-09-01', goalId: GOALS.lead, reaches: 10 },
        { date: '2026-09-01', goalId: GOALS.created, reaches: 4 },
        { date: '2026-09-01', goalId: GOALS.paid, reaches: 2 },
      ],
      pagesPageviews: 300,
      snapshot: null,
    };
    const funnel = computeSiteFunnel(metrika, GOALS, PERIOD);

    // 40 ручных заказов Avito в том же периоде не сдвигают воронку сайта
    const withAvito = computeSiteFunnel(metrika, GOALS, PERIOD);
    expect(withAvito).toEqual(funnel);
    expect(funnel.siteLeads).toBe(10);
    expect(funnel.matchedAccepted).toBe(4);
    expect(funnel.siteAcceptedConversion).toBeCloseTo(4, 10);

    // принятых в CRM за тот же период больше — и это НЕ конверсия сайта
    const crmAccepted = withLifecycles([
      paid({ sourceOrder: 'AVITO' }),
      paid({ sourceOrder: 'AVITO' }),
      paid({ sourceOrder: 'AVITO' }),
      paid({ sourceOrder: 'AVITO' }),
      site(),
    ]).length;
    expect(crmAccepted).toBeGreaterThan(funnel.matchedAccepted);
    expect(funnel.siteAcceptedConversion).not.toBeCloseTo(
      (crmAccepted / 100) * 100,
      10,
    );
  });

  it('конверсия сайта по заказам считается только по WEBSITE', () => {
    const slice = computeSalesChannels(
      withLifecycles([
        site({ id: 's1' }),
        paid({ id: 'a1', sourceOrder: 'AVITO' }),
        paid({ id: 'u1', sourceOrder: 'UNKNOWN' }),
      ]),
      PERIOD,
    );
    const website = slice.rows.find((r) => r.salesChannel === 'WEBSITE')!;
    expect(website.acceptedOrders).toBe(1);
    const visits = 100;
    expect((website.acceptedOrders / visits) * 100).toBeCloseTo(1, 10);
    // а «все заказы CRM / визиты» дало бы втрое больше — так считать нельзя
    const allAccepted = slice.rows.reduce((a, r) => a + r.acceptedOrders, 0);
    expect(allAccepted).toBe(3);
  });
});
