import type { BehaviorInput } from '../behavior/behavior-compute';
import { customPeriod } from '../metrics/analytics-period';
import type {
  Freshness,
  Overview,
  Slice,
  SourceRow,
} from '../metrics/metrics-contract';
import {
  computeEvaluation,
  type CohortData,
  type EvaluationInputs,
  type WindowData,
} from './growth-compute';
import type { GrowthMetricKey, MaturityPolicy } from './growth-contract';
import {
  lagDistribution,
  lagInputsFrom,
  maturityInfo,
  maturityPolicyFrom,
} from './growth-maturity';
import { GROWTH_METRICS } from './growth-metrics';
import {
  buildWindows,
  cutoverDayOf,
  metricComparability,
  weekdayMix,
} from './growth-windows';

/**
 * Этап 11 (раздел 26): окна и день cutover, сопоставимость и фикстура 12.09,
 * уникальные не суммируются, малая выборка при большой дельте, нулевой
 * знаменатель, синтетические positive / negative / no-clear, созревание,
 * несовпадение областей, покрытие ClientID, COGS, пересечения изменений,
 * смеси источников/устройств, неподдерживаемые сегменты, causality.
 */

const FRESH: Freshness = {
  lastMetrikaSyncAt: new Date('2026-09-25T06:00:00Z'),
  metrikaDataAgeSeconds: 600,
  status: 'FRESH',
  thresholdSeconds: 7200,
};

interface Fx {
  visits: number;
  siteLeads: number;
  matchedAccepted?: number;
  matchedPaid?: number;
  periodUsers?: number | null;
  clientIdCoverage?: number | null;
  notes?: string[];
  realizedRevenue?: number | null;
  netProfit?: number | null;
  formStarts?: number;
  attempts?: number;
  formErrors?: number;
  devices?: {
    device: string;
    visits: number;
    siteLeads: number;
    formStarts?: number;
  }[];
  sources?: { source: string; visits: number }[];
  cohorts?: Partial<CohortData>;
}

function overview(period: ReturnType<typeof customPeriod>, f: Fx): Overview {
  const q = { completeness: 'complete' as const, notes: [] as never[] };
  return {
    period,
    previousPeriod: period,
    traffic: {
      visits: f.visits,
      periodUsers: f.periodUsers ?? null,
      sumDailyUsers: Math.round(f.visits * 0.8),
      pageviews: f.visits * 3,
      pageviewsSession: f.visits * 3,
      pageviewsPage: f.visits * 3,
      daysWithTraffic: 7,
      quality: q,
    },
    siteFunnel: {
      visits: f.visits,
      siteLeads: f.siteLeads,
      matchedAccepted: f.matchedAccepted ?? 0,
      matchedPaid: f.matchedPaid ?? 0,
      siteLeadConversion: null,
      siteAcceptedConversion: null,
      sitePaidConversion: null,
      siteLeadToAccepted: null,
      siteAcceptedToPaid: null,
      quality: q,
    },
    financials: {
      currency: 'RUB',
      contract: {
        orders: 0,
        contractValue: 0,
        cogs: 0,
        grossContribution: 0,
        cogsReliableOrders: 0,
      },
      paid: { orders: 0, paidOrderValue: 0, cogs: 0, grossContribution: 0 },
      realized:
        f.realizedRevenue === undefined
          ? null
          : {
              orders: 5,
              realizedRevenue: f.realizedRevenue ?? 0,
              realizedGoodsRevenue: 0,
              cogs: 0,
              grossContribution: 0,
              salaryAccrued: 0,
              operatingExpenses: 0,
              deliveryProfit: 0,
              netProfit: f.netProfit ?? 0,
              marginPct: null,
              byCategory: {
                photo: { orders: 0, revenue: 0, profit: 0 },
                tshirt: { orders: 0, revenue: 0, profit: 0 },
                canvas: { orders: 0, revenue: 0, profit: 0 },
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
      quality: q,
    },
    dataQuality: {
      freshness: FRESH,
      clientIdCoverageAccepted:
        f.clientIdCoverage === undefined ? 80 : f.clientIdCoverage,
      clientIdCoveragePaid: null,
      eligibleAccepted: 0,
      eligibleDeliveredToMetrika: 0,
      metrikaMatchCoverage: null,
      matchedAcceptedReaches: 0,
      paidWithoutDate: 0,
      siteLeadsLegacy: false,
      crmGoalsBeforeRollout: false,
      snapshotAvailable: f.periodUsers != null,
      notes: (f.notes ?? []) as never[],
    },
  } as unknown as Overview;
}

function behavior(
  period: ReturnType<typeof customPeriod>,
  f: Fx,
): BehaviorInput {
  const g = (v: number) => ({ reaches: v, visits: v });
  return {
    period,
    visits: f.visits,
    sumDailyUsers: 0,
    goalTotals: new Map([
      ['form_started', g(f.formStarts ?? 0)],
      ['lead_submit_attempt', g(f.attempts ?? 0)],
      ['form_error', g(f.formErrors ?? 0)],
    ]),
    periodUsers: null,
    goalUsers: null,
    byDevice: (f.devices ?? []).map((d) => ({
      deviceCategory: d.device,
      visits: d.visits,
      sumDailyUsers: 0,
      matchedAccepted: 0,
      goals: new Map([
        ['form_started', g(d.formStarts ?? 0)],
        ['lead_submitted', g(d.siteLeads)],
      ]),
      engagement: null,
    })),
    byLanding: [
      {
        normalizedPath: '/',
        visits: f.visits,
        sumDailyUsers: 0,
        matchedAccepted: 0,
        goals: new Map([['lead_submitted', g(f.siteLeads)]]),
      },
    ],
    params: [],
    paths: { entry_lead: [], viewed_lead: [], exit_all: [], exit_nolead: [] },
    behaviorRows: 10,
    freshness: FRESH,
  };
}

function slice<Row>(
  period: ReturnType<typeof customPeriod>,
  rows: Row[],
): Slice<Row> {
  return {
    period,
    rows,
    totals: {
      visits: 0,
      siteLeads: 0,
      matchedAccepted: 0,
      matchedPaid: 0,
      visitToLead: null,
      visitToAccepted: null,
      visitToPaid: null,
      leadToAccepted: null,
      acceptedToPaid: null,
    },
    quality: { completeness: 'complete', notes: [] },
  };
}

const rate = (visits: number, siteLeads: number) => ({
  visits,
  siteLeads,
  matchedAccepted: 0,
  matchedPaid: 0,
  visitToLead: null,
  visitToAccepted: null,
  visitToPaid: null,
  leadToAccepted: null,
  acceptedToPaid: null,
});

function windowData(
  period: ReturnType<typeof customPeriod>,
  f: Fx,
): WindowData {
  const devices = f.devices ?? [
    {
      device: 'desktop',
      visits: Math.round(f.visits * 0.55),
      siteLeads: f.siteLeads,
    },
    { device: 'mobile', visits: Math.round(f.visits * 0.45), siteLeads: 0 },
  ];
  const sources = f.sources ?? [
    { source: 'organic', visits: Math.round(f.visits * 0.6) },
    { source: 'direct', visits: Math.round(f.visits * 0.4) },
  ];
  return {
    period,
    overview: overview(period, f),
    behavior: behavior(period, { ...f, devices }),
    cohorts: {
      leads: 0,
      leadsAccepted: 0,
      leadsPaid: 0,
      accepted: 0,
      acceptedPaid: 0,
      acceptedContractValues: [],
      acceptedPaidValues: [],
      ...(f.cohorts ?? {}),
    },
    slices: {
      sources: slice<SourceRow>(
        period,
        sources.map((s) => ({
          trafficSource: s.source,
          trafficSourceName: s.source,
          sourceEngine: '',
          sourceEngineName: '',
          pageviews: 0,
          ...rate(s.visits, 0),
        })),
      ),
      utm: null,
    },
  };
}

// Окна целиком после 13.09 (полное определение siteLeads): изменение 24.09 15:00 MSK, «до» 17–23.09, «после» 25.09–01.10.
const NOW = new Date('2026-10-03T08:00:00Z'); // 03.10 11:00 MSK → последний полный день 02.10
const CHANGE_AT = new Date('2026-09-24T12:00:00Z'); // 24.09 15:00 MSK → cutover day 24.09 исключён

const policy = (): MaturityPolicy =>
  maturityPolicyFrom(
    { leadToAccepted: [], acceptedToPaid: [], leadToPaid: [] },
    null,
  );

function inputs(
  before: Fx,
  after: Fx,
  over: Partial<EvaluationInputs['change']> & {
    evaluationDays?: number | null;
    startedAt?: Date;
    now?: Date;
    policy?: MaturityPolicy;
    overlapping?: EvaluationInputs['overlapping'];
    freshness?: Freshness;
  } = {},
): EvaluationInputs {
  const windows = buildWindows({
    startedAt: over.startedAt ?? CHANGE_AT,
    endedAt: null,
    evaluationDays: over.evaluationDays ?? 7,
    now: over.now ?? NOW,
  })!;
  return {
    change: {
      id: 'chg-1',
      changeType: over.changeType ?? 'SITE',
      surface: over.surface ?? 'site:form',
      primaryMetric: over.primaryMetric ?? 'siteLeadRate',
      secondaryMetrics: over.secondaryMetrics ?? [],
      expectedDirection: over.expectedDirection ?? 'INCREASE',
      audienceDefinition: over.audienceDefinition ?? null,
    },
    windows,
    before: windowData(windows.before, before),
    after: windowData(windows.after, after),
    maturityPolicy: over.policy ?? policy(),
    freshness: over.freshness ?? FRESH,
    lastSyncRunId: 'run-1',
    overlapping: over.overlapping ?? [],
    evaluatedAt: over.now ?? NOW,
    version: 1,
    trigger: 'manual',
  };
}

// ---------------------------------------------------------------------------

describe('окна сравнения', () => {
  it('равные окна из полных московских дней, день cutover исключён; окна недели — одинаковый состав дней', () => {
    const w = buildWindows({
      startedAt: new Date('2026-09-12T10:19:22Z'),
      endedAt: null,
      evaluationDays: 7,
      now: new Date('2026-09-25T09:00:00Z'),
    })!;
    expect(w.cutoverDay).toBe('2026-09-12');
    expect(w.cutoverDayExcluded).toBe(true);
    expect(w.after).toMatchObject({ from: '2026-09-13', to: '2026-09-19' });
    expect(w.before).toMatchObject({ from: '2026-09-05', to: '2026-09-11' });
    expect(w.days).toBe(7);
    expect(w.observationCutoff).toBe('2026-09-24');
    expect(w.weekdayMix.before).toEqual(w.weekdayMix.after);
    expect(w.flags).toEqual(['EXCLUDED_CUTOVER_DAY']);
  });

  it('cutover ровно в 00:00 MSK — день полный, не исключается; «до» заканчивается накануне', () => {
    const w = buildWindows({
      startedAt: new Date('2026-09-12T21:00:00Z'),
      endedAt: null,
      evaluationDays: 7,
      now: new Date('2026-09-25T09:00:00Z'),
    })!;
    expect(cutoverDayOf(new Date('2026-09-12T21:00:00Z'))).toEqual({
      day: '2026-09-13',
      isFullDay: true,
    });
    expect(w.cutoverDayExcluded).toBe(false);
    expect(w.after.from).toBe('2026-09-13');
    expect(w.before.to).toBe('2026-09-12');
    expect(w.flags).toEqual([]);
  });

  it('авто-длина — наибольшая целая неделя: 8 доступных дней → 7; 30 → 28; 5 → 5 с SHORT_WINDOW и несовпадением дней недели', () => {
    const base = { startedAt: CHANGE_AT, endedAt: null, evaluationDays: null };
    expect(
      buildWindows({ ...base, now: new Date('2026-10-04T08:00:00Z') })!.days,
    ).toBe(7); // после 25.09–03.10 = 9 дней
    expect(
      buildWindows({ ...base, now: new Date('2026-10-26T08:00:00Z') })!.days,
    ).toBe(28);
    const short = buildWindows({
      ...base,
      now: new Date('2026-09-30T08:00:00Z'),
    })!; // 25–29.09 = 5 дней
    expect(short.days).toBe(5);
    expect(short.flags).toEqual(
      expect.arrayContaining(['SHORT_WINDOW', 'WEEKDAY_MIX_MISMATCH']),
    );
    // после cutover ни одного полного дня — окон нет
    expect(
      buildWindows({ ...base, now: new Date('2026-09-25T08:00:00Z') }),
    ).toBeNull();
  });

  it('endedAt обрезает окно «после»; последний день данных ограничивает дату наблюдения', () => {
    const w = buildWindows({
      startedAt: CHANGE_AT,
      endedAt: new Date('2026-09-28T09:00:00Z'),
      evaluationDays: 7,
      now: NOW,
    })!;
    expect(w.after.to).toBe('2026-09-27');
    expect(w.flags).toEqual(
      expect.arrayContaining(['AFTER_WINDOW_TRUNCATED_BY_END', 'SHORT_WINDOW']),
    );
    const limited = buildWindows({
      startedAt: CHANGE_AT,
      endedAt: null,
      evaluationDays: 7,
      now: NOW,
      lastDataDay: '2026-09-29',
    })!;
    expect(limited.observationCutoff).toBe('2026-09-29');
    expect(limited.after.to).toBe('2026-09-29');
    expect(weekdayMix('2026-09-14', '2026-09-20')).toEqual([
      1, 1, 1, 1, 1, 1, 1,
    ]);
  });

  it('сопоставимость: availableFrom внутри окна «до» → INCOMPARABLE; смена определения внутри сравнения → MEASUREMENT_DEFINITION_CHANGED', () => {
    const w = {
      before: customPeriod('2026-09-05', '2026-09-11'),
      after: customPeriod('2026-09-13', '2026-09-19'),
    };
    const c = metricComparability(GROWTH_METRICS.siteLeadRate, w);
    expect(c.comparable).toBe(false);
    expect(c.codes).toEqual(
      expect.arrayContaining([
        'METRIC_UNAVAILABLE_BEFORE',
        'MEASUREMENT_DEFINITION_CHANGED',
        'INCOMPARABLE_WINDOWS',
      ]),
    );
    expect(c.measuredFrom).toEqual({
      before: '2026-09-13',
      after: '2026-09-13',
    });
    const ok = metricComparability(GROWTH_METRICS.siteLeadRate, {
      before: customPeriod('2026-09-13', '2026-09-19'),
      after: customPeriod('2026-09-21', '2026-09-27'),
    });
    expect(ok).toMatchObject({
      comparable: true,
      codes: [],
      cutoversInside: [],
    });
    const partial = metricComparability(GROWTH_METRICS.formStarts, {
      before: customPeriod('2026-09-08', '2026-09-14'),
      after: customPeriod('2026-09-16', '2026-09-22'),
    });
    expect(partial.codes).toContain('PARTIAL_MEASUREMENT_PERIOD');
    expect(partial.comparable).toBe(false);
    // метрика без дат доступности сопоставима в любых окнах
    expect(metricComparability(GROWTH_METRICS.crmLeads, w).comparable).toBe(
      true,
    );
  });
});

describe('фикстура 12.09: смена модели событий не даёт ложного роста', () => {
  it('изменение 12.09 13:19 MSK с первичной siteLeadRate → INCOMPARABLE, числа показаны, прироста нет', () => {
    const inp = inputs(
      { visits: 120, siteLeads: 1 },
      { visits: 118, siteLeads: 5 },
      {
        startedAt: new Date('2026-09-12T10:19:22Z'),
        now: new Date('2026-09-21T08:00:00Z'),
      },
    );
    const e = computeEvaluation(inp);
    expect(e.windows.after).toMatchObject({
      from: '2026-09-13',
      to: '2026-09-19',
    });
    expect(e.verdict).toBe('INCOMPARABLE');
    expect(e.primary.comparability.codes).toContain(
      'MEASUREMENT_DEFINITION_CHANGED',
    );
    expect(e.primary.before.value).toBeCloseTo((1 / 120) * 100, 6);
    expect(e.primary.after.value).toBeCloseTo((5 / 118) * 100, 6);
    expect(e.INTERPRETATION).toMatch(/Определение метрики .* изменилось/);
    expect(e.FACT).not.toMatch(/доказ/);
    expect(e.confounders.map((c) => c.code)).toContain(
      'MEASUREMENT_DEFINITION_CHANGED',
    );
    expect(e.causality).toBe('NOT_ESTABLISHED');
  });
});

describe('оценка первичной метрики', () => {
  it('малая выборка: 1/20 → 3/20 (+200 %) — INSUFFICIENT_DATA, а не рост; MDE и требуемая выборка объяснены', () => {
    const e = computeEvaluation(
      inputs({ visits: 20, siteLeads: 1 }, { visits: 20, siteLeads: 3 }),
    );
    expect(e.verdict).toBe('INSUFFICIENT_DATA');
    expect(e.primary.flags).toContain('LOW_SAMPLE');
    expect(e.primary.statistics?.relativeDifference).toBeCloseTo(200, 6);
    expect(e.primary.statistics?.method).toBe('fisher_exact_two_sided');
    expect(e.INTERPRETATION).toMatch(/Данных недостаточно/);
    expect(e.INTERPRETATION).toMatch(/нужно ≈/);
    expect(e.RECOMMENDATION).toMatch(/Продолжить наблюдение/);
  });

  it('нулевой знаменатель — ZERO_DENOMINATOR, значение null, а не 0 %', () => {
    const e = computeEvaluation(
      inputs({ visits: 0, siteLeads: 0 }, { visits: 40, siteLeads: 2 }),
    );
    expect(e.primary.before.value).toBeNull();
    expect(e.primary.flags).toContain('ZERO_DENOMINATOR');
    expect(e.verdict).toBe('INSUFFICIENT_DATA');
  });

  it('синтетика: 5/1000 → 40/1000 — POSITIVE_SIGNAL; обратное — NEGATIVE_SIGNAL; 1000/20000 → 1010/20000 — NO_CLEAR_CHANGE', () => {
    const up = computeEvaluation(
      inputs({ visits: 1000, siteLeads: 5 }, { visits: 1000, siteLeads: 40 }),
    );
    expect(up.verdict).toBe('POSITIVE_SIGNAL');
    expect(up.primary.statistics?.confidenceInterval?.low).toBeGreaterThan(0);
    expect(up.INTERPRETATION).toMatch(/не доказательство/);
    expect(up.RECOMMENDATION).toMatch(/рандомизированный эксперимент/);
    const down = computeEvaluation(
      inputs({ visits: 1000, siteLeads: 40 }, { visits: 1000, siteLeads: 5 }),
    );
    expect(down.verdict).toBe('NEGATIVE_SIGNAL');
    // ожидаемое направление DECREASE переворачивает знак сигнала
    expect(
      computeEvaluation(
        inputs(
          { visits: 1000, siteLeads: 40 },
          { visits: 1000, siteLeads: 5 },
          { expectedDirection: 'DECREASE' },
        ),
      ).verdict,
    ).toBe('POSITIVE_SIGNAL');
    const flat = computeEvaluation(
      inputs(
        { visits: 20000, siteLeads: 1000 },
        { visits: 20000, siteLeads: 1010 },
      ),
    );
    expect(flat.verdict).toBe('NO_CLEAR_CHANGE');
    expect(flat.primary.statistics?.mde?.relative).toBeLessThanOrEqual(20);
    // тот же «нет разницы», но объёма мало для 20 % — честный INSUFFICIENT_DATA
    const small = computeEvaluation(
      inputs({ visits: 1000, siteLeads: 50 }, { visits: 1000, siteLeads: 52 }),
    );
    expect(small.verdict).toBe('INSUFFICIENT_DATA');
  });

  it('окно короче недели: даже сильный контраст — INSUFFICIENT_DATA с SHORT_WINDOW, а не сигнал (состав дней недели не уравновешен)', () => {
    // после cutover 24.09 доступно 5 полных дней (25–29.09) → окна по 5 дней
    const e = computeEvaluation(
      inputs(
        { visits: 1000, siteLeads: 5 },
        { visits: 1000, siteLeads: 40 },
        { evaluationDays: null, now: new Date('2026-09-30T08:00:00Z') },
      ),
    );
    expect(e.windows.days).toBe(5);
    expect(e.primary.flags).toContain('SHORT_WINDOW');
    expect(e.windows.flags).toContain('WEEKDAY_MIX_MISMATCH');
    expect(e.dataQuality.flags).toEqual(
      expect.arrayContaining(['SHORT_WINDOW', 'WEEKDAY_MIX_MISMATCH']),
    );
    expect(e.verdict).toBe('INSUFFICIENT_DATA');
    expect(e.INTERPRETATION).toMatch(/Окно короче недели/);
    expect(e.segments.every((s) => s.verdict !== 'POSITIVE_SIGNAL')).toBe(true);
  });

  it('уникальные посетители — только из снимка: без снимка null и флаг, сумма дневных не подставляется', () => {
    const none = computeEvaluation(
      inputs({ visits: 500, siteLeads: 20 }, { visits: 500, siteLeads: 25 }),
    );
    expect(none.periodUsers).toEqual({ before: null, after: null });
    expect(none.dataQuality.flags).toContain(
      'UNIQUE_USERS_UNAVAILABLE_FOR_CUSTOM_WINDOW',
    );
    const snap = computeEvaluation(
      inputs(
        { visits: 500, siteLeads: 20, periodUsers: 380 },
        { visits: 500, siteLeads: 25, periodUsers: 372 },
      ),
    );
    expect(snap.periodUsers).toEqual({ before: 380, after: 372 });
    expect(snap.dataQuality.flags).not.toContain(
      'UNIQUE_USERS_UNAVAILABLE_FOR_CUSTOM_WINDOW',
    );
  });

  it('несовпадение областей: правка сайта с первичной crmLeads → METRIC_SCOPE_MISMATCH и INCOMPARABLE; CRM-итоги — контекст', () => {
    const e = computeEvaluation(
      inputs(
        { visits: 500, siteLeads: 20, cohorts: { leads: 40 } },
        { visits: 500, siteLeads: 25, cohorts: { leads: 60 } },
        { primaryMetric: 'crmLeads' },
      ),
    );
    expect(e.primary.scopeCompatibility).toBe('mismatch');
    expect(e.primary.flags).toContain('METRIC_SCOPE_MISMATCH');
    expect(e.verdict).toBe('INCOMPARABLE');
    expect(e.RECOMMENDATION).toMatch(/первичную метрику того пространства/);
    // как контекст те же CRM-метрики допустимы
    const site = computeEvaluation(
      inputs(
        { visits: 500, siteLeads: 20, cohorts: { leads: 40 } },
        { visits: 500, siteLeads: 25, cohorts: { leads: 60 } },
      ),
    );
    expect(site.context.map((m) => m.metric)).toEqual(
      expect.arrayContaining(['crmLeads', 'acceptedOrders']),
    );
    expect(
      site.context.find((m) => m.metric === 'crmLeads')?.scopeCompatibility,
    ).toBe('context_only');
  });

  it('покрытие ClientID 8 % — сопоставленная метрика INSUFFICIENT_DATA с MATCHED_COVERAGE_LOW, без процента прироста в вердикте', () => {
    const e = computeEvaluation(
      inputs(
        { visits: 800, siteLeads: 20, matchedAccepted: 2, clientIdCoverage: 8 },
        { visits: 800, siteLeads: 25, matchedAccepted: 9, clientIdCoverage: 8 },
        {
          primaryMetric: 'matchedAcceptedRate',
          changeType: 'MARKETING',
          now: new Date('2026-10-30T08:00:00Z'),
        },
      ),
    );
    // matched никогда не первична — mismatch перекрывает; проверяем как secondary
    const sec = computeEvaluation(
      inputs(
        { visits: 800, siteLeads: 20, matchedAccepted: 2, clientIdCoverage: 8 },
        { visits: 800, siteLeads: 25, matchedAccepted: 9, clientIdCoverage: 8 },
        {
          secondaryMetrics: ['matchedAcceptedRate'],
          now: new Date('2026-10-30T08:00:00Z'),
        },
      ),
    );
    const m = sec.secondary.find((x) => x.metric === 'matchedAcceptedRate')!;
    expect(m.flags).toContain('MATCHED_COVERAGE_LOW');
    expect(m.verdict).toBe('INSUFFICIENT_DATA');
    expect(e.verdict).toBe('INCOMPARABLE');
    expect(sec.confounders.map((c) => c.code)).toContain(
      'MATCHED_COVERAGE_LOW',
    );
  });

  it('COGS ненадёжна — прибыль INSUFFICIENT_DATA с COGS_INCOMPLETE; сумма денег без теста (STATISTICAL_TEST_UNAVAILABLE)', () => {
    const e = computeEvaluation(
      inputs(
        {
          visits: 500,
          siteLeads: 20,
          realizedRevenue: 100000,
          netProfit: 40000,
          notes: ['COGS_UNRELIABLE_ORDERS'],
        },
        {
          visits: 500,
          siteLeads: 20,
          realizedRevenue: 150000,
          netProfit: 70000,
        },
        {
          primaryMetric: 'netProfit',
          changeType: 'PRICING',
          now: new Date('2026-11-15T08:00:00Z'),
        },
      ),
    );
    expect(e.primary.flags).toEqual(
      expect.arrayContaining([
        'COGS_INCOMPLETE',
        'STATISTICAL_TEST_UNAVAILABLE',
      ]),
    );
    expect(e.verdict).toBe('INSUFFICIENT_DATA');
    expect(e.primary.statistics?.method).toBe('descriptive_only');
    expect(e.primary.statistics?.absoluteDifference).toBe(30000);
  });
});

describe('созревание', () => {
  it('немедленные метрики созревают сразу; оплаты — по политике; частично — после медианы', () => {
    const lags = {
      leadToAccepted: Array.from({ length: 25 }, (_, i) => i % 3),
      acceptedToPaid: Array.from({ length: 25 }, (_, i) => 2 + (i % 10)),
      leadToPaid: Array.from({ length: 25 }, (_, i) => 3 + (i % 12)),
    };
    const p = maturityPolicyFrom(lags, null);
    expect(p.leadToAccepted.sufficient).toBe(true);
    expect(p.daysByClass.immediate).toBe(0);
    expect(p.daysByClass.accepted).toBe(Math.ceil(p.leadToAccepted.p90Days!));
    expect(p.source.paid).toBe('empirical');
    expect(
      maturityInfo('immediate', '2026-09-25', '2026-09-26', p, null).status,
    ).toBe('MATURE');
    const im = maturityInfo('paid', '2026-09-25', '2026-09-27', p, 8);
    expect(im.status).toBe('IMMATURE');
    expect(im.maturityUntil).toBe(
      `2026-10-${String(25 + p.daysByClass.paid - 30).padStart(2, '0')}`,
    );
    expect(maturityInfo('paid', '2026-09-25', '2026-10-04', p, 8).status).toBe(
      'PARTIALLY_MATURE',
    );
    expect(maturityInfo('paid', '2026-09-25', '2026-11-30', p, 8).status).toBe(
      'MATURE',
    );
    // истории мало — политика по умолчанию с пометкой
    const def = maturityPolicyFrom(
      { leadToAccepted: [1, 2], acceptedToPaid: [3], leadToPaid: [4] },
      null,
    );
    expect(def.source.paid).toBe('default');
    expect(def.daysByClass).toEqual({ immediate: 0, accepted: 7, paid: 14 });
    // заданное в изменении переопределяет paid и ограничивает accepted
    expect(maturityPolicyFrom(lags, 3).daysByClass).toMatchObject({
      paid: 3,
      accepted: Math.min(3, Math.ceil(p.leadToAccepted.p90Days!)),
    });
    expect(lagDistribution([]).sample).toBe(0);
  });

  it('незрелая когорта оплат не считается итогом: большая разница → IMMATURE, не POSITIVE_SIGNAL', () => {
    const e = computeEvaluation(
      inputs(
        {
          visits: 500,
          siteLeads: 20,
          cohorts: { leads: 40, leadsAccepted: 30, leadsPaid: 10 },
        },
        {
          visits: 500,
          siteLeads: 20,
          cohorts: { leads: 40, leadsAccepted: 30, leadsPaid: 25 },
        },
        { primaryMetric: 'leadToPaidRate', changeType: 'CRM' },
      ),
    );
    expect(e.primary.maturity.status).toBe('IMMATURE');
    expect(e.verdict).toBe('IMMATURE');
    expect(e.RECOMMENDATION).toMatch(/Повторить оценку после/);
    expect(e.confounders.map((c) => c.code)).toContain('IMMATURE_OUTCOME');
    // спустя политику созревания та же когорта оценивается
    const later = computeEvaluation(
      inputs(
        {
          visits: 500,
          siteLeads: 20,
          cohorts: { leads: 40, leadsAccepted: 30, leadsPaid: 10 },
        },
        {
          visits: 500,
          siteLeads: 20,
          cohorts: { leads: 40, leadsAccepted: 30, leadsPaid: 25 },
        },
        {
          primaryMetric: 'leadToPaidRate',
          changeType: 'CRM',
          now: new Date('2026-10-20T08:00:00Z'),
        },
      ),
    );
    expect(later.primary.maturity.status).toBe('MATURE');
    expect(later.verdict).toBe('POSITIVE_SIGNAL');
  });

  it('lagInputsFrom: только неотрицательные задержки по московским дням, без PII', () => {
    const lags = lagInputsFrom([
      {
        order: {} as never,
        lifecycle: {
          leadAt: new Date('2026-09-01T20:00:00Z'),
          acceptedAt: new Date('2026-09-02T21:30:00Z'),
          paidAt: new Date('2026-09-05T10:00:00Z'),
        } as never,
      },
      {
        order: {} as never,
        lifecycle: {
          leadAt: null,
          acceptedAt: new Date('2026-09-02T10:00:00Z'),
          paidAt: new Date('2026-09-02T12:00:00Z'),
        } as never,
      },
    ]);
    // 01.09 23:00 MSK → 03.09 00:30 MSK = 2 дня; → 05.09 13:00 = 4 дня
    expect(lags.leadToAccepted).toEqual([2]);
    expect(lags.leadToPaid).toEqual([4]);
    expect(lags.acceptedToPaid).toEqual([2, 0]);
  });
});

describe('confounders и сегменты', () => {
  it('пересекающееся изменение — OVERLAPPING_CHANGE с идентификаторами; ни одному не приписывается разница', () => {
    const e = computeEvaluation(
      inputs(
        { visits: 1000, siteLeads: 5 },
        { visits: 1000, siteLeads: 40 },
        {
          overlapping: [
            {
              id: 'chg-2',
              name: 'Новая карточка',
              surface: 'site:catalog',
              startedAt: '2026-09-19T09:00:00Z',
              endedAt: null,
            },
          ],
        },
      ),
    );
    const c = e.confounders.find((x) => x.code === 'OVERLAPPING_CHANGE')!;
    expect(c.relatedChangeIds).toEqual(['chg-2']);
    expect(e.dataQuality.flags).toContain('OVERLAPPING_CHANGE');
    expect(e.INTERPRETATION).toMatch(/OVERLAPPING_CHANGE/);
  });

  it('сдвиг смеси источников и устройств ≥ 15 п.п. — описательный confounder с долями', () => {
    const e = computeEvaluation(
      inputs(
        {
          visits: 1000,
          siteLeads: 20,
          sources: [
            { source: 'organic', visits: 700 },
            { source: 'ad', visits: 300 },
          ],
          devices: [
            { device: 'desktop', visits: 600, siteLeads: 20 },
            { device: 'mobile', visits: 400, siteLeads: 0 },
          ],
        },
        {
          visits: 1000,
          siteLeads: 22,
          sources: [
            { source: 'organic', visits: 400 },
            { source: 'ad', visits: 600 },
          ],
          devices: [
            { device: 'desktop', visits: 300, siteLeads: 22 },
            { device: 'mobile', visits: 700, siteLeads: 0 },
          ],
        },
      ),
    );
    const src = e.confounders.find((c) => c.code === 'SOURCE_MIX_SHIFT')!;
    expect(src.shares?.find((s) => s.key === 'organic')).toMatchObject({
      before: 70,
      after: 40,
    });
    expect(src.fact).not.toMatch(/вызвал|причин/);
    expect(e.confounders.map((c) => c.code)).toContain('DEVICE_MIX_SHIFT');
    // небольшой сдвиг (5 п.п.) — без confounder
    const calm = computeEvaluation(
      inputs({ visits: 1000, siteLeads: 20 }, { visits: 1000, siteLeads: 22 }),
    );
    expect(calm.confounders.map((c) => c.code)).not.toContain(
      'SOURCE_MIX_SHIFT',
    );
  });

  it('сегменты: аудитория device поддерживается для siteLeadRate; utm × formStartRate — UNSUPPORTED_SEGMENT', () => {
    const ok = computeEvaluation(
      inputs(
        { visits: 1000, siteLeads: 20 },
        { visits: 1000, siteLeads: 30 },
        { audienceDefinition: { dimension: 'device', values: ['mobile'] } },
      ),
    );
    const aud = ok.segments.find((s) => s.role === 'audience')!;
    expect(aud).toMatchObject({
      dimension: 'device',
      value: 'mobile',
      metric: 'siteLeadRate',
    });
    expect(aud.before.denominator).toBe(450);
    const bad = computeEvaluation(
      inputs(
        { visits: 1000, siteLeads: 20, formStarts: 60 },
        { visits: 1000, siteLeads: 30, formStarts: 80 },
        {
          primaryMetric: 'formStartRate',
          audienceDefinition: { dimension: 'utm', values: ['yandex'] },
        },
      ),
    );
    expect(bad.segments.find((s) => s.role === 'audience')?.flags).toContain(
      'UNSUPPORTED_SEGMENT',
    );
    // исследовательские сегменты по устройствам всегда добавляются
    expect(
      bad.segments.filter((s) => s.role === 'exploratory').map((s) => s.value),
    ).toEqual(['desktop', 'mobile']);
  });

  it('устаревшие данные — ANALYTICS_STALE во флагах и confounders', () => {
    const e = computeEvaluation(
      inputs(
        { visits: 500, siteLeads: 20 },
        { visits: 500, siteLeads: 22 },
        {
          freshness: {
            ...FRESH,
            status: 'STALE',
            metrikaDataAgeSeconds: 40000,
          },
        },
      ),
    );
    expect(e.primary.flags).toContain('ANALYTICS_STALE');
    expect(e.confounders.map((c) => c.code)).toContain('ANALYTICS_STALE');
  });
});

describe('контракт результата', () => {
  it('всегда наблюдательное сравнение: evidenceType, causality NOT_ESTABLISHED, abCapability NO_VARIANT_ASSIGNMENT, дисклеймер; вторичные и контекст размечены', () => {
    const e = computeEvaluation(
      inputs(
        { visits: 1000, siteLeads: 5, formStarts: 50 },
        { visits: 1000, siteLeads: 40, formStarts: 90 },
        { secondaryMetrics: ['formStartRate', 'visits'] as GrowthMetricKey[] },
      ),
    );
    expect(e).toMatchObject({
      evidenceType: 'OBSERVATIONAL_BEFORE_AFTER',
      causality: 'NOT_ESTABLISHED',
      abCapability: 'NO_VARIANT_ASSIGNMENT',
      metricVersion: 'growth-metrics-v1',
    });
    expect(e.disclaimer).toMatch(/не доказывает/);
    expect(e.secondary.map((m) => [m.metric, m.role])).toEqual([
      ['formStartRate', 'secondary'],
      ['visits', 'secondary'],
    ]);
    expect(e.context.every((m) => m.role === 'context')).toBe(true);
    // счётчик визитов — пуассоновский метод с относительным интервалом
    const visits = e.secondary.find((m) => m.metric === 'visits')!;
    expect(visits.statistics?.method).toBe(
      'poisson_conditional_binomial_exact',
    );
    expect(visits.statistics?.relativeConfidenceInterval).not.toBeNull();
    // значения заказов не утекают в API
    expect('values' in e.primary.before).toBe(false);
    expect(e.FACT).toMatch(/до \(.*\) .* после \(.*\)/);
  });

  it('средний чек когорты: бутстрэп при ≥ 5 оплаченных, иначе описательно; когорта не смешивается с календарными оплатами', () => {
    const paid = (n: number, v: number) =>
      Array.from({ length: n }, (_, i) => v + i * 10);
    const e = computeEvaluation(
      inputs(
        {
          visits: 500,
          siteLeads: 20,
          cohorts: {
            accepted: 12,
            acceptedPaid: 8,
            acceptedPaidValues: paid(8, 1500),
            acceptedContractValues: paid(12, 1500),
          },
        },
        {
          visits: 500,
          siteLeads: 20,
          cohorts: {
            accepted: 12,
            acceptedPaid: 8,
            acceptedPaidValues: paid(8, 2500),
            acceptedContractValues: paid(12, 2500),
          },
        },
        {
          primaryMetric: 'paidAov',
          changeType: 'PRICING',
          now: new Date('2026-10-25T08:00:00Z'),
        },
      ),
    );
    expect(e.primary.statistics?.method).toBe('bootstrap_percentile_mean_diff');
    expect(e.primary.statistics?.absoluteDifference).toBeCloseTo(1000, 6);
    expect(e.verdict).toBe('POSITIVE_SIGNAL');
    const few = computeEvaluation(
      inputs(
        {
          visits: 500,
          siteLeads: 20,
          cohorts: {
            accepted: 3,
            acceptedPaid: 2,
            acceptedPaidValues: [1000, 1200],
            acceptedContractValues: [1000, 1200, 900],
          },
        },
        {
          visits: 500,
          siteLeads: 20,
          cohorts: {
            accepted: 3,
            acceptedPaid: 2,
            acceptedPaidValues: [3000, 3200],
            acceptedContractValues: [3000, 3200, 900],
          },
        },
        {
          primaryMetric: 'paidAov',
          changeType: 'PRICING',
          now: new Date('2026-10-25T08:00:00Z'),
        },
      ),
    );
    expect(few.primary.statistics?.method).toBe('descriptive_only');
    expect(few.verdict).toBe('INSUFFICIENT_DATA');
  });
});
