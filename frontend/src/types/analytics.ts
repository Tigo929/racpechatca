/**
 * Контракт дашборда (этап 09) — зеркало `crm-new/src/analytics/metrics/metrics-contract.ts`
 * и ответа `GET /analytics/dashboard/*`. Панель только читает эти поля и ничего не
 * пересчитывает: формулы живут в AnalyticsMetricsService, см. docs/analytics/DASHBOARD_CONTRACT.md.
 */

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'previous_7_days'
  | 'last_30_days'
  | 'previous_30_days'
  | 'current_month'
  | 'previous_month';

export interface AnalyticsPeriod {
  from: string;
  to: string;
  kind: 'days' | 'month';
  preset: PeriodPreset | null;
}

export type Completeness = 'complete' | 'partial' | 'unavailable';

export type QualityNote =
  | 'INCOMPLETE_LEGACY_SITE_LEADS'
  | 'CRM_GOALS_BEFORE_ROLLOUT'
  | 'NO_PERIOD_SNAPSHOT'
  | 'SNAPSHOT_SAMPLED'
  | 'METRIKA_STALE'
  | 'METRIKA_NO_DATA'
  | 'PERIOD_BEFORE_COUNTER'
  | 'PAID_WITHOUT_DATE'
  | 'COGS_UNRELIABLE_ORDERS'
  | 'PNL_UNAVAILABLE'
  | 'UNAVAILABLE_NO_SPEND_DATA'
  /** Есть заказы, чьё происхождение по истории не доказано (этап 17). */
  | 'UNKNOWN_ORDER_ORIGIN';

export interface GroupQuality {
  completeness: Completeness;
  notes: QualityNote[];
}

export type ChangeKind = 'UP' | 'DOWN' | 'FLAT' | 'NEW' | 'GONE' | 'NA';

export interface Comparison {
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
  changeKind: ChangeKind;
}

export interface TrafficMetrics {
  visits: number;
  periodUsers: number | null;
  sumDailyUsers: number;
  pageviews: number;
  pageviewsSession: number;
  pageviewsPage: number;
  daysWithTraffic: number;
  quality: GroupQuality;
}

export interface SiteFunnelMetrics {
  visits: number;
  siteLeads: number;
  matchedAccepted: number;
  matchedPaid: number;
  siteLeadConversion: number | null;
  siteAcceptedConversion: number | null;
  sitePaidConversion: number | null;
  siteLeadToAccepted: number | null;
  siteAcceptedToPaid: number | null;
  quality: GroupQuality;
}

export interface CrmFunnelMetrics {
  events: {
    crmLeads: number;
    acceptedOrders: number;
    paidOrders: number;
    cancelledOrders: number;
    cancellationEvents: number;
    currentlyCancelledOrders: number;
    realizedOrders: number;
  };
  cohorts: {
    leadCohortSize: number;
    leadCohortAccepted: number;
    leadCohortPaid: number;
    acceptedCohortSize: number;
    acceptedCohortPaid: number;
    acceptedCohortCancelled: number;
    crmLeadToAccepted: number | null;
    crmAcceptedToPaid: number | null;
    crmLeadToPaid: number | null;
    crmCancellationRate: number | null;
  };
  quality: GroupQuality;
}

export interface OrdersMetrics {
  acceptedOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  currentlyCancelledOrders: number;
  realizedOrders: number;
  paidWithoutDate: number;
  acceptedAov: number | null;
  paidAov: number | null;
  headlineAov: number | null;
  quality: GroupQuality;
}

export interface CategoryPnl {
  orders: number;
  revenue: number;
  profit: number;
}

export interface RealizedFinancials {
  orders: number;
  realizedRevenue: number;
  realizedGoodsRevenue: number;
  cogs: number;
  grossContribution: number;
  salaryAccrued: number;
  operatingExpenses: number;
  deliveryProfit: number;
  netProfit: number;
  marginPct: number | null;
  byCategory: { photo: CategoryPnl; tshirt: CategoryPnl; canvas: CategoryPnl };
}

export interface FinancialMetrics {
  currency: 'RUB';
  contract: {
    orders: number;
    contractValue: number;
    cogs: number;
    grossContribution: number;
    cogsReliableOrders: number;
  };
  paid: {
    orders: number;
    paidOrderValue: number;
    cogs: number;
    grossContribution: number;
  };
  realized: RealizedFinancials | null;
  spend: { status: 'UNAVAILABLE_NO_SPEND_DATA' };
  quality: GroupQuality;
}

export type FreshnessStatus = 'FRESH' | 'STALE' | 'NO_DATA';

export interface Freshness {
  lastMetrikaSyncAt: string | null;
  metrikaDataAgeSeconds: number | null;
  status: FreshnessStatus;
  thresholdSeconds: number;
}

export interface DataQualityMetrics {
  freshness: Freshness;
  clientIdCoverageAccepted: number | null;
  clientIdCoveragePaid: number | null;
  eligibleAccepted: number;
  eligibleDeliveredToMetrika: number;
  metrikaMatchCoverage: number | null;
  matchedAcceptedReaches: number;
  paidWithoutDate: number;
  siteLeadsLegacy: boolean;
  crmGoalsBeforeRollout: boolean;
  snapshotAvailable: boolean;
  notes: QualityNote[];
}

export type ComparisonKey =
  | 'visits'
  | 'periodUsers'
  | 'pageviews'
  | 'siteLeads'
  | 'matchedAccepted'
  | 'matchedPaid'
  | 'crmLeads'
  | 'acceptedOrders'
  | 'paidOrders'
  | 'cancelledOrders'
  | 'realizedOrders'
  | 'contractValue'
  | 'paidOrderValue'
  | 'realizedRevenue'
  | 'netProfit'
  | 'siteLeadConversion'
  | 'crmLeadToAccepted'
  | 'crmAcceptedToPaid'
  | 'paidAov';

export type ComparisonSet = Record<ComparisonKey, Comparison>;

export interface OverviewMetadata {
  timezone: string;
  leadSemantics: string;
  pageviewSemantics: string;
  usersSemantics: string;
  aovSemantics: string;
  cutovers: {
    falseBrowserPurchaseStoppedAt: string;
    leadGoalSemanticsChangedAt: string;
    crmToMetrikaLiveSince: string;
    counterDataSince: string;
  };
  lastMetrikaSyncAt: string | null;
  generatedAt: string;
}

export interface Overview {
  period: AnalyticsPeriod;
  previousPeriod: AnalyticsPeriod;
  traffic: TrafficMetrics;
  siteFunnel: SiteFunnelMetrics;
  crmFunnel: CrmFunnelMetrics;
  orders: OrdersMetrics;
  financials: FinancialMetrics;
  dataQuality: DataQualityMetrics;
  comparison: ComparisonSet | null;
  metadata: OverviewMetadata;
}

export interface TrendPoint {
  date: string;
  visits: number;
  pageviews: number;
  siteLeads: number;
  matchedAccepted: number;
  matchedPaid: number;
  crmLeads: number;
  acceptedOrders: number;
  paidOrders: number;
  realizedRevenue: number;
  netProfit: number;
  realizedOrders: number;
}

export interface Trend {
  period: AnalyticsPeriod;
  points: TrendPoint[];
  quality: GroupQuality;
}

export interface MatchedFunnelRates {
  visits: number;
  siteLeads: number;
  matchedAccepted: number;
  matchedPaid: number;
  visitToLead: number | null;
  visitToAccepted: number | null;
  visitToPaid: number | null;
  leadToAccepted: number | null;
  acceptedToPaid: number | null;
}

export interface SourceRow extends MatchedFunnelRates {
  trafficSource: string;
  trafficSourceName: string;
  sourceEngine: string;
  sourceEngineName: string;
  pageviews: number;
}

export interface UtmRow extends MatchedFunnelRates {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  isNoUtm: boolean;
}

export interface LandingRow extends MatchedFunnelRates {
  normalizedPath: string;
}

export interface DeviceRow extends MatchedFunnelRates {
  deviceCategory: string;
}

export interface Slice<Row> {
  period: AnalyticsPeriod;
  rows: Row[];
  totals: MatchedFunnelRates;
  quality: GroupQuality;
}

export interface ProductRow {
  productCategory: string;
  acceptedOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  contractValue: number;
  paidOrderValue: number;
  cogs: number;
  cogsReliableOrders: number;
  grossContribution: number;
  acceptedAov: number | null;
  paidAov: number | null;
}

export interface SalesChannelRow {
  /** Происхождение заказа, не источник рекламы (этап 17). */
  salesChannel: string;
  crmLeads: number;
  acceptedOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  contractValue: number;
  paidOrderValue: number;
  acceptedAov: number | null;
  paidAov: number | null;
  realizedOrders: number | null;
  realizedRevenue: number | null;
  realizedGoodsRevenue: number | null;
  cogs: number | null;
  /** Валовая прибыль канала: зарплата и расходы бизнеса по каналам не делятся. */
  grossProfit: number | null;
  marginPct: number | null;
  averageCheck: number | null;
}

export interface CrmSlice<Row> {
  period: AnalyticsPeriod;
  rows: Row[];
  quality: GroupQuality;
}

export interface DashboardStatus {
  enabled: boolean;
  presets: PeriodPreset[];
  timezone: string;
  cutovers: OverviewMetadata['cutovers'];
}

/** Что панель шлёт в query: пресет или произвольные даты. */
export type PeriodQuery = { preset: PeriodPreset } | { from: string; to: string };
