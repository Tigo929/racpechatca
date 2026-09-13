import type { Comparison, ComparisonKey, ComparisonSet, Overview } from '../../../types/analytics';

/**
 * Фикстура обзора: цифры из production 12.09.2026 (last_7_days) — реальные,
 * не выдуманные. `makeOverview` даёт глубокое переопределение отдельных полей.
 */
const flat = (current: number, previous: number): Comparison => ({
  current,
  previous,
  delta: current - previous,
  deltaPct: previous === 0 ? null : ((current - previous) / previous) * 100,
  changeKind: previous === 0 ? (current === 0 ? 'FLAT' : 'NEW') : current === previous ? 'FLAT' : current > previous ? 'UP' : 'DOWN',
});

const KEYS: ComparisonKey[] = [
  'visits', 'periodUsers', 'pageviews', 'siteLeads', 'matchedAccepted', 'matchedPaid', 'crmLeads', 'acceptedOrders', 'paidOrders',
  'cancelledOrders', 'realizedOrders', 'contractValue', 'paidOrderValue', 'realizedRevenue', 'netProfit', 'siteLeadConversion',
  'crmLeadToAccepted', 'crmAcceptedToPaid', 'paidAov',
];

function comparison(): ComparisonSet {
  const base: Partial<ComparisonSet> = {
    visits: flat(185, 213),
    periodUsers: { current: 131, previous: null, delta: null, deltaPct: null, changeKind: 'NA' },
    siteLeads: flat(2, 0),
    acceptedOrders: flat(42, 40),
    paidOrders: flat(3, 33),
    realizedRevenue: flat(62462, 64599),
    netProfit: flat(43247, 32968),
  };
  return Object.fromEntries(KEYS.map((k) => [k, base[k] ?? flat(0, 0)])) as ComparisonSet;
}

export function baseOverview(): Overview {
  return {
    period: { from: '2026-09-06', to: '2026-09-12', kind: 'days', preset: 'last_7_days' },
    previousPeriod: { from: '2026-08-30', to: '2026-09-05', kind: 'days', preset: null },
    traffic: { visits: 185, periodUsers: 131, sumDailyUsers: 149, pageviews: 1042, pageviewsSession: 1042, pageviewsPage: 1163, daysWithTraffic: 7, quality: { completeness: 'complete', notes: [] } },
    siteFunnel: {
      visits: 185, siteLeads: 2, matchedAccepted: 1, matchedPaid: 0,
      siteLeadConversion: 1.0810810810810811, siteAcceptedConversion: 0.5405405405405406, sitePaidConversion: 0,
      siteLeadToAccepted: 50, siteAcceptedToPaid: 0,
      quality: { completeness: 'partial', notes: ['INCOMPLETE_LEGACY_SITE_LEADS', 'CRM_GOALS_BEFORE_ROLLOUT'] },
    },
    crmFunnel: {
      events: { crmLeads: 13, acceptedOrders: 42, paidOrders: 3, cancelledOrders: 0, cancellationEvents: 0, currentlyCancelledOrders: 0, realizedOrders: 37 },
      cohorts: { leadCohortSize: 13, leadCohortAccepted: 11, leadCohortPaid: 1, acceptedCohortSize: 42, acceptedCohortPaid: 5, acceptedCohortCancelled: 0, crmLeadToAccepted: 84.61538461538461, crmAcceptedToPaid: 11.904761904761903, crmLeadToPaid: 7.6923076923076925, crmCancellationRate: 0 },
      quality: { completeness: 'complete', notes: [] },
    },
    orders: { acceptedOrders: 42, paidOrders: 3, cancelledOrders: 0, currentlyCancelledOrders: 0, realizedOrders: 37, paidWithoutDate: 0, acceptedAov: 1780.5, paidAov: 1972.71, headlineAov: 1972.71, quality: { completeness: 'complete', notes: [] } },
    financials: {
      currency: 'RUB',
      contract: { orders: 42, contractValue: 74781, cogs: 20115, grossContribution: 54666, cogsReliableOrders: 42 },
      paid: { orders: 3, paidOrderValue: 5918, cogs: 1200, grossContribution: 4718 },
      realized: {
        orders: 37, realizedRevenue: 62462, realizedGoodsRevenue: 57487, cogs: 16330, grossContribution: 41157, salaryAccrued: 9781, operatingExpenses: 0, deliveryProfit: 3490,
        netProfit: 43247, marginPct: 69.24, byCategory: { photo: { orders: 20, revenue: 30000, profit: 20000 }, tshirt: { orders: 12, revenue: 25000, profit: 18000 }, canvas: { orders: 5, revenue: 7462, profit: 5247 } },
      },
      spend: { status: 'UNAVAILABLE_NO_SPEND_DATA' },
      quality: { completeness: 'complete', notes: [] },
    },
    dataQuality: {
      freshness: { lastMetrikaSyncAt: '2026-09-12T18:11:57.000Z', metrikaDataAgeSeconds: 720, status: 'FRESH', thresholdSeconds: 7200 },
      clientIdCoverageAccepted: 9.52, clientIdCoveragePaid: 0, eligibleAccepted: 0, eligibleDeliveredToMetrika: 0, metrikaMatchCoverage: null, matchedAcceptedReaches: 1,
      paidWithoutDate: 0, siteLeadsLegacy: true, crmGoalsBeforeRollout: true, snapshotAvailable: true,
      notes: ['INCOMPLETE_LEGACY_SITE_LEADS', 'CRM_GOALS_BEFORE_ROLLOUT'],
    },
    comparison: comparison(),
    metadata: {
      timezone: 'Europe/Moscow', leadSemantics: '', pageviewSemantics: '', usersSemantics: '', aovSemantics: '',
      cutovers: { falseBrowserPurchaseStoppedAt: '2026-09-12 13:19:22 Europe/Moscow', leadGoalSemanticsChangedAt: '2026-09-12 13:19:22 Europe/Moscow', crmToMetrikaLiveSince: '2026-09-12 12:20:10 Europe/Moscow', counterDataSince: '2026-08-13' },
      lastMetrikaSyncAt: '2026-09-12T18:11:57.000Z', generatedAt: '2026-09-12T18:23:57.000Z',
    },
  };
}

type DeepPartialValue<V> = V extends Array<unknown> ? V : V extends object ? DeepPartial<V> : V;
type DeepPartial<T> = { [K in keyof T]?: DeepPartialValue<T[K]> };

function merge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out = { ...(base as Record<string, unknown>) } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const cur = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur) ? merge(cur, v as DeepPartial<unknown>) : v;
  }
  return out as T;
}

export function makeOverview(over: DeepPartial<Overview> = {}): Overview {
  return merge(baseOverview(), over);
}
