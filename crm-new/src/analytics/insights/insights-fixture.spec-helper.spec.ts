import type { BehaviorInput } from '../behavior/behavior-compute';
import type { BehaviorIssues, Funnel } from '../behavior/behavior-contract';
import { customPeriod } from '../metrics/analytics-period';
import type {
  CrmSlice,
  Freshness,
  LandingRow,
  Overview,
  ProductRow,
  Slice,
  SourceRow,
} from '../metrics/metrics-contract';
import {
  computeConfounders,
  evaluateMetric,
  type CohortData,
  type EvaluationInputs,
  type WindowData,
} from '../growth/growth-compute';
import type {
  GrowthEvaluation,
  GrowthMetricKey,
  MetricEvaluation,
} from '../growth/growth-contract';
import { maturityPolicyFrom } from '../growth/growth-maturity';
import { GROWTH_METRIC_KEYS } from '../growth/growth-metrics';
import { buildWindows } from '../growth/growth-windows';
import type { ChangeContext, InsightContext } from './insights-engine';

/**
 * Фикстуры контекста для тестов этапа 12 — тот же способ сборки окон и
 * данных, что в growth-compute.spec: окна 7/7 целиком после 13.09 (полное
 * определение заявок), NOW = 03.10 11:00 MSK → cutoff 02.10, «после» 26.09–02.10,
 * «до» 19.09–25.09.
 */

export const FRESH: Freshness = {
  lastMetrikaSyncAt: new Date('2026-10-03T07:00:00Z'),
  metrikaDataAgeSeconds: 600,
  status: 'FRESH',
  thresholdSeconds: 7200,
};

export const NOW = new Date('2026-10-03T08:00:00Z');

export interface Fx {
  visits: number;
  siteLeads: number;
  formStarts?: number;
  attempts?: number;
  formErrors?: number;
  matchedAccepted?: number;
  clientIdCoverage?: number | null;
  notes?: string[];
  realizedRevenue?: number | null;
  netProfit?: number | null;
  paidWithoutDate?: number;
  devices?: {
    device: string;
    visits: number;
    siteLeads: number;
    formStarts?: number;
  }[];
  sources?: { source: string; visits: number; leads?: number }[];
  landings?: { path: string; visits: number; leads?: number }[];
  products?: {
    category: string;
    accepted: number;
    paid?: number;
    contractValue?: number;
  }[];
  cohorts?: Partial<CohortData>;
}

function overview(period: ReturnType<typeof customPeriod>, f: Fx): Overview {
  const q = { completeness: 'complete' as const, notes: [] as never[] };
  return {
    period,
    previousPeriod: period,
    traffic: {
      visits: f.visits,
      periodUsers: null,
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
      matchedPaid: 0,
      siteLeadConversion: null,
      siteAcceptedConversion: null,
      sitePaidConversion: null,
      siteLeadToAccepted: null,
      siteAcceptedToPaid: null,
      quality: q,
    },
    orders: { paidWithoutDate: f.paidWithoutDate ?? 0 },
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
              orders: f.cohorts?.accepted ?? 5,
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
      paidWithoutDate: f.paidWithoutDate ?? 0,
      siteLeadsLegacy: false,
      crmGoalsBeforeRollout: false,
      snapshotAvailable: false,
      notes: (f.notes ?? []) as never[],
    },
  } as unknown as Overview;
}

function behavior(
  period: ReturnType<typeof customPeriod>,
  f: Fx,
): BehaviorInput {
  const g = (v: number) => ({ reaches: v, visits: v });
  const devices = f.devices ?? [
    {
      device: 'desktop',
      visits: Math.round(f.visits * 0.55),
      siteLeads: f.siteLeads,
    },
    {
      device: 'mobile',
      visits: f.visits - Math.round(f.visits * 0.55),
      siteLeads: 0,
    },
  ];
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
    byDevice: devices.map((d) => ({
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
    byLanding: (
      f.landings ?? [{ path: '/', visits: f.visits, leads: f.siteLeads }]
    ).map((l) => ({
      normalizedPath: l.path,
      visits: l.visits,
      sumDailyUsers: 0,
      matchedAccepted: 0,
      goals: new Map([['lead_submitted', g(l.leads ?? 0)]]),
    })),
    params: [],
    paths: { entry_lead: [], viewed_lead: [], exit_all: [], exit_nolead: [] },
    behaviorRows: 10,
    freshness: FRESH,
  };
}

const rate = (visits: number, siteLeads: number) => ({
  visits,
  siteLeads,
  matchedAccepted: 0,
  matchedPaid: 0,
  visitToLead: visits ? (siteLeads / visits) * 100 : null,
  visitToAccepted: null,
  visitToPaid: null,
  leadToAccepted: null,
  acceptedToPaid: null,
});

function slice<Row>(
  period: ReturnType<typeof customPeriod>,
  rows: Row[],
): Slice<Row> {
  return {
    period,
    rows,
    totals: rate(0, 0),
    quality: { completeness: 'complete', notes: [] },
  };
}

export function sourcesSlice(
  period: ReturnType<typeof customPeriod>,
  f: Fx,
): Slice<SourceRow> {
  const sources = f.sources ?? [
    {
      source: 'organic',
      visits: Math.round(f.visits * 0.6),
      leads: f.siteLeads,
    },
    {
      source: 'direct',
      visits: f.visits - Math.round(f.visits * 0.6),
      leads: 0,
    },
  ];
  return slice<SourceRow>(
    period,
    sources.map((s) => ({
      trafficSource: s.source,
      trafficSourceName: s.source,
      sourceEngine: '',
      sourceEngineName: '',
      pageviews: 0,
      ...rate(s.visits, s.leads ?? 0),
    })),
  );
}

export function landingsSlice(
  period: ReturnType<typeof customPeriod>,
  f: Fx,
): Slice<LandingRow> {
  const landings = f.landings ?? [
    { path: '/', visits: f.visits, leads: f.siteLeads },
  ];
  return slice<LandingRow>(
    period,
    landings.map((l) => ({
      normalizedPath: l.path,
      ...rate(l.visits, l.leads ?? 0),
    })),
  );
}

export function productsSlice(
  period: ReturnType<typeof customPeriod>,
  f: Fx,
): CrmSlice<ProductRow> {
  return {
    period,
    rows: (f.products ?? []).map((p) => ({
      productCategory: p.category,
      acceptedOrders: p.accepted,
      paidOrders: p.paid ?? 0,
      cancelledOrders: 0,
      contractValue: p.contractValue ?? 0,
      paidOrderValue: 0,
      cogs: 0,
      cogsReliableOrders: 0,
      grossContribution: 0,
      acceptedAov: null,
      paidAov: null,
    })),
    quality: { completeness: 'complete', notes: [] },
  };
}

export function windowData(
  period: ReturnType<typeof customPeriod>,
  f: Fx,
): WindowData {
  return {
    period,
    overview: overview(period, f),
    behavior: behavior(period, f),
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
    slices: { sources: sourcesSlice(period, f), utm: null },
  };
}

export interface ContextOverrides {
  now?: Date;
  runKind?: InsightContext['runKind'];
  freshness?: Freshness;
  overlapping?: EvaluationInputs['overlapping'];
  changes?: ChangeContext[];
  behavior?: { issues: BehaviorIssues; funnels: Funnel[] } | null;
  withSlices?: boolean;
  lagDays?: {
    leadToAccepted: number[];
    acceptedToPaid: number[];
    leadToPaid: number[];
  };
}

/** Контекст запуска из двух наборов чисел — «до» и «после». */
export function makeContext(
  before: Fx,
  after: Fx,
  o: ContextOverrides = {},
): InsightContext {
  const now = o.now ?? NOW;
  // «после» — 7 полных дней до вчера; startedAt = 00:00 MSK первого дня окна «после»
  const cutoff = new Date(now.getTime() - 24 * 3600e3);
  const cutoffIso = new Date(cutoff.getTime() + 3 * 3600e3)
    .toISOString()
    .slice(0, 10);
  const afterFrom = new Date(
    new Date(`${cutoffIso}T00:00:00Z`).getTime() - 6 * 86400e3,
  )
    .toISOString()
    .slice(0, 10);
  const windows = buildWindows({
    startedAt: new Date(`${afterFrom}T00:00:00+03:00`),
    endedAt: null,
    evaluationDays: 7,
    now,
  })!;
  const freshness = o.freshness ?? FRESH;
  const inputs: EvaluationInputs = {
    change: {
      id: 'rolling',
      changeType: 'ANALYTICS',
      surface: 'analytics:rolling-window',
      primaryMetric: 'visits',
      secondaryMetrics: [],
      expectedDirection: 'NEUTRAL',
      audienceDefinition: null,
    },
    windows,
    before: windowData(windows.before, before),
    after: windowData(windows.after, after),
    maturityPolicy: maturityPolicyFrom(
      o.lagDays ?? { leadToAccepted: [], acceptedToPaid: [], leadToPaid: [] },
      null,
    ),
    freshness,
    lastSyncRunId: 'run-1',
    overlapping: o.overlapping ?? [],
    evaluatedAt: now,
    version: 0,
    trigger: 'scheduler',
  };
  const metrics = {} as Record<GrowthMetricKey, MetricEvaluation>;
  for (const key of GROWTH_METRIC_KEYS)
    metrics[key] = evaluateMetric(key, 'secondary', inputs);
  const withSlices = o.withSlices ?? true;
  return {
    now,
    runKind: o.runKind ?? 'daily',
    observationCutoff: windows.observationCutoff,
    windows,
    metrics,
    confounders: computeConfounders(inputs, Object.values(metrics)),
    freshness,
    lastSyncRunId: 'run-1',
    dataQuality: inputs.after.overview.dataQuality,
    behavior: o.behavior ?? null,
    slices: withSlices
      ? {
          sources: {
            before: sourcesSlice(windows.before, before),
            after: sourcesSlice(windows.after, after),
          },
          landings: {
            before: landingsSlice(windows.before, before),
            after: landingsSlice(windows.after, after),
          },
          products: {
            before: productsSlice(windows.before, before),
            after: productsSlice(windows.after, after),
          },
        }
      : { sources: null, landings: null, products: null },
    changes: o.changes ?? [],
    paidWithoutDate: after.paidWithoutDate ?? 0,
  };
}

/** Минимальная оценка этапа 11 для CHANGE_EVALUATION. */
export function fakeEvaluation(
  over: Partial<GrowthEvaluation> = {},
): GrowthEvaluation {
  const ctx = makeContext(
    { visits: 500, siteLeads: 20 },
    { visits: 500, siteLeads: 20 },
  );
  const p = ctx.metrics.siteLeadRate;
  return {
    changeId: 'chg-1',
    version: 1,
    evaluatedAt: NOW.toISOString(),
    trigger: 'manual',
    metricVersion: 'growth-metrics-v1',
    evidenceType: 'OBSERVATIONAL_BEFORE_AFTER',
    causality: 'NOT_ESTABLISHED',
    abCapability: 'NO_VARIANT_ASSIGNMENT',
    windows: ctx.windows,
    primaryMetric: 'siteLeadRate',
    primary: p,
    secondary: [],
    context: [],
    segments: [],
    periodUsers: { before: null, after: null },
    maturityPolicy: {
      leadToAccepted: {
        sample: 0,
        medianDays: null,
        p75Days: null,
        p90Days: null,
        sufficient: false,
      },
      acceptedToPaid: {
        sample: 0,
        medianDays: null,
        p75Days: null,
        p90Days: null,
        sufficient: false,
      },
      daysByClass: { immediate: 0, accepted: 7, paid: 14 },
      source: { immediate: 'empirical', accepted: 'default', paid: 'default' },
    },
    confounders: [],
    dataQuality: { flags: [] },
    verdict: 'INCOMPARABLE',
    maturity: 'MATURE',
    FACT: '«Конверсия визитов в заявку»: до 3,92 % (2 из 51), после 7,41 % (2 из 27).',
    INTERPRETATION:
      'Определение метрики изменилось 13.09.2026 — окна «до» и «после» считают разное, разница не является эффектом изменения.',
    RECOMMENDATION: 'Сравнивать окна, целиком лежащие после смены определения.',
    disclaimer:
      'Наблюдательное сравнение «до / после»: совпадение по времени не доказывает, что изменение вызвало результат. Причинность не установлена.',
    ...over,
  } as GrowthEvaluation;
}

describe('фикстура', () => {
  it('строит окна 7/7 до 02.10 при NOW = 03.10', () => {
    const ctx = makeContext(
      { visits: 100, siteLeads: 5 },
      { visits: 100, siteLeads: 5 },
    );
    expect(ctx.windows.after.to).toBe('2026-10-02');
    expect(ctx.windows.after.from).toBe('2026-09-26');
    expect(ctx.windows.before.from).toBe('2026-09-19');
    expect(ctx.windows.before.to).toBe('2026-09-25');
    expect(ctx.windows.flags).toEqual([]);
  });
});
