import { customPeriod } from '../metrics/analytics-period';
import type {
  DataQualityMetrics,
  Overview,
  TrendPoint,
} from '../metrics/metrics-contract';
import {
  buildReportModel,
  weekStart,
  MIN_FORECAST_WEEKS,
} from './report-build';
import { renderMarkdown } from './report-markdown';
import { markdownToHtml, renderPrintableHtml } from './report-html';
import { lastCompleteDay } from './report-collect';
import type { PeriodSnapshot, ReportInput } from './report-contract';

/**
 * Отчёт для внешнего ИИ (этап 15).
 *
 * Проверяем три вещи, каждая из которых делает отчёт бесполезным, если сломана:
 * числа обязаны быть теми же, что у дашборда (иначе двум источникам нельзя
 * верить одновременно); пробелы в данных обязаны называться пробелами, а не
 * нулями; и в файл не должно попасть ни одного персонального данного —
 * он уедет во внешний сервис.
 */

const PERIOD = customPeriod('2026-09-15', '2026-09-21');
const PREV = customPeriod('2026-09-08', '2026-09-14');
const AVG30 = customPeriod('2026-08-23', '2026-09-21');

function quality() {
  return { completeness: 'complete' as const, notes: [] };
}

function overview(over: Partial<Overview> = {}): Overview {
  const base: Overview = {
    period: PERIOD,
    previousPeriod: PREV,
    traffic: {
      visits: 115,
      periodUsers: 76,
      sumDailyUsers: 87,
      pageviews: 400,
      pageviewsSession: 400,
      pageviewsPage: 453,
      daysWithTraffic: 7,
      quality: quality(),
    },
    siteFunnel: {
      visits: 115,
      siteLeads: 15,
      matchedAccepted: 8,
      matchedPaid: 0,
      siteLeadConversion: 13.043478260869565,
      siteAcceptedConversion: 6.96,
      sitePaidConversion: 0,
      siteLeadToAccepted: 53.3,
      siteAcceptedToPaid: 0,
      quality: quality(),
    },
    crmFunnel: {
      events: {
        crmLeads: 10,
        acceptedOrders: 36,
        paidOrders: 11,
        cancelledOrders: 0,
        cancellationEvents: 0,
        currentlyCancelledOrders: 0,
        realizedOrders: 32,
      },
      cohorts: {
        leadCohortSize: 10,
        leadCohortAccepted: 10,
        leadCohortPaid: 0,
        acceptedCohortSize: 36,
        acceptedCohortPaid: 12,
        acceptedCohortCancelled: 0,
        crmLeadToAccepted: 100,
        crmAcceptedToPaid: 33.3,
        crmLeadToPaid: 0,
        crmCancellationRate: 0,
      },
      quality: quality(),
    },
    orders: {
      acceptedOrders: 36,
      paidOrders: 11,
      cancelledOrders: 0,
      currentlyCancelledOrders: 0,
      realizedOrders: 32,
      paidWithoutDate: 1,
      acceptedAov: 1438,
      paidAov: 2669,
      headlineAov: 2669,
      quality: quality(),
    },
    financials: {
      currency: 'RUB',
      contract: {
        orders: 36,
        contractValue: 51783,
        cogs: 14000,
        grossContribution: 37783,
        cogsReliableOrders: 36,
      },
      paid: {
        orders: 11,
        paidOrderValue: 29360,
        cogs: 9000,
        grossContribution: 20360,
      },
      realized: {
        orders: 32,
        realizedRevenue: 62361,
        realizedGoodsRevenue: 58461,
        cogs: 16739,
        grossContribution: 41722,
        salaryAccrued: 8941,
        operatingExpenses: 3891,
        deliveryProfit: 1838,
        netProfit: 30728,
        marginPct: 49.27,
        byCategory: {
          photo: { orders: 12, revenue: 20000, profit: 9000 },
          tshirt: { orders: 15, revenue: 32361, profit: 17728 },
          canvas: { orders: 5, revenue: 10000, profit: 4000 },
        },
      },
      spend: {
        status: 'UNAVAILABLE_NO_SPEND_DATA',
        cpl: null,
        cpa: null,
        cpo: null,
        roas: null,
        romi: null,
      },
      quality: quality(),
    },
    dataQuality: dataQuality(),
    comparison: {} as Overview['comparison'],
    metadata: {
      timezone: 'Europe/Moscow',
      leadSemantics: 'цель «заявка»',
      pageviewSemantics: 'ym:s',
      usersSemantics: 'за период',
      aovSemantics: 'оплаченные',
      cutovers: {
        falseBrowserPurchaseStoppedAt: '2026-09-01',
        leadGoalSemanticsChangedAt: '2026-09-12',
        crmToMetrikaLiveSince: '2026-09-15',
        counterDataSince: '2026-08-01',
      },
      lastMetrikaSyncAt: new Date('2026-09-22T18:46:40.199Z'),
      generatedAt: new Date('2026-09-22T20:00:00.000Z'),
    },
  };
  return { ...base, ...over };
}

function dataQuality(
  over: Partial<DataQualityMetrics> = {},
): DataQualityMetrics {
  return {
    freshness: {
      lastMetrikaSyncAt: new Date('2026-09-22T18:46:40.199Z'),
      metrikaDataAgeSeconds: 1890,
      status: 'FRESH',
      thresholdSeconds: 7200,
    },
    clientIdCoverageAccepted: 19.4,
    clientIdCoveragePaid: 0,
    eligibleAccepted: 7,
    eligibleDeliveredToMetrika: 7,
    metrikaMatchCoverage: 100,
    matchedAcceptedReaches: 8,
    paidWithoutDate: 1,
    siteLeadsLegacy: false,
    crmGoalsBeforeRollout: false,
    snapshotAvailable: true,
    notes: [],
    ...over,
  };
}

function snapshot(
  period = PERIOD,
  over: Partial<Overview> = {},
  dq = dataQuality(),
): PeriodSnapshot {
  const ov = overview({ period, dataQuality: dq, ...over });
  return { period, overview: ov, dataQuality: dq };
}

function day(date: string, over: Partial<TrendPoint> = {}): TrendPoint {
  return {
    date,
    visits: 16,
    pageviews: 57,
    siteLeads: 2,
    matchedAccepted: 1,
    matchedPaid: 0,
    crmLeads: 1,
    acceptedOrders: 5,
    paidOrders: 2,
    realizedRevenue: 9000,
    netProfit: 4000,
    realizedOrders: 4,
    ...over,
  };
}

/** Дневной ряд заданной длины, заканчивающийся указанным днём. */
function daily(days: number, until = '2026-09-21'): TrendPoint[] {
  const out: TrendPoint[] = [];
  const end = new Date(`${until}T00:00:00.000Z`);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(day(d.toISOString().slice(0, 10)));
  }
  return out;
}

function input(over: Partial<ReportInput> = {}): ReportInput {
  const previous = snapshot(PREV, {
    traffic: {
      ...overview().traffic,
      visits: 145,
      periodUsers: 90,
      pageviews: 520,
    },
    orders: { ...overview().orders, paidOrders: 14, paidWithoutDate: 0 },
  });
  return {
    generatedAt: new Date('2026-09-22T21:00:00.000Z'),
    build: '6323bc6e715bb9dce3a18dca4464f76ea320269b',
    current: snapshot(),
    previous,
    average30: snapshot(AVG30),
    month: null,
    previousMonth: null,
    daily: daily(84),
    sources: {
      period: PERIOD,
      rows: [
        {
          trafficSource: 'ad',
          trafficSourceName: 'Переходы по рекламе',
          sourceEngine: 'ya_direct',
          sourceEngineName: 'Яндекс.Директ',
          pageviews: 200,
          visits: 58,
          siteLeads: 9,
          matchedAccepted: 5,
          matchedPaid: 0,
          visitToLead: 15.5,
          visitToAccepted: 8.6,
          visitToPaid: 0,
          leadToAccepted: 55.6,
          acceptedToPaid: 0,
        },
      ],
      totals: {
        visits: 115,
        siteLeads: 15,
        matchedAccepted: 8,
        matchedPaid: 0,
        visitToLead: 13,
        visitToAccepted: 7,
        visitToPaid: 0,
        leadToAccepted: 53,
        acceptedToPaid: 0,
      },
      quality: quality(),
    },
    utm: {
      period: PERIOD,
      rows: [
        {
          utmSource: '',
          utmMedium: '',
          utmCampaign: '',
          utmContent: '',
          utmTerm: '',
          isNoUtm: true,
          visits: 115,
          siteLeads: 15,
          matchedAccepted: 8,
          matchedPaid: 0,
          visitToLead: 13,
          visitToAccepted: 7,
          visitToPaid: 0,
          leadToAccepted: 53,
          acceptedToPaid: 0,
        },
      ],
      totals: {
        visits: 115,
        siteLeads: 15,
        matchedAccepted: 8,
        matchedPaid: 0,
        visitToLead: 13,
        visitToAccepted: 7,
        visitToPaid: 0,
        leadToAccepted: 53,
        acceptedToPaid: 0,
      },
      quality: quality(),
    },
    landings: {
      period: PERIOD,
      rows: [
        {
          normalizedPath: 'https://raspechatkaa.ru/catalog/instax?yclid=123',
          visits: 40,
          siteLeads: 6,
          matchedAccepted: 3,
          matchedPaid: 0,
          visitToLead: 15,
          visitToAccepted: 7.5,
          visitToPaid: 0,
          leadToAccepted: 50,
          acceptedToPaid: 0,
        },
      ],
      totals: {
        visits: 115,
        siteLeads: 15,
        matchedAccepted: 8,
        matchedPaid: 0,
        visitToLead: 13,
        visitToAccepted: 7,
        visitToPaid: 0,
        leadToAccepted: 53,
        acceptedToPaid: 0,
      },
      quality: quality(),
    },
    products: {
      period: PERIOD,
      rows: [
        {
          productCategory: 'PHOTO',
          acceptedOrders: 20,
          paidOrders: 5,
          cancelledOrders: 0,
          contractValue: 20000,
          paidOrderValue: 8000,
          cogs: 6000,
          cogsReliableOrders: 20,
          grossContribution: 14000,
        },
      ],
      quality: quality(),
    },
    salesChannels: {
      period: PERIOD,
      rows: [
        {
          salesChannel: 'AVITO',
          crmLeads: 0,
          acceptedOrders: 28,
          paidOrders: 10,
          cancelledOrders: 0,
          contractValue: 40000,
          paidOrderValue: 25000,
          acceptedAov: 1428,
          paidAov: 2500,
        },
      ],
      quality: quality(),
    },
    attribution: {
      totalOrders: 38,
      withClientId: 8,
      withYclid: 9,
      withUtm: 0,
      withConversionPage: 10,
      withFirstTouch: 9,
      bySource: [
        { source: 'AVITO', orders: 28, withAnyAttribution: 0 },
        { source: 'LOCAL', orders: 10, withAnyAttribution: 10 },
      ],
    },
    sync: {
      delivered: 16,
      skipped: 61,
      pending: 0,
      processing: 0,
      failed: 0,
      skipReasons: [{ reason: 'no_client_id', rows: 61 }],
      deliveredWithUploadingId: 16,
      validationPassed: 16,
      duplicateDedupeKeys: 0,
      duplicatePurchasesPerOrder: 0,
      lastDeliveredAt: new Date('2026-09-22T13:44:05.848Z'),
    },
    growth: {
      changes: [
        {
          name: 'Деплой сайта 12.09',
          status: 'ACTIVE',
          startedAt: new Date('2026-09-12T00:00:00.000Z'),
          latest: {
            version: 15,
            evaluatedAt: new Date('2026-09-21T21:27:25.602Z'),
            trigger: 'scheduler',
            verdict: 'INCOMPARABLE',
            maturity: 'MATURE',
            primaryMetric: 'siteLeadRate',
            causality: 'NOT_ESTABLISHED',
            fact: 'Конверсия визитов в заявку: до 0,91 %, после 7,89 %',
          },
        },
      ],
    },
    insights: [
      {
        detectorId: 'quality.clientIdCoverage',
        status: 'OPEN',
        version: 6,
        title: 'Покрытие ClientID у принятых заказов 19 %',
        fact: 'За 15.09.2026–21.09.2026 ClientID есть у 19 % принятых заказов',
      },
    ],
    reconciliation: {
      trendSumRealizedRevenue: 62361,
      overviewRealizedRevenue: 62361,
      monthlyPnl: {
        month: '09.2026',
        serviceRevenue: 223549,
        reportRevenue: 223549,
        serviceNetProfit: 124350,
        reportNetProfit: 124350,
        serviceCogs: 51615,
        reportCogs: 51615,
      },
    },
    ...over,
  };
}

describe('периоды и сравнение', () => {
  it('последний полный день — вчерашний по Москве, текущий день в периоды не входит', () => {
    // 23:30 UTC 22.09 = 02:30 MSK 23.09 → последний полный московский день 22.09
    expect(lastCompleteDay(new Date('2026-09-22T23:30:00.000Z'))).toBe(
      '2026-09-22',
    );
    expect(lastCompleteDay(new Date('2026-09-22T10:00:00.000Z'))).toBe(
      '2026-09-21',
    );
  });

  it('периоды выводятся явными датами, без «вчера» и «недавно»', () => {
    const md = renderMarkdown(buildReportModel(input()));
    expect(md).toContain('15.09.2026–21.09.2026');
    expect(md).toContain('08.09.2026–14.09.2026');
    expect(md).not.toMatch(/\b(вчера|сегодня|недавно)\b/i);
  });

  it('сравнение считает разницу и процент, а при отсутствии данных даёт null', () => {
    const model = buildReportModel(input());
    const visits = model.summary.find((r) => r.key === 'visits')!;
    expect(visits.current).toBe(115);
    expect(visits.previous).toBe(145);
    expect(visits.delta).toBe(-30);
    expect(visits.deltaPct).toBeCloseTo(-20.7, 1);

    const noData = buildReportModel(
      input({
        current: snapshot(PERIOD, {
          traffic: { ...overview().traffic, periodUsers: null },
        }),
      }),
    ).summary.find((r) => r.key === 'users')!;
    expect(noData.delta).toBeNull();
    expect(noData.deltaPct).toBeNull();
  });
});

describe('числа отчёта — те же, что у дашборда', () => {
  it('финансы берутся из контракта метрик без пересчёта', () => {
    const i = input();
    const model = buildReportModel(i);
    const realized = i.current.overview.financials.realized!;
    const pick = (key: string) =>
      model.summary.find((r) => r.key === key)!.current;
    expect(pick('realizedRevenue')).toBe(realized.realizedRevenue);
    expect(pick('cogs')).toBe(realized.cogs);
    expect(pick('netProfit')).toBe(realized.netProfit);
    expect(pick('marginPct')).toBe(realized.marginPct);
    expect(pick('paidOrders')).toBe(i.current.overview.orders.paidOrders);
    expect(pick('paidWithoutDate')).toBe(
      i.current.overview.orders.paidWithoutDate,
    );
    expect(pick('clientIdCoverage')).toBe(
      i.current.dataQuality.clientIdCoverageAccepted,
    );
  });

  it('сверки печатаются как есть и различают совпадение и расхождение', () => {
    expect(renderMarkdown(buildReportModel(input()))).toContain('СОВПАДАЕТ');
    const broken = renderMarkdown(
      buildReportModel(
        input({
          reconciliation: {
            trendSumRealizedRevenue: 62000,
            overviewRealizedRevenue: 62361,
            monthlyPnl: null,
          },
        }),
      ),
    );
    expect(broken).toContain('РАСХОЖДЕНИЕ');
  });
});

describe('воронки', () => {
  it('считает конверсии и отвал по шагам', () => {
    const model = buildReportModel(input());
    const [visits, leads, accepted] = model.siteFunnel;
    expect(visits.count).toBe(115);
    expect(leads.conversionFromPrevious).toBeCloseTo((15 / 115) * 100, 3);
    expect(leads.dropOff).toBe(100);
    expect(accepted.conversionFromPrevious).toBeCloseTo((8 / 15) * 100, 3);
  });

  it('называет самый большой отвал и не объясняет его причину', () => {
    const model = buildReportModel(input());
    expect(model.biggestDropOff?.name).toBe('Заявки с сайта');
    const md = renderMarkdown(model);
    expect(md).toContain('Самый большой отвал');
    expect(md).toContain('Причина отвала отчётом не устанавливается');
  });

  it('воронка CRM показывает заявки, принятие, оплату и отмены', () => {
    const md = renderMarkdown(buildReportModel(input()));
    expect(md).toContain('# CRM FUNNEL');
    for (const step of [
      'Заявки CRM (LEAD)',
      'Приняты в работу',
      'Оплачены',
      'Отменены',
    ]) {
      expect(md).toContain(step);
    }
  });
});

describe('атрибуция и качество данных', () => {
  it('печатает покрытие в процентах и честно называет ручные заказы', () => {
    const md = renderMarkdown(buildReportModel(input()));
    expect(md).toContain('# ATTRIBUTION');
    expect(md).toMatch(/ClientID Метрики \| 8 \| 21\.1 %/);
    expect(md).toContain('AVITO');
    expect(md).toContain('заводимые вручную');
  });

  it('каждый показатель качества даёт VALUE / EXPECTED / IMPACT', () => {
    const model = buildReportModel(input());
    expect(model.quality.length).toBeGreaterThanOrEqual(6);
    for (const item of model.quality) {
      expect(item.value).not.toBe('');
      expect(item.threshold).not.toBe('');
      expect(item.impact.length).toBeGreaterThan(10);
    }
    const md = renderMarkdown(model);
    expect(md).toContain('VALUE:');
    expect(md).toContain('EXPECTED:');
    expect(md).toContain('IMPACT:');
  });

  it('нет UTM — это категория NO_UTM и ограничение, а не ноль без объяснения', () => {
    const model = buildReportModel(input());
    const md = renderMarkdown(model);
    expect(md).toContain('NO_UTM');
    expect(model.constraints.join(' ')).toContain('UTM-метки отсутствуют');
  });

  it('нет ClientID — ограничение и NOT ATTRIBUTABLE по деньгам', () => {
    const model = buildReportModel(
      input({
        current: snapshot(
          PERIOD,
          {},
          dataQuality({ clientIdCoverageAccepted: 0 }),
        ),
      }),
    );
    expect(model.constraints.join(' ')).toContain('покрытие ClientID');
    expect(renderMarkdown(model)).toContain('NOT ATTRIBUTABLE');
  });

  it('paidWithoutDate виден и в сводке, и в качестве данных, и в ограничениях', () => {
    const model = buildReportModel(input());
    expect(model.summary.some((r) => r.key === 'paidWithoutDate')).toBe(true);
    expect(
      model.quality.some((q) => q.metric.includes('paidWithoutDate')),
    ).toBe(true);
    expect(model.constraints.join(' ')).toContain('без даты оплаты');
  });
});

describe('аномалии, рост и прогноз', () => {
  it('аномалия содержит метрику, базу, дельту, важность и доказательство', () => {
    const model = buildReportModel(
      input({
        current: snapshot(PERIOD, {
          traffic: { ...overview().traffic, visits: 40 },
        }),
      }),
    );
    const visits = model.anomalies.find((a) => a.metric === 'Визиты');
    expect(visits).toBeDefined();
    expect(visits!.baseline).toBe(145);
    expect(visits!.severity).toBe('WARNING');
    expect(visits!.evidence).toContain('предыдущий 145');
  });

  it('полное отсутствие оплат в периоде — критично', () => {
    const model = buildReportModel(
      input({
        current: snapshot(PERIOD, {
          orders: { ...overview().orders, paidOrders: 0 },
        }),
      }),
    );
    expect(
      model.anomalies.some(
        (a) => a.metric === 'Оплаченные заказы' && a.severity === 'CRITICAL',
      ),
    ).toBe(true);
  });

  it('INCOMPARABLE и NOT_ESTABLISHED доезжают до отчёта без смягчения', () => {
    const md = renderMarkdown(buildReportModel(input()));
    expect(md).toContain('INCOMPARABLE');
    expect(md).toContain('NOT_ESTABLISHED');
  });

  it('короткая история — прогноз не строится, а пишется прямо', () => {
    const model = buildReportModel(input({ daily: daily(14) }));
    expect(model.forecast.available).toBe(false);
    expect(model.forecast.reason).toContain(
      'INSUFFICIENT HISTORY FOR RELIABLE FORECAST',
    );
    expect(renderMarkdown(model)).toContain('INSUFFICIENT HISTORY');
  });

  it('достаточная история — прогноз с методом, уверенностью и ограничениями', () => {
    const model = buildReportModel(input());
    expect(model.weekly.length).toBeGreaterThan(MIN_FORECAST_WEEKS);
    expect(model.forecast.available).toBe(true);
    expect(model.forecast.method).not.toBe('—');
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(model.forecast.confidence);
    expect(model.forecast.limitations.length).toBeGreaterThanOrEqual(3);
    const md = renderMarkdown(model);
    expect(md).toContain('SYSTEM-GENERATED FORECAST');
    expect(md).toContain('не является обязательством');
  });

  it('недели считаются от понедельника', () => {
    expect(weekStart('2026-09-21')).toBe('2026-09-21'); // понедельник
    expect(weekStart('2026-09-20')).toBe('2026-09-14'); // воскресенье → прошлый понедельник
  });
});

describe('markdown: полнота и безопасность', () => {
  const md = renderMarkdown(buildReportModel(input()));

  it('содержит все обязательные разделы', () => {
    for (const section of [
      '## TECHNICAL CONTEXT',
      '# EXECUTIVE SUMMARY',
      '# BUSINESS HEALTH',
      '# TRAFFIC',
      '# FUNNEL',
      '# CRM FUNNEL',
      '# SALES',
      '# PRODUCTS',
      '# FINANCIALS',
      '# ATTRIBUTION',
      '# DATA QUALITY',
      '# METRIKA / CRM SYNC',
      '# PERIOD COMPARISON',
      '# TRENDS',
      '# ANOMALIES',
      '# GROWTH',
      '# FORECAST INPUT',
      '# SYSTEM-GENERATED FORECAST',
      '# DECISION CONTEXT',
      '# METRIC DEFINITIONS',
      '# INSTRUCTIONS FOR AI ANALYST',
    ]) {
      expect(md).toContain(section);
    }
  });

  it('объясняет определения, чтобы у внешнего ИИ не осталось вопросов', () => {
    for (const term of [
      'Визит (visit)',
      'Заявка CRM (crmLead)',
      'paidWithoutDate',
      'Реализованная выручка',
      'Себестоимость (COGS)',
      'Прибыль (netProfit)',
      'Покрытие ClientID',
      'INCOMPARABLE',
    ]) {
      expect(md).toContain(term);
    }
    expect(md).toContain('не бухгалтерская чистая прибыль');
  });

  it('дробные значения печатаются коротко, а не сырым числом с плавающей точкой', () => {
    // даты вида 08.2026 сюда не попадают — ищем именно дробь с длинным хвостом
    expect(md).not.toMatch(/\d+\.\d{5,}/);
    expect(md).toContain('13.0 %');
  });

  it('сигналы печатают единицы измерения, а не голые числа', () => {
    const signals = buildReportModel(input()).signals;
    const revenue = signals.find((s) => s.metric.startsWith('Выручка'))!;
    expect(revenue.statement).toContain('₽');
    const margin = signals.find((s) => s.metric === 'Маржа')!;
    expect(margin.statement).toMatch(/\d+\.\d %/);
  });

  it('в отчёте нет персональных данных', () => {
    expect(md).not.toMatch(
      /(\+7|\b8)\s?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/,
    ); // телефоны
    expect(md).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i); // почта
    expect(md).not.toMatch(/\b\d{15,}\b/); // ClientID и yclid целиком
    expect(md).not.toMatch(/\b(\d{1,3}\.){3}\d{1,3}\b/); // IP
    expect(md).not.toMatch(/yclid=\d+/); // метка клика в ссылке
    expect(md).not.toMatch(/\bимя\b|\bфамилия\b|\bтелефон клиента\b/i);
  });

  it('в отчёте нет секретов', () => {
    expect(md).not.toMatch(/y0_[\w-]+/);
    expect(md).not.toMatch(/Bearer\s+[\w.-]{20,}/);
    expect(md).not.toMatch(/eyJ[\w.-]{20,}/);
    expect(md).not.toMatch(/postgresql:\/\/[^\s]*:[^\s@]*@/);
    expect(md).not.toMatch(/JWT_SECRET|PASSWORD=|client_secret/i);
  });

  it('содержит готовую инструкцию для ИИ с пунктами задания', () => {
    expect(md).toContain(
      'Проанализируй данные этого отчёта как бизнес-аналитик',
    );
    expect(md).toContain('TOP-5 действий');
    expect(md).toContain('уровень уверенности');
    expect(md).toContain('где данных недостаточно');
  });

  it('воспроизводим: одинаковый вход — байт в байт одинаковый отчёт', () => {
    const i = input();
    expect(renderMarkdown(buildReportModel(i))).toBe(
      renderMarkdown(buildReportModel(i)),
    );
  });
});

describe('пустые и частичные данные', () => {
  it('пустой период не ломает отчёт и не выдаёт нули за данные', () => {
    const empty = snapshot(PERIOD, {
      traffic: {
        visits: 0,
        periodUsers: null,
        sumDailyUsers: 0,
        pageviews: 0,
        pageviewsSession: 0,
        pageviewsPage: 0,
        daysWithTraffic: 0,
        quality: { completeness: 'missing', notes: ['NO_DATA'] },
      },
      financials: { ...overview().financials, realized: null },
    });
    const md = renderMarkdown(
      buildReportModel(
        input({
          current: empty,
          daily: [],
          sources: { ...input().sources, rows: [] },
          utm: { ...input().utm, rows: [] },
          landings: { ...input().landings, rows: [] },
          products: { ...input().products, rows: [] },
          salesChannels: { ...input().salesChannels, rows: [] },
          insights: [],
          growth: { changes: [] },
        }),
      ),
    );
    expect(md).toContain('P&L за период недоступен');
    expect(md).toContain('Нет данных по источникам');
    expect(md).toContain('UTM-меток в периоде нет');
    expect(md).toContain('Зарегистрированных изменений нет');
    expect(md).toContain('—'); // пропуски печатаются прочерком, а не нулём
  });

  it('частичные данные: нет P&L — прибыль не выдумывается', () => {
    const model = buildReportModel(
      input({
        current: snapshot(PERIOD, {
          financials: { ...overview().financials, realized: null },
        }),
      }),
    );
    const profit = model.summary.find((r) => r.key === 'netProfit')!;
    expect(profit.current).toBeNull();
    expect(profit.deltaPct).toBeNull();
    expect(
      model.signals.find((s) => s.metric.startsWith('Прибыль'))!.kind,
    ).toBe('insufficient');
  });
});

describe('печатная версия', () => {
  const model = buildReportModel(input());
  const md = renderMarkdown(model);
  const html = renderPrintableHtml(model, md);

  it('содержит те же ключевые числа, что и markdown', () => {
    // числа форматируются русской локалью (неразрывные пробелы) — сравниваем
    // ровно то, что печатается, а не то, как это выглядит в редакторе
    const money = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;
    for (const value of [money(62361), money(30728), '115', '49.3 %']) {
      expect(md).toContain(value);
      expect(html).toContain(value);
    }
  });

  it('таблицы и заголовки превращаются в разметку, а не в текст', () => {
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Показатель</th>');
    expect(html).toContain('<h1>EXECUTIVE SUMMARY</h1>');
    expect(html).toContain('<pre><code>');
    expect(html).toContain('@media print');
  });

  it('экранирует угловые скобки, не ломая документ', () => {
    expect(markdownToHtml('<script>alert(1)</script>')).toContain(
      '&lt;script&gt;',
    );
  });

  it('в печатной версии тоже нет персональных данных', () => {
    expect(html).not.toMatch(/\b\d{15,}\b/);
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });
});
