import type { AnalyticsPeriod } from './analytics-period';
import type { Comparison } from './ratios';

/**
 * Типизированный контракт метрик (этап 08, разделы 37–41). Это то, что
 * дашборд этапа 09 получает от AnalyticsMetricsService и не пересчитывает.
 *
 * Три пространства данных не смешиваются:
 *   - site (Метрика): визиты, lead_submitted, CRM-цели по сопоставленным
 *     заказам — только то, что Метрика видит;
 *   - crm (жизненный цикл заказов): все заказы CRM — сайт, Avito, оператор;
 *   - pnl (отчёт владельца): реализованная выручка, себестоимость, прибыль.
 *
 * Значения — полная точность; доли — 0..100 (проценты) или null, если
 * знаменатель 0. Деньги — рубли, целые в CRM.
 */

export type Completeness = 'complete' | 'partial' | 'unavailable';

/** Коды причин неполноты — стабильные, для показа и фильтрации в UI. */
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
  | 'UNAVAILABLE_NO_SPEND_DATA';

export interface GroupQuality {
  completeness: Completeness;
  notes: QualityNote[];
}

export interface TrafficMetrics {
  visits: number;
  /** Уникальные посетители периода — из MetrikaPeriodSnapshot; нет снимка → null. */
  periodUsers: number | null;
  /** Сумма дневных уникальных — НЕ уникальные периода; названа честно. */
  sumDailyUsers: number;
  /** Заголовочные просмотры = ym:s:pageviews (просмотры внутри визитов). */
  pageviews: number;
  pageviewsSession: number;
  /** ym:pv:pageviews — для аналитики страниц. */
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

export interface CrmFunnelEvents {
  crmLeads: number;
  acceptedOrders: number;
  paidOrders: number;
  /** Заказы с ПЕРВОЙ отменой в периоде — историческое событие, возврат в работу его не стирает. */
  cancelledOrders: number;
  /** Переходов в CANCELLED внутри периода — операционный счётчик, один заказ может дать несколько. */
  cancellationEvents: number;
  /** Из отменённых в периоде — сколько отменены и сейчас (текущее состояние, не история). */
  currentlyCancelledOrders: number;
  realizedOrders: number;
}

export interface CrmFunnelCohorts {
  /** Заявки с leadAt в периоде и что с ними стало когда-либо. */
  leadCohortSize: number;
  leadCohortAccepted: number;
  leadCohortPaid: number;
  /** Принятые с acceptedAt в периоде и что с ними стало когда-либо. */
  acceptedCohortSize: number;
  acceptedCohortPaid: number;
  /** Принятые периода, отменявшиеся хоть раз (wasEverCancelled) — даже если возвращены в работу. */
  acceptedCohortCancelled: number;
  crmLeadToAccepted: number | null;
  crmAcceptedToPaid: number | null;
  crmLeadToPaid: number | null;
  crmCancellationRate: number | null;
}

export interface CrmFunnelMetrics {
  events: CrmFunnelEvents;
  cohorts: CrmFunnelCohorts;
  quality: GroupQuality;
}

export interface OrdersMetrics {
  acceptedOrders: number;
  paidOrders: number;
  /** По первой отмене в периоде (см. CrmFunnelEvents). */
  cancelledOrders: number;
  /** Отменены в периоде и отменены сейчас. */
  currentlyCancelledOrders: number;
  realizedOrders: number;
  /** Статус PAID без clientPaidAt среди заказов, принятых в периоде. */
  paidWithoutDate: number;
  acceptedAov: number | null;
  paidAov: number | null;
  /** Заголовочный средний чек = paidAov. */
  headlineAov: number | null;
  quality: GroupQuality;
}

export interface ContractFinancials {
  orders: number;
  contractValue: number;
  cogs: number;
  grossContribution: number;
  /** Заказы, у которых себестоимость посчитана надёжно (order-cogs.reliable). */
  cogsReliableOrders: number;
}

export interface PaidFinancials {
  orders: number;
  paidOrderValue: number;
  cogs: number;
  grossContribution: number;
}

export interface CategoryPnl {
  orders: number;
  revenue: number;
  profit: number;
}

export interface RealizedFinancials {
  orders: number;
  /** Оборот отчёта (totalRevenue): сумма заказов, признанных выручкой. */
  realizedRevenue: number;
  /** Выручка за товар без доставки (netRevenue). */
  realizedGoodsRevenue: number;
  cogs: number;
  /** grossProfit отчёта = товарная выручка − себестоимость. */
  grossContribution: number;
  salaryAccrued: number;
  operatingExpenses: number;
  deliveryProfit: number;
  /** Чистая прибыль по методике отчёта владельца. */
  netProfit: number;
  marginPct: number | null;
  byCategory: { photo: CategoryPnl; tshirt: CategoryPnl; canvas: CategoryPnl };
}

export interface SpendMetrics {
  status: 'UNAVAILABLE_NO_SPEND_DATA';
  cpl: null;
  cpa: null;
  cpo: null;
  roas: null;
  romi: null;
}

export interface FinancialMetrics {
  currency: 'RUB';
  contract: ContractFinancials;
  paid: PaidFinancials;
  realized: RealizedFinancials | null;
  spend: SpendMetrics;
  quality: GroupQuality;
}

export type FreshnessStatus = 'FRESH' | 'STALE' | 'NO_DATA';

export interface Freshness {
  lastMetrikaSyncAt: Date | null;
  metrikaDataAgeSeconds: number | null;
  status: FreshnessStatus;
  thresholdSeconds: number;
}

export interface DataQualityMetrics {
  freshness: Freshness;
  clientIdCoverageAccepted: number | null;
  clientIdCoveragePaid: number | null;
  /** Принятые после включения CRM→Метрика и с ClientID — честная база сопоставления. */
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

export interface OverviewMetadata {
  timezone: 'Europe/Moscow';
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
  lastMetrikaSyncAt: Date | null;
  generatedAt: Date;
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

// ---------------------------------------------------------------------------
// Срезы

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
  /** Пустая метка отдаётся как NO_UTM — это категория, а не пропуск. */
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
  /** PHOTO | TSHIRT | CANVAS (EnumProductCategory) — строка, чтобы новая категория не ломала контракт. */
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
  /** AVITO | OZON | WB | LOCAL (EnumSourceOrder) — канал продаж, не маркетинговый источник. */
  salesChannel: string;
  crmLeads: number;
  acceptedOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  contractValue: number;
  paidOrderValue: number;
  acceptedAov: number | null;
  paidAov: number | null;
}

export interface CrmSlice<Row> {
  period: AnalyticsPeriod;
  rows: Row[];
  quality: GroupQuality;
}
