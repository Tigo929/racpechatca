import { costSettingsFrom, orderCostOfGoods } from '../../reports/order-cogs';
import { buildPnl, type OrderRow } from '../../reports/reports.service';
import { customPeriod } from './analytics-period';
import {
  computeOverview,
  computeProducts,
  computeSalesChannels,
  computeSources,
  computeUtm,
  crmPeriodSets,
  withLifecycles,
  type CrmOrderInput,
  type MetrikaPeriodInput,
  type OverviewInputs,
} from './metrics-compute';

/**
 * Чистые вычисления метрик (этап 08, разделы 15–18, 43–46): взвешенные
 * конверсии из итогов, уникальные периода только из снимка, когорты против
 * событий, отмена после принятия, финансы = формула отчёта.
 */
const T = (iso: string) => new Date(iso);
const settings = costSettingsFrom(null);
const GOALS = { lead: 611379890, created: 596990603, paid: 596990604 };
const PERIOD = customPeriod('2026-09-01', '2026-09-07');
const PREV = customPeriod('2026-08-25', '2026-08-31');
const NOW = T('2026-09-08T09:00:00Z');

function photoOrder(over: Partial<CrmOrderInput> = {}): CrmOrderInput {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    createdAt: T('2026-09-02T09:00:00Z'),
    status: 'NEW',
    productCategory: 'PHOTO',
    sourceOrder: 'LOCAL',
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

const lead = (over: Partial<CrmOrderInput> = {}) =>
  photoOrder({ status: 'LEAD', ...over });

function metrika(
  traffic: MetrikaPeriodInput['traffic'],
  goals: MetrikaPeriodInput['goals'] = [],
  snapshot: MetrikaPeriodInput['snapshot'] = null,
): MetrikaPeriodInput {
  return {
    traffic,
    goals,
    pagesPageviews: traffic.reduce((s, r) => s + r.pageviews, 0) + 10,
    snapshot,
  };
}

function inputs(over: Partial<OverviewInputs> = {}): OverviewInputs {
  return {
    period: PERIOD,
    previousPeriod: PREV,
    now: NOW,
    goalIds: GOALS,
    settings,
    lastMetrikaSyncAt: T('2026-09-08T08:30:00Z'),
    current: { metrika: metrika([]), pnl: null },
    orders: [],
    ...over,
  };
}

describe('воронка сайта — конверсии из итогов', () => {
  it('день 1/1 и день 1/9 → 20 %, не среднее дневных', () => {
    const o = computeOverview(
      inputs({
        current: {
          metrika: metrika(
            [
              { date: '2026-09-01', visits: 1, users: 1, pageviews: 3 },
              { date: '2026-09-02', visits: 9, users: 9, pageviews: 20 },
            ],
            [
              { date: '2026-09-01', goalId: GOALS.lead, reaches: 1 },
              { date: '2026-09-02', goalId: GOALS.lead, reaches: 1 },
            ],
          ),
          pnl: null,
        },
      }),
    );
    expect(o.siteFunnel.visits).toBe(10);
    expect(o.siteFunnel.siteLeads).toBe(2);
    expect(o.siteFunnel.siteLeadConversion).toBe(20);
    expect(o.siteFunnel.siteLeadToAccepted).toBe(0);
    expect(o.siteFunnel.siteAcceptedToPaid).toBeNull();
  });

  it('до 13.09.2026 воронка сайта помечена partial с кодами legacy/rollout, после — complete', () => {
    const before = computeOverview(inputs());
    expect(before.siteFunnel.quality).toEqual({
      completeness: 'partial',
      notes: ['INCOMPLETE_LEGACY_SITE_LEADS', 'CRM_GOALS_BEFORE_ROLLOUT'],
    });
    const after = computeOverview(
      inputs({
        period: customPeriod('2026-09-13', '2026-09-19'),
        previousPeriod: customPeriod('2026-09-06', '2026-09-12'),
      }),
    );
    expect(after.siteFunnel.quality).toEqual({
      completeness: 'complete',
      notes: [],
    });
  });
});

describe('уникальные посетители периода', () => {
  const traffic = [
    { date: '2026-09-01', visits: 120, users: 100, pageviews: 300 },
    { date: '2026-09-02', visits: 130, users: 100, pageviews: 310 },
  ];

  it('без снимка periodUsers = null (никогда не 200), sumDailyUsers назван честно, трафик partial', () => {
    const o = computeOverview(
      inputs({ current: { metrika: metrika(traffic), pnl: null } }),
    );
    expect(o.traffic.periodUsers).toBeNull();
    expect(o.traffic.sumDailyUsers).toBe(200);
    expect(o.traffic.quality.notes).toContain('NO_PERIOD_SNAPSHOT');
    expect(JSON.stringify(o.traffic)).not.toContain('"users":200');
    expect(o.dataQuality.snapshotAvailable).toBe(false);
  });

  it('со снимком periodUsers — из снимка, а не сумма', () => {
    const o = computeOverview(
      inputs({
        current: {
          metrika: metrika(traffic, [], {
            users: 160,
            visits: 250,
            pageviews: 610,
            fetchedAt: NOW,
            sampled: false,
          }),
          pnl: null,
        },
      }),
    );
    expect(o.traffic.periodUsers).toBe(160);
    expect(o.traffic.visits).toBe(250);
    expect(o.traffic.pageviews).toBe(610);
    expect(o.traffic.pageviewsSession).toBe(610);
    expect(o.traffic.pageviewsPage).toBe(620);
  });

  it('семплированный снимок отмечается', () => {
    const o = computeOverview(
      inputs({
        current: {
          metrika: metrika(traffic, [], {
            users: 160,
            visits: 250,
            pageviews: 610,
            fetchedAt: NOW,
            sampled: true,
          }),
          pnl: null,
        },
      }),
    );
    expect(o.traffic.quality.notes).toContain('SNAPSHOT_SAMPLED');
  });
});

describe('свежесть данных Метрики', () => {
  it('моложе 2 часов — FRESH, старше — STALE (partial), нет запусков — NO_DATA (unavailable)', () => {
    expect(
      computeOverview(inputs({ lastMetrikaSyncAt: T('2026-09-08T07:30:00Z') }))
        .dataQuality.freshness,
    ).toMatchObject({ status: 'FRESH', metrikaDataAgeSeconds: 5400 });
    const stale = computeOverview(
      inputs({ lastMetrikaSyncAt: T('2026-09-08T06:00:00Z') }),
    );
    expect(stale.dataQuality.freshness.status).toBe('STALE');
    expect(stale.traffic.quality.notes).toContain('METRIKA_STALE');
    const none = computeOverview(inputs({ lastMetrikaSyncAt: null }));
    expect(none.dataQuality.freshness.status).toBe('NO_DATA');
    expect(none.traffic.quality.completeness).toBe('unavailable');
  });
});

describe('воронка CRM — события и когорты', () => {
  it('заявка периода, принятая после периода: в когорте — принята, в событиях периода — нет', () => {
    const late = lead({
      status: 'NEW',
      createdAt: T('2026-09-05T10:00:00Z'),
      statusHistory: [
        {
          fromStatus: 'LEAD',
          toStatus: 'NEW',
          createdAt: T('2026-09-09T10:00:00Z'),
        },
      ],
    });
    const o = computeOverview(inputs({ orders: [late] }));
    expect(o.crmFunnel.events).toMatchObject({
      crmLeads: 1,
      acceptedOrders: 0,
      paidOrders: 0,
    });
    expect(o.crmFunnel.cohorts).toMatchObject({
      leadCohortSize: 1,
      leadCohortAccepted: 1,
      crmLeadToAccepted: 100,
      crmLeadToPaid: 0,
    });
  });

  it('принятый в периоде и оплаченный позже: acceptedToPaid по когорте 100 %, paidOrders периода 0', () => {
    const o = computeOverview(
      inputs({
        orders: [
          photoOrder({
            status: 'PAID',
            createdAt: T('2026-09-03T10:00:00Z'),
            clientPaidAt: T('2026-09-10T10:00:00Z'),
            statusHistory: [
              {
                fromStatus: 'NEW',
                toStatus: 'PAID',
                createdAt: T('2026-09-10T10:00:00Z'),
              },
            ],
          }),
        ],
      }),
    );
    expect(o.crmFunnel.events).toMatchObject({
      acceptedOrders: 1,
      paidOrders: 0,
    });
    expect(o.crmFunnel.cohorts).toMatchObject({
      acceptedCohortSize: 1,
      acceptedCohortPaid: 1,
      crmAcceptedToPaid: 100,
    });
    expect(o.orders.paidAov).toBeNull();
    expect(o.orders.acceptedAov).toBe(1000);
  });

  it('отмена после принятия: принят = да, отменён = да, cancellationRate 50 % из двух принятых', () => {
    const cancelled = lead({
      status: 'CANCELLED',
      statusHistory: [
        {
          fromStatus: 'LEAD',
          toStatus: 'NEW',
          createdAt: T('2026-09-02T12:00:00Z'),
        },
        {
          fromStatus: 'NEW',
          toStatus: 'CANCELLED',
          createdAt: T('2026-09-04T12:00:00Z'),
        },
      ],
    });
    const kept = photoOrder({ createdAt: T('2026-09-03T12:00:00Z') });
    const o = computeOverview(inputs({ orders: [cancelled, kept] }));
    expect(o.crmFunnel.events).toMatchObject({
      crmLeads: 1,
      acceptedOrders: 2,
      cancelledOrders: 1,
    });
    expect(o.crmFunnel.cohorts.crmCancellationRate).toBe(50);
  });

  it('заявка, отменённая без принятия, не считается принятой', () => {
    const o = computeOverview(
      inputs({
        orders: [
          lead({
            status: 'CANCELLED',
            statusHistory: [
              {
                fromStatus: 'LEAD',
                toStatus: 'CANCELLED',
                createdAt: T('2026-09-03T12:00:00Z'),
              },
            ],
          }),
        ],
      }),
    );
    expect(o.crmFunnel.events).toMatchObject({
      crmLeads: 1,
      acceptedOrders: 0,
      cancelledOrders: 1,
    });
    expect(o.crmFunnel.cohorts.crmLeadToAccepted).toBe(0);
  });

  it('оператор создал сразу NEW — принят, но не заявка; PAID без даты — не оплачен, но помечен', () => {
    const direct = photoOrder({ createdAt: T('2026-09-02T09:00:00Z') });
    const noDate = photoOrder({
      status: 'PAID',
      createdAt: T('2026-09-02T10:00:00Z'),
      statusChangedAt: T('2026-09-03T10:00:00Z'),
    });
    const o = computeOverview(inputs({ orders: [direct, noDate] }));
    expect(o.crmFunnel.events).toMatchObject({
      crmLeads: 0,
      acceptedOrders: 2,
      paidOrders: 0,
    });
    expect(o.orders.paidWithoutDate).toBe(1);
    expect(o.orders.quality.notes).toContain('PAID_WITHOUT_DATE');
  });

  it('пустой период: все доли null, счётчики 0', () => {
    const o = computeOverview(inputs());
    expect(o.crmFunnel.cohorts).toMatchObject({
      crmLeadToAccepted: null,
      crmAcceptedToPaid: null,
      crmCancellationRate: null,
    });
    expect(o.orders).toMatchObject({
      acceptedAov: null,
      paidAov: null,
      headlineAov: null,
    });
    expect(o.siteFunnel.siteLeadConversion).toBeNull();
  });
});

describe('границы суток по Москве для событий CRM', () => {
  it('принятие в 20:59:59 UTC — в этом дне, в 21:00:00 UTC — уже в следующем', () => {
    const day = customPeriod('2026-09-03', '2026-09-03');
    const a = photoOrder({ createdAt: T('2026-09-03T20:59:59.999Z') });
    const b = photoOrder({ createdAt: T('2026-09-03T21:00:00.000Z') });
    const sets = crmPeriodSets(withLifecycles([a, b]), day);
    expect(sets.accepted.map((o) => o.order.id)).toEqual([a.id]);
    const next = crmPeriodSets(
      withLifecycles([a, b]),
      customPeriod('2026-09-04', '2026-09-04'),
    );
    expect(next.accepted.map((o) => o.order.id)).toEqual([b.id]);
  });
});

describe('финансы', () => {
  const paidOrder = photoOrder({
    status: 'PAID',
    createdAt: T('2026-09-02T09:00:00Z'),
    clientPaidAt: T('2026-09-04T09:00:00Z'),
    totalOrder: 1300,
    items: [
      {
        formatPaper: '10x15',
        quantity: 100,
        pricePosition: 10,
        printOnClientItem: false,
        thermalCost: 0,
      },
    ],
  });
  const tshirt = photoOrder({
    status: 'NEW',
    productCategory: 'TSHIRT',
    sourceOrder: 'AVITO',
    createdAt: T('2026-09-03T09:00:00Z'),
    totalOrder: 2500,
    items: [],
    tshirtItems: [
      {
        pricePosition: 2500,
        quantity: 1,
        designCost: 0,
        thermalCost: 300,
        blankCost: 700,
        clientItem: false,
      },
    ],
  });
  const noItems = photoOrder({
    createdAt: T('2026-09-03T11:00:00Z'),
    totalOrder: 500,
    items: [],
  });

  it('contractValue/paidOrderValue/COGS считаются по тем же order-cogs; ненадёжная себестоимость помечается', () => {
    const o = computeOverview(inputs({ orders: [paidOrder, tshirt, noItems] }));
    const expectedCogs =
      orderCostOfGoods(paidOrder, settings).rub +
      orderCostOfGoods(tshirt, settings).rub +
      orderCostOfGoods(noItems, settings).rub;
    expect(o.financials.contract).toEqual({
      orders: 3,
      contractValue: 4300,
      cogs: expectedCogs,
      grossContribution: 4300 - expectedCogs,
      cogsReliableOrders: 2,
    });
    expect(o.financials.paid).toEqual({
      orders: 1,
      paidOrderValue: 1300,
      cogs: orderCostOfGoods(paidOrder, settings).rub,
      grossContribution: 1300 - orderCostOfGoods(paidOrder, settings).rub,
    });
    expect(o.financials.quality.notes).toEqual([
      'COGS_UNRELIABLE_ORDERS',
      'PNL_UNAVAILABLE',
    ]);
    expect(o.financials.spend.status).toBe('UNAVAILABLE_NO_SPEND_DATA');
    expect(o.financials.currency).toBe('RUB');
  });

  it('realized* — ровно числа P&L отчёта (buildPnl), никакой второй формулы', () => {
    const rows: OrderRow[] = [
      {
        ...paidOrder,
        deliveryCost: 300,
        deliveryMethod: 'YANDEX_PVZ',
        accruals: [{ salaryAmount: 150 }],
      },
    ];
    const pnl = buildPnl(
      rows,
      [
        {
          createdAt: T('2026-09-05T00:00:00Z'),
          amount: 700,
          category: 'MARKETING',
        },
      ],
      [{ amount: 100 }],
      settings,
    );
    const o = computeOverview(
      inputs({ orders: [paidOrder], current: { metrika: metrika([]), pnl } }),
    );
    const r = o.financials.realized!;
    expect(r.orders).toBe(pnl.orderCount);
    expect(r.realizedRevenue).toBe(1300);
    expect(r.realizedGoodsRevenue).toBe(1000);
    expect(r.cogs).toBe(pnl.cogs);
    expect(r.grossContribution).toBe(pnl.grossProfit);
    expect(r.salaryAccrued).toBe(150);
    expect(r.operatingExpenses).toBe(700);
    expect(r.deliveryProfit).toBe(300 - settings.deliveryCostYandexPvz);
    expect(r.netProfit).toBe(pnl.netProfit);
    expect(r.netProfit).toBe(pnl.grossProfit - 700 - 150 + r.deliveryProfit);
    expect(r.marginPct).toBeCloseTo((pnl.netProfit / 1300) * 100, 10);
    expect(o.financials.quality.completeness).toBe('complete');
  });

  it('товары — по productCategory и реальным позициям; каналы продаж — по sourceOrder', () => {
    const all = withLifecycles([paidOrder, tshirt, noItems]);
    const products = computeProducts(all, PERIOD, settings);
    const photo = products.rows.find((r) => r.productCategory === 'PHOTO')!;
    const ts = products.rows.find((r) => r.productCategory === 'TSHIRT')!;
    expect(photo).toMatchObject({
      acceptedOrders: 2,
      paidOrders: 1,
      contractValue: 1800,
      paidOrderValue: 1300,
      cogsReliableOrders: 1,
      paidAov: 1300,
      acceptedAov: 900,
    });
    expect(ts).toMatchObject({
      acceptedOrders: 1,
      paidOrders: 0,
      contractValue: 2500,
      cogs: orderCostOfGoods(tshirt, settings).rub,
      paidAov: null,
    });
    expect(
      products.rows.find((r) => r.productCategory === 'CANVAS'),
    ).toMatchObject({ acceptedOrders: 0, contractValue: 0 });
    const channels = computeSalesChannels(all, PERIOD);
    expect(channels.rows.find((r) => r.salesChannel === 'AVITO')).toMatchObject(
      { acceptedOrders: 1, contractValue: 2500 },
    );
    expect(channels.rows.find((r) => r.salesChannel === 'LOCAL')).toMatchObject(
      { acceptedOrders: 2, paidOrders: 1, paidOrderValue: 1300 },
    );
  });
});

describe('покрытие ClientID и сопоставление', () => {
  it('eligible — принятые после включения воркера и с ClientID; coverage по ним', () => {
    const before = photoOrder({
      createdAt: T('2026-09-02T09:00:00Z'),
      yandexClientId: '111',
    });
    const after = photoOrder({
      createdAt: T('2026-09-13T09:00:00Z'),
      yandexClientId: '222',
      deliveredToMetrika: true,
    });
    const afterNoId = photoOrder({ createdAt: T('2026-09-13T10:00:00Z') });
    const period = customPeriod('2026-09-01', '2026-09-14');
    const o = computeOverview(
      inputs({
        period,
        previousPeriod: customPeriod('2026-08-18', '2026-08-31'),
        orders: [before, after, afterNoId],
      }),
    );
    expect(o.dataQuality.clientIdCoverageAccepted).toBeCloseTo(
      (2 / 3) * 100,
      10,
    );
    expect(o.dataQuality.eligibleAccepted).toBe(1);
    expect(o.dataQuality.eligibleDeliveredToMetrika).toBe(1);
    expect(o.dataQuality.metrikaMatchCoverage).toBe(100);
    expect(o.dataQuality.clientIdCoveragePaid).toBeNull();
  });
});

describe('сравнение с предыдущим периодом', () => {
  it('previous 0 → NEW; обе стороны заполнены → проценты; нет снимков → NA', () => {
    const cur = metrika(
      [{ date: '2026-09-01', visits: 50, users: 40, pageviews: 100 }],
      [{ date: '2026-09-01', goalId: GOALS.lead, reaches: 2 }],
    );
    const prev = metrika([
      { date: '2026-08-25', visits: 25, users: 20, pageviews: 40 },
    ]);
    const o = computeOverview(
      inputs({
        current: { metrika: cur, pnl: null },
        previous: { metrika: prev, pnl: null },
      }),
    );
    expect(o.comparison?.visits).toMatchObject({
      current: 50,
      previous: 25,
      delta: 25,
      deltaPct: 100,
      changeKind: 'UP',
    });
    expect(o.comparison?.siteLeads).toMatchObject({
      changeKind: 'NEW',
      deltaPct: null,
    });
    expect(o.comparison?.periodUsers.changeKind).toBe('NA');
    expect(o.comparison?.realizedRevenue.changeKind).toBe('NA');
    expect(o.previousPeriod).toEqual(PREV);
  });

  it('без данных предыдущего периода comparison = null', () => {
    expect(computeOverview(inputs()).comparison).toBeNull();
  });
});

describe('срезы Метрики', () => {
  it('источники группируются по коду, доли из итогов; пустые UTM — категория NO_UTM в итогах', () => {
    const src = computeSources(
      [
        {
          date: '2026-09-01',
          trafficSource: 'ad',
          trafficSourceName: 'Реклама',
          sourceEngine: 'ad.Директ',
          sourceEngineName: 'Директ',
          visits: 10,
          pageviews: 30,
          leadReaches: 1,
          orderCreatedReaches: 1,
          orderPaidReaches: 0,
        },
        {
          date: '2026-09-02',
          trafficSource: 'ad',
          trafficSourceName: 'Реклама',
          sourceEngine: 'ad.Директ',
          sourceEngineName: 'Директ',
          visits: 10,
          pageviews: 20,
          leadReaches: 0,
          orderCreatedReaches: 0,
          orderPaidReaches: 0,
        },
        {
          date: '2026-09-02',
          trafficSource: 'organic',
          trafficSourceName: 'Поиск',
          sourceEngine: 'organic.yandex',
          sourceEngineName: 'Яндекс',
          visits: 5,
          pageviews: 8,
          leadReaches: 1,
          orderCreatedReaches: 0,
          orderPaidReaches: 0,
        },
      ],
      PERIOD,
    );
    expect(src.rows).toHaveLength(2);
    expect(src.rows[0]).toMatchObject({
      trafficSource: 'ad',
      visits: 20,
      pageviews: 50,
      siteLeads: 1,
      matchedAccepted: 1,
      visitToLead: 5,
      leadToAccepted: 100,
    });
    expect(src.totals).toMatchObject({
      visits: 25,
      siteLeads: 2,
      visitToLead: 8,
    });

    const utm = computeUtm(
      [
        {
          date: '2026-09-01',
          utmSource: '',
          utmMedium: '',
          utmCampaign: '',
          utmContent: '',
          utmTerm: '',
          visits: 90,
          leadReaches: 1,
          orderCreatedReaches: 0,
          orderPaidReaches: 0,
        },
        {
          date: '2026-09-01',
          utmSource: 'chatgpt.com',
          utmMedium: '',
          utmCampaign: '',
          utmContent: '',
          utmTerm: '',
          visits: 10,
          leadReaches: 1,
          orderCreatedReaches: 0,
          orderPaidReaches: 0,
        },
      ],
      PERIOD,
    );
    expect(utm.rows[0]).toMatchObject({
      utmSource: 'NO_UTM',
      isNoUtm: true,
      visits: 90,
    });
    expect(utm.rows[1]).toMatchObject({
      utmSource: 'chatgpt.com',
      utmMedium: 'NO_UTM',
      isNoUtm: false,
      visitToLead: 10,
    });
    expect(utm.totals.visits).toBe(100);
    expect(utm.totals.visitToLead).toBe(2);
  });
});
