import {
  orderCostOfGoods,
  type CostSettings,
  type OrderCogsSource,
} from '../../reports/order-cogs';
import type { PnlReport } from '../../reports/reports.service';
import {
  COUNTER_DATA_SINCE,
  CRM_TO_METRIKA_LIVE_AT,
  CRM_TO_METRIKA_LIVE_SINCE,
  FALSE_BROWSER_PURCHASE_STOPPED_AT,
  FRESHNESS_THRESHOLD_SECONDS,
  LEAD_GOAL_SEMANTICS_CHANGED_AT,
  WEB_CUTOVER_COMPLETE_FROM,
} from './analytics-constants';
import {
  inPeriod,
  previousPeriod,
  type AnalyticsPeriod,
} from './analytics-period';
import type {
  ComparisonSet,
  CrmFunnelMetrics,
  CrmSlice,
  DataQualityMetrics,
  DeviceRow,
  FinancialMetrics,
  Freshness,
  GroupQuality,
  LandingRow,
  MatchedFunnelRates,
  OrdersMetrics,
  Overview,
  ProductRow,
  QualityNote,
  RealizedFinancials,
  SalesChannelRow,
  SiteFunnelMetrics,
  Slice,
  SourceRow,
  TrafficMetrics,
  UtmRow,
} from './metrics-contract';
import {
  deriveOrderLifecycle,
  type LifecycleTransition,
  type OrderLifecycle,
} from './order-lifecycle';
import { compare, percent, ratio } from './ratios';

/**
 * Чистые вычисления метрик (этап 08). Ни базы, ни API: на входе — строки
 * локальных таблиц Метрики за период, заказы CRM с историей статусов и
 * позициями, снимок периода, P&L отчёта; на выходе — контракт. Так каждое
 * правило проверяется тестом на фикстуре, а сервис лишь собирает вход.
 */

// ---------------------------------------------------------------------------
// Вход

export interface CrmOrderInput extends OrderCogsSource {
  id: string;
  createdAt: Date;
  status: string;
  sourceOrder: string;
  totalOrder: number;
  clientPaidAt: Date | null;
  completedAt: Date | null;
  statusChangedAt: Date | null;
  sentAt: Date | null;
  yandexClientId: string | null;
  statusHistory: LifecycleTransition[];
  /** Есть доставленная строка очереди CRM→Метрика. */
  deliveredToMetrika: boolean;
}

export interface DailyTrafficInput {
  date: string;
  visits: number;
  users: number;
  pageviews: number;
}

export interface DailyGoalInput {
  date: string;
  goalId: number;
  reaches: number;
}

export interface DimensionDailyInput {
  date: string;
  visits: number;
  pageviews?: number;
  leadReaches: number;
  orderCreatedReaches: number;
  orderPaidReaches: number;
}

export interface SourceDailyInput extends DimensionDailyInput {
  trafficSource: string;
  trafficSourceName: string;
  sourceEngine: string;
  sourceEngineName: string;
}

export interface UtmDailyInput extends DimensionDailyInput {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

export interface LandingDailyInput extends DimensionDailyInput {
  normalizedPath: string;
}

export interface DeviceDailyInput extends DimensionDailyInput {
  deviceCategory: string;
}

export interface PeriodSnapshotInput {
  users: number;
  visits: number;
  pageviews: number;
  fetchedAt: Date;
  sampled: boolean;
}

export interface CanonicalGoalIds {
  lead: number;
  created: number;
  paid: number;
}

export interface MetrikaPeriodInput {
  traffic: DailyTrafficInput[];
  goals: DailyGoalInput[];
  /** Σ ym:pv:pageviews за период (набор pages). */
  pagesPageviews: number;
  snapshot: PeriodSnapshotInput | null;
}

export interface OverviewInputs {
  period: AnalyticsPeriod;
  previousPeriod?: AnalyticsPeriod;
  now: Date;
  goalIds: CanonicalGoalIds;
  settings: CostSettings;
  lastMetrikaSyncAt: Date | null;
  current: { metrika: MetrikaPeriodInput; pnl: PnlReport | null };
  /** Для сравнения; без него comparison = null. */
  previous?: { metrika: MetrikaPeriodInput; pnl: PnlReport | null };
  /** Все заказы, созданные до конца периода сравнения (или текущего). */
  orders: CrmOrderInput[];
}

// ---------------------------------------------------------------------------
// Вспомогательное

function sum<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + pick(r), 0);
}

function quality(
  notes: QualityNote[],
  completeness?: GroupQuality['completeness'],
): GroupQuality {
  return {
    completeness: completeness ?? (notes.length > 0 ? 'partial' : 'complete'),
    notes,
  };
}

/** Период задевает время до web cutover — lead_submitted там неполный. */
export function siteLeadsLegacy(period: AnalyticsPeriod): boolean {
  return period.from < WEB_CUTOVER_COMPLETE_FROM;
}

/** Период задевает время до включения CRM→Метрика — CRM-цели там не могли появиться. */
export function crmGoalsBeforeRollout(period: AnalyticsPeriod): boolean {
  return period.from < WEB_CUTOVER_COMPLETE_FROM;
}

export function freshnessOf(
  lastMetrikaSyncAt: Date | null,
  now: Date,
): Freshness {
  if (!lastMetrikaSyncAt) {
    return {
      lastMetrikaSyncAt: null,
      metrikaDataAgeSeconds: null,
      status: 'NO_DATA',
      thresholdSeconds: FRESHNESS_THRESHOLD_SECONDS,
    };
  }
  const age = Math.max(
    0,
    Math.round((now.getTime() - lastMetrikaSyncAt.getTime()) / 1000),
  );
  return {
    lastMetrikaSyncAt,
    metrikaDataAgeSeconds: age,
    status: age <= FRESHNESS_THRESHOLD_SECONDS ? 'FRESH' : 'STALE',
    thresholdSeconds: FRESHNESS_THRESHOLD_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Трафик и воронка сайта

export function computeTraffic(
  m: MetrikaPeriodInput,
  period: AnalyticsPeriod,
  freshness: Freshness,
): TrafficMetrics {
  const notes: QualityNote[] = [];
  if (!m.snapshot) notes.push('NO_PERIOD_SNAPSHOT');
  else if (m.snapshot.sampled) notes.push('SNAPSHOT_SAMPLED');
  if (freshness.status === 'STALE') notes.push('METRIKA_STALE');
  if (freshness.status === 'NO_DATA') notes.push('METRIKA_NO_DATA');
  if (period.from < COUNTER_DATA_SINCE) notes.push('PERIOD_BEFORE_COUNTER');
  const pageviewsSession = sum(m.traffic, (r) => r.pageviews);
  return {
    visits: sum(m.traffic, (r) => r.visits),
    periodUsers: m.snapshot ? m.snapshot.users : null,
    sumDailyUsers: sum(m.traffic, (r) => r.users),
    pageviews: pageviewsSession,
    pageviewsSession,
    pageviewsPage: m.pagesPageviews,
    daysWithTraffic: m.traffic.filter((r) => r.visits > 0).length,
    quality: quality(
      notes,
      freshness.status === 'NO_DATA' ? 'unavailable' : undefined,
    ),
  };
}

export function goalSum(goals: DailyGoalInput[], goalId: number): number {
  return sum(
    goals.filter((g) => g.goalId === goalId),
    (g) => g.reaches,
  );
}

export function computeSiteFunnel(
  m: MetrikaPeriodInput,
  goalIds: CanonicalGoalIds,
  period: AnalyticsPeriod,
): SiteFunnelMetrics {
  const visits = sum(m.traffic, (r) => r.visits);
  const siteLeads = goalSum(m.goals, goalIds.lead);
  const matchedAccepted = goalSum(m.goals, goalIds.created);
  const matchedPaid = goalSum(m.goals, goalIds.paid);
  const notes: QualityNote[] = [];
  if (siteLeadsLegacy(period)) notes.push('INCOMPLETE_LEGACY_SITE_LEADS');
  if (crmGoalsBeforeRollout(period)) notes.push('CRM_GOALS_BEFORE_ROLLOUT');
  return {
    visits,
    siteLeads,
    matchedAccepted,
    matchedPaid,
    siteLeadConversion: percent(siteLeads, visits),
    siteAcceptedConversion: percent(matchedAccepted, visits),
    sitePaidConversion: percent(matchedPaid, visits),
    siteLeadToAccepted: percent(matchedAccepted, siteLeads),
    siteAcceptedToPaid: percent(matchedPaid, matchedAccepted),
    quality: quality(notes),
  };
}

// ---------------------------------------------------------------------------
// CRM: жизненный цикл, воронка, заказы, деньги

export interface OrderWithLifecycle {
  order: CrmOrderInput;
  lifecycle: OrderLifecycle;
}

export function withLifecycles(orders: CrmOrderInput[]): OrderWithLifecycle[] {
  return orders.map((order) => ({
    order,
    lifecycle: deriveOrderLifecycle(order, order.statusHistory),
  }));
}

export interface CrmPeriodSets {
  leads: OrderWithLifecycle[];
  accepted: OrderWithLifecycle[];
  paid: OrderWithLifecycle[];
  /** Заказы с первой отменой в периоде — историческое событие, возврат в работу его не стирает. */
  cancelled: OrderWithLifecycle[];
  realized: OrderWithLifecycle[];
  /** Число переходов в CANCELLED внутри периода (операционный счётчик, не заказы). */
  cancellationEvents: number;
}

export function crmPeriodSets(
  all: OrderWithLifecycle[],
  period: AnalyticsPeriod,
): CrmPeriodSets {
  return {
    leads: all.filter((o) => inPeriod(o.lifecycle.leadAt, period)),
    accepted: all.filter((o) => inPeriod(o.lifecycle.acceptedAt, period)),
    paid: all.filter((o) => inPeriod(o.lifecycle.paidAt, period)),
    cancelled: all.filter((o) =>
      inPeriod(o.lifecycle.firstCancelledAt, period),
    ),
    realized: all.filter((o) => inPeriod(o.lifecycle.realizedAt, period)),
    cancellationEvents: all.reduce(
      (sum, o) =>
        sum +
        o.lifecycle.cancellationTimes.filter((at) => inPeriod(at, period))
          .length,
      0,
    ),
  };
}

export function computeCrmFunnel(sets: CrmPeriodSets): CrmFunnelMetrics {
  const leadCohortAccepted = sets.leads.filter(
    (o) => o.lifecycle.acceptedAt !== null,
  ).length;
  const leadCohortPaid = sets.leads.filter(
    (o) => o.lifecycle.paidAt !== null,
  ).length;
  const acceptedCohortPaid = sets.accepted.filter(
    (o) => o.lifecycle.paidAt !== null,
  ).length;
  // Когорта принятых: отменялся ли заказ хоть раз — возврат в работу факт не стирает.
  const acceptedCohortCancelled = sets.accepted.filter(
    (o) => o.lifecycle.wasEverCancelled,
  ).length;
  const paidWithoutDate = sets.accepted.filter(
    (o) => o.lifecycle.paidWithoutDate,
  ).length;
  return {
    events: {
      crmLeads: sets.leads.length,
      acceptedOrders: sets.accepted.length,
      paidOrders: sets.paid.length,
      cancelledOrders: sets.cancelled.length,
      cancellationEvents: sets.cancellationEvents,
      currentlyCancelledOrders: sets.cancelled.filter(
        (o) => o.lifecycle.currentlyCancelled,
      ).length,
      realizedOrders: sets.realized.length,
    },
    cohorts: {
      leadCohortSize: sets.leads.length,
      leadCohortAccepted,
      leadCohortPaid,
      acceptedCohortSize: sets.accepted.length,
      acceptedCohortPaid,
      acceptedCohortCancelled,
      crmLeadToAccepted: percent(leadCohortAccepted, sets.leads.length),
      crmAcceptedToPaid: percent(acceptedCohortPaid, sets.accepted.length),
      crmLeadToPaid: percent(leadCohortPaid, sets.leads.length),
      crmCancellationRate: percent(
        acceptedCohortCancelled,
        sets.accepted.length,
      ),
    },
    quality: quality(paidWithoutDate > 0 ? ['PAID_WITHOUT_DATE'] : []),
  };
}

function contractValue(rows: OrderWithLifecycle[]): number {
  return sum(rows, (o) => o.order.totalOrder);
}

function cogsOf(
  rows: OrderWithLifecycle[],
  settings: CostSettings,
): { cogs: number; reliable: number } {
  let cogs = 0;
  let reliable = 0;
  for (const { order } of rows) {
    const c = orderCostOfGoods(order, settings);
    cogs += c.rub;
    if (c.reliable) reliable += 1;
  }
  return { cogs, reliable };
}

export function computeOrders(sets: CrmPeriodSets): OrdersMetrics {
  const paidWithoutDate = sets.accepted.filter(
    (o) => o.lifecycle.paidWithoutDate,
  ).length;
  const acceptedAov = ratio(contractValue(sets.accepted), sets.accepted.length);
  const paidAov = ratio(contractValue(sets.paid), sets.paid.length);
  return {
    acceptedOrders: sets.accepted.length,
    paidOrders: sets.paid.length,
    cancelledOrders: sets.cancelled.length,
    currentlyCancelledOrders: sets.cancelled.filter(
      (o) => o.lifecycle.currentlyCancelled,
    ).length,
    realizedOrders: sets.realized.length,
    paidWithoutDate,
    acceptedAov,
    paidAov,
    headlineAov: paidAov,
    quality: quality(paidWithoutDate > 0 ? ['PAID_WITHOUT_DATE'] : []),
  };
}

export function realizedFromPnl(pnl: PnlReport): RealizedFinancials {
  return {
    orders: pnl.orderCount,
    realizedRevenue: pnl.totalRevenue,
    realizedGoodsRevenue: pnl.netRevenue,
    cogs: pnl.cogs,
    grossContribution: pnl.grossProfit,
    salaryAccrued: pnl.salaryAccrued,
    operatingExpenses: pnl.operatingExpenses,
    deliveryProfit: pnl.deliveryProfit,
    netProfit: pnl.netProfit,
    marginPct: percent(pnl.netProfit, pnl.totalRevenue),
    byCategory: {
      photo: {
        orders: pnl.photoCount,
        revenue: pnl.photoRevenue,
        profit: pnl.photoProfit,
      },
      tshirt: {
        orders: pnl.tshirtCount,
        revenue: pnl.tshirtRevenue,
        profit: pnl.tshirtProfit,
      },
      canvas: {
        orders: pnl.canvasCount,
        revenue: pnl.canvasRevenue,
        profit: pnl.canvasProfit,
      },
    },
  };
}

export function computeFinancials(
  sets: CrmPeriodSets,
  pnl: PnlReport | null,
  settings: CostSettings,
): FinancialMetrics {
  const accepted = cogsOf(sets.accepted, settings);
  const paid = cogsOf(sets.paid, settings);
  const contract = contractValue(sets.accepted);
  const paidValue = contractValue(sets.paid);
  const notes: QualityNote[] = [];
  if (accepted.reliable < sets.accepted.length)
    notes.push('COGS_UNRELIABLE_ORDERS');
  if (!pnl) notes.push('PNL_UNAVAILABLE');
  return {
    currency: 'RUB',
    contract: {
      orders: sets.accepted.length,
      contractValue: contract,
      cogs: accepted.cogs,
      grossContribution: contract - accepted.cogs,
      cogsReliableOrders: accepted.reliable,
    },
    paid: {
      orders: sets.paid.length,
      paidOrderValue: paidValue,
      cogs: paid.cogs,
      grossContribution: paidValue - paid.cogs,
    },
    realized: pnl ? realizedFromPnl(pnl) : null,
    spend: {
      status: 'UNAVAILABLE_NO_SPEND_DATA',
      cpl: null,
      cpa: null,
      cpo: null,
      roas: null,
      romi: null,
    },
    quality: quality(notes, pnl ? undefined : 'partial'),
  };
}

export function computeDataQuality(
  sets: CrmPeriodSets,
  site: SiteFunnelMetrics,
  m: MetrikaPeriodInput,
  period: AnalyticsPeriod,
  freshness: Freshness,
): DataQualityMetrics {
  const acceptedWithClientId = sets.accepted.filter(
    (o) => o.order.yandexClientId,
  ).length;
  const paidWithClientId = sets.paid.filter(
    (o) => o.order.yandexClientId,
  ).length;
  const eligible = sets.accepted.filter(
    (o) =>
      o.order.yandexClientId &&
      o.lifecycle.acceptedAt !== null &&
      o.lifecycle.acceptedAt >= CRM_TO_METRIKA_LIVE_AT,
  );
  const eligibleDelivered = eligible.filter(
    (o) => o.order.deliveredToMetrika,
  ).length;
  const paidWithoutDate = sets.accepted.filter(
    (o) => o.lifecycle.paidWithoutDate,
  ).length;
  const notes: QualityNote[] = [];
  if (siteLeadsLegacy(period)) notes.push('INCOMPLETE_LEGACY_SITE_LEADS');
  if (crmGoalsBeforeRollout(period)) notes.push('CRM_GOALS_BEFORE_ROLLOUT');
  if (!m.snapshot) notes.push('NO_PERIOD_SNAPSHOT');
  if (freshness.status === 'STALE') notes.push('METRIKA_STALE');
  if (freshness.status === 'NO_DATA') notes.push('METRIKA_NO_DATA');
  if (paidWithoutDate > 0) notes.push('PAID_WITHOUT_DATE');
  if (period.from < COUNTER_DATA_SINCE) notes.push('PERIOD_BEFORE_COUNTER');
  return {
    freshness,
    clientIdCoverageAccepted: percent(
      acceptedWithClientId,
      sets.accepted.length,
    ),
    clientIdCoveragePaid: percent(paidWithClientId, sets.paid.length),
    eligibleAccepted: eligible.length,
    eligibleDeliveredToMetrika: eligibleDelivered,
    metrikaMatchCoverage: percent(eligibleDelivered, eligible.length),
    matchedAcceptedReaches: site.matchedAccepted,
    paidWithoutDate,
    siteLeadsLegacy: siteLeadsLegacy(period),
    crmGoalsBeforeRollout: crmGoalsBeforeRollout(period),
    snapshotAvailable: m.snapshot !== null,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Обзор и сравнение

export interface PeriodComputation {
  traffic: TrafficMetrics;
  siteFunnel: SiteFunnelMetrics;
  crmFunnel: CrmFunnelMetrics;
  orders: OrdersMetrics;
  financials: FinancialMetrics;
  dataQuality: DataQualityMetrics;
}

export function computePeriod(
  period: AnalyticsPeriod,
  metrika: MetrikaPeriodInput,
  pnl: PnlReport | null,
  all: OrderWithLifecycle[],
  goalIds: CanonicalGoalIds,
  settings: CostSettings,
  freshness: Freshness,
): PeriodComputation {
  const sets = crmPeriodSets(all, period);
  const siteFunnel = computeSiteFunnel(metrika, goalIds, period);
  return {
    traffic: computeTraffic(metrika, period, freshness),
    siteFunnel,
    crmFunnel: computeCrmFunnel(sets),
    orders: computeOrders(sets),
    financials: computeFinancials(sets, pnl, settings),
    dataQuality: computeDataQuality(
      sets,
      siteFunnel,
      metrika,
      period,
      freshness,
    ),
  };
}

export function compareComputations(
  cur: PeriodComputation,
  prev: PeriodComputation,
): ComparisonSet {
  return {
    visits: compare(cur.traffic.visits, prev.traffic.visits),
    periodUsers: compare(cur.traffic.periodUsers, prev.traffic.periodUsers),
    pageviews: compare(cur.traffic.pageviews, prev.traffic.pageviews),
    siteLeads: compare(cur.siteFunnel.siteLeads, prev.siteFunnel.siteLeads),
    matchedAccepted: compare(
      cur.siteFunnel.matchedAccepted,
      prev.siteFunnel.matchedAccepted,
    ),
    matchedPaid: compare(
      cur.siteFunnel.matchedPaid,
      prev.siteFunnel.matchedPaid,
    ),
    crmLeads: compare(
      cur.crmFunnel.events.crmLeads,
      prev.crmFunnel.events.crmLeads,
    ),
    acceptedOrders: compare(
      cur.crmFunnel.events.acceptedOrders,
      prev.crmFunnel.events.acceptedOrders,
    ),
    paidOrders: compare(
      cur.crmFunnel.events.paidOrders,
      prev.crmFunnel.events.paidOrders,
    ),
    cancelledOrders: compare(
      cur.crmFunnel.events.cancelledOrders,
      prev.crmFunnel.events.cancelledOrders,
    ),
    realizedOrders: compare(
      cur.crmFunnel.events.realizedOrders,
      prev.crmFunnel.events.realizedOrders,
    ),
    contractValue: compare(
      cur.financials.contract.contractValue,
      prev.financials.contract.contractValue,
    ),
    paidOrderValue: compare(
      cur.financials.paid.paidOrderValue,
      prev.financials.paid.paidOrderValue,
    ),
    realizedRevenue: compare(
      cur.financials.realized?.realizedRevenue ?? null,
      prev.financials.realized?.realizedRevenue ?? null,
    ),
    netProfit: compare(
      cur.financials.realized?.netProfit ?? null,
      prev.financials.realized?.netProfit ?? null,
    ),
    siteLeadConversion: compare(
      cur.siteFunnel.siteLeadConversion,
      prev.siteFunnel.siteLeadConversion,
    ),
    crmLeadToAccepted: compare(
      cur.crmFunnel.cohorts.crmLeadToAccepted,
      prev.crmFunnel.cohorts.crmLeadToAccepted,
    ),
    crmAcceptedToPaid: compare(
      cur.crmFunnel.cohorts.crmAcceptedToPaid,
      prev.crmFunnel.cohorts.crmAcceptedToPaid,
    ),
    paidAov: compare(cur.orders.paidAov, prev.orders.paidAov),
  };
}

export function computeOverview(inputs: OverviewInputs): Overview {
  const prevPeriod = inputs.previousPeriod ?? previousPeriod(inputs.period);
  const all = withLifecycles(inputs.orders);
  const freshness = freshnessOf(inputs.lastMetrikaSyncAt, inputs.now);
  const cur = computePeriod(
    inputs.period,
    inputs.current.metrika,
    inputs.current.pnl,
    all,
    inputs.goalIds,
    inputs.settings,
    freshness,
  );
  const prev = inputs.previous
    ? computePeriod(
        prevPeriod,
        inputs.previous.metrika,
        inputs.previous.pnl,
        all,
        inputs.goalIds,
        inputs.settings,
        freshness,
      )
    : null;
  return {
    period: inputs.period,
    previousPeriod: prevPeriod,
    ...cur,
    comparison: prev ? compareComputations(cur, prev) : null,
    metadata: {
      timezone: 'Europe/Moscow',
      leadSemantics:
        'siteLeads = достижения lead_submitted (Метрика), полные с 2026-09-13; crmLeads = заказы CRM с leadAt в периоде (создан как LEAD или побывал в LEAD)',
      pageviewSemantics:
        'pageviews = ym:s:pageviews (просмотры внутри визитов); pageviewsPage = ym:pv:pageviews — для аналитики страниц',
      usersSemantics:
        'periodUsers — уникальные за период из MetrikaPeriodSnapshot (отдельный запрос к API); sumDailyUsers — сумма дневных уникальных, не уникальные периода',
      aovSemantics:
        'headlineAov = paidAov = paidOrderValue / paidOrders; acceptedAov — по договорной сумме принятых',
      cutovers: {
        falseBrowserPurchaseStoppedAt: FALSE_BROWSER_PURCHASE_STOPPED_AT,
        leadGoalSemanticsChangedAt: LEAD_GOAL_SEMANTICS_CHANGED_AT,
        crmToMetrikaLiveSince: CRM_TO_METRIKA_LIVE_SINCE,
        counterDataSince: COUNTER_DATA_SINCE,
      },
      lastMetrikaSyncAt: inputs.lastMetrikaSyncAt,
      generatedAt: inputs.now,
    },
  };
}

// ---------------------------------------------------------------------------
// Срезы Метрики (сопоставленная воронка по измерению)

function rates(
  visits: number,
  siteLeads: number,
  matchedAccepted: number,
  matchedPaid: number,
): MatchedFunnelRates {
  return {
    visits,
    siteLeads,
    matchedAccepted,
    matchedPaid,
    visitToLead: percent(siteLeads, visits),
    visitToAccepted: percent(matchedAccepted, visits),
    visitToPaid: percent(matchedPaid, visits),
    leadToAccepted: percent(matchedAccepted, siteLeads),
    acceptedToPaid: percent(matchedPaid, matchedAccepted),
  };
}

function groupRows<R extends DimensionDailyInput, Out>(
  rows: R[],
  key: (r: R) => string,
  build: (
    sample: R,
    agg: {
      visits: number;
      pageviews: number;
      leads: number;
      created: number;
      paid: number;
    },
  ) => Out,
): Out[] {
  const groups = new Map<
    string,
    {
      sample: R;
      visits: number;
      pageviews: number;
      leads: number;
      created: number;
      paid: number;
    }
  >();
  for (const r of rows) {
    const k = key(r);
    const g = groups.get(k) ?? {
      sample: r,
      visits: 0,
      pageviews: 0,
      leads: 0,
      created: 0,
      paid: 0,
    };
    g.visits += r.visits;
    g.pageviews += r.pageviews ?? 0;
    g.leads += r.leadReaches;
    g.created += r.orderCreatedReaches;
    g.paid += r.orderPaidReaches;
    groups.set(k, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.visits - a.visits)
    .map((g) => build(g.sample, g));
}

function sliceTotals(rows: DimensionDailyInput[]): MatchedFunnelRates {
  return rates(
    sum(rows, (r) => r.visits),
    sum(rows, (r) => r.leadReaches),
    sum(rows, (r) => r.orderCreatedReaches),
    sum(rows, (r) => r.orderPaidReaches),
  );
}

function sliceQuality(period: AnalyticsPeriod): GroupQuality {
  const notes: QualityNote[] = [];
  if (siteLeadsLegacy(period)) notes.push('INCOMPLETE_LEGACY_SITE_LEADS');
  if (crmGoalsBeforeRollout(period)) notes.push('CRM_GOALS_BEFORE_ROLLOUT');
  return quality(notes);
}

export function computeSources(
  rows: SourceDailyInput[],
  period: AnalyticsPeriod,
): Slice<SourceRow> {
  return {
    period,
    rows: groupRows(
      rows,
      (r) => `${r.trafficSource}|${r.sourceEngine}`,
      (s, g) => ({
        trafficSource: s.trafficSource,
        trafficSourceName: s.trafficSourceName,
        sourceEngine: s.sourceEngine,
        sourceEngineName: s.sourceEngineName,
        pageviews: g.pageviews,
        ...rates(g.visits, g.leads, g.created, g.paid),
      }),
    ),
    totals: sliceTotals(rows),
    quality: sliceQuality(period),
  };
}

export const NO_UTM = 'NO_UTM';

export function computeUtm(
  rows: UtmDailyInput[],
  period: AnalyticsPeriod,
): Slice<UtmRow> {
  const label = (v: string) => (v === '' ? NO_UTM : v);
  return {
    period,
    rows: groupRows(
      rows,
      (r) =>
        [r.utmSource, r.utmMedium, r.utmCampaign, r.utmContent, r.utmTerm].join(
          '|',
        ),
      (s, g) => ({
        utmSource: label(s.utmSource),
        utmMedium: label(s.utmMedium),
        utmCampaign: label(s.utmCampaign),
        utmContent: label(s.utmContent),
        utmTerm: label(s.utmTerm),
        isNoUtm:
          s.utmSource === '' && s.utmMedium === '' && s.utmCampaign === '',
        ...rates(g.visits, g.leads, g.created, g.paid),
      }),
    ),
    totals: sliceTotals(rows),
    quality: sliceQuality(period),
  };
}

export function computeLandings(
  rows: LandingDailyInput[],
  period: AnalyticsPeriod,
): Slice<LandingRow> {
  return {
    period,
    rows: groupRows(
      rows,
      (r) => r.normalizedPath,
      (s, g) => ({
        normalizedPath: s.normalizedPath,
        ...rates(g.visits, g.leads, g.created, g.paid),
      }),
    ),
    totals: sliceTotals(rows),
    quality: sliceQuality(period),
  };
}

export function computeDevices(
  rows: DeviceDailyInput[],
  period: AnalyticsPeriod,
): Slice<DeviceRow> {
  return {
    period,
    rows: groupRows(
      rows,
      (r) => r.deviceCategory,
      (s, g) => ({
        deviceCategory: s.deviceCategory,
        ...rates(g.visits, g.leads, g.created, g.paid),
      }),
    ),
    totals: sliceTotals(rows),
    quality: sliceQuality(period),
  };
}

// ---------------------------------------------------------------------------
// Срезы CRM

export function computeProducts(
  all: OrderWithLifecycle[],
  period: AnalyticsPeriod,
  settings: CostSettings,
): CrmSlice<ProductRow> {
  const sets = crmPeriodSets(all, period);
  const categories = ['PHOTO', 'TSHIRT', 'CANVAS'];
  for (const o of [...sets.accepted, ...sets.paid]) {
    if (!categories.includes(o.order.productCategory))
      categories.push(o.order.productCategory);
  }
  const rows: ProductRow[] = categories.map((cat) => {
    const accepted = sets.accepted.filter(
      (o) => o.order.productCategory === cat,
    );
    const paid = sets.paid.filter((o) => o.order.productCategory === cat);
    const cancelled = sets.cancelled.filter(
      (o) => o.order.productCategory === cat,
    );
    const c = cogsOf(accepted, settings);
    const contract = contractValue(accepted);
    return {
      productCategory: cat,
      acceptedOrders: accepted.length,
      paidOrders: paid.length,
      cancelledOrders: cancelled.length,
      contractValue: contract,
      paidOrderValue: contractValue(paid),
      cogs: c.cogs,
      cogsReliableOrders: c.reliable,
      grossContribution: contract - c.cogs,
      acceptedAov: ratio(contract, accepted.length),
      paidAov: ratio(contractValue(paid), paid.length),
    };
  });
  const unreliable = rows.some((r) => r.cogsReliableOrders < r.acceptedOrders);
  return {
    period,
    rows,
    quality: quality(unreliable ? ['COGS_UNRELIABLE_ORDERS'] : []),
  };
}

export function computeSalesChannels(
  all: OrderWithLifecycle[],
  period: AnalyticsPeriod,
): CrmSlice<SalesChannelRow> {
  const sets = crmPeriodSets(all, period);
  const channels = ['AVITO', 'OZON', 'WB', 'LOCAL'];
  for (const o of [...sets.leads, ...sets.accepted, ...sets.paid]) {
    if (!channels.includes(o.order.sourceOrder))
      channels.push(o.order.sourceOrder);
  }
  const rows: SalesChannelRow[] = channels.map((ch) => {
    const accepted = sets.accepted.filter((o) => o.order.sourceOrder === ch);
    const paid = sets.paid.filter((o) => o.order.sourceOrder === ch);
    return {
      salesChannel: ch,
      crmLeads: sets.leads.filter((o) => o.order.sourceOrder === ch).length,
      acceptedOrders: accepted.length,
      paidOrders: paid.length,
      cancelledOrders: sets.cancelled.filter((o) => o.order.sourceOrder === ch)
        .length,
      contractValue: contractValue(accepted),
      paidOrderValue: contractValue(paid),
      acceptedAov: ratio(contractValue(accepted), accepted.length),
      paidAov: ratio(contractValue(paid), paid.length),
    };
  });
  return { period, rows, quality: quality([]) };
}
