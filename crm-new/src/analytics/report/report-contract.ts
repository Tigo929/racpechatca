import type {
  CrmSlice,
  DataQualityMetrics,
  Overview,
  ProductRow,
  SalesChannelRow,
  Slice,
  SourceRow,
  TrendPoint,
  UtmRow,
  LandingRow,
} from '../metrics/metrics-contract';
import type { AnalyticsPeriod } from '../metrics/analytics-period';

/**
 * Этап 15 — отчёт для внешнего ИИ.
 *
 * Контракт делится надвое: `ReportInput` — то, что собрано из уже принятых
 * сервисов аналитики (этапы 07–12) без единой своей формулы, и `ReportModel` —
 * то, что из этого собрано для чтения: сравнения, сигналы, аномалии, входные
 * ряды для прогноза. Ни одна цифра в модели не считается заново там, где её
 * уже считает `AnalyticsMetricsService` или `ReportsService`: отчёт обязан
 * совпадать с дашбордом до рубля, иначе он бесполезен.
 */

/** Сырые данные одного периода — как их отдаёт сервис метрик. */
export interface PeriodSnapshot {
  period: AnalyticsPeriod;
  overview: Overview;
  dataQuality: DataQualityMetrics;
}

/** Атрибуция заказов: считается SQL-ом по колонкам заказа, без эвристик. */
export interface AttributionInput {
  totalOrders: number;
  withClientId: number;
  withYclid: number;
  withUtm: number;
  withConversionPage: number;
  withFirstTouch: number;
  bySource: { source: string; orders: number; withAnyAttribution: number }[];
}

/** Состояние очереди CRM → Метрика. */
export interface SyncInput {
  delivered: number;
  skipped: number;
  pending: number;
  processing: number;
  failed: number;
  skipReasons: { reason: string; rows: number }[];
  deliveredWithUploadingId: number;
  validationPassed: number;
  duplicateDedupeKeys: number;
  duplicatePurchasesPerOrder: number;
  lastDeliveredAt: Date | null;
}

/** Оценка изменения этапа 11 — как есть, без перетрактовки. */
export interface GrowthInput {
  changes: {
    name: string;
    status: string;
    startedAt: Date | null;
    latest: {
      version: number;
      evaluatedAt: Date;
      trigger: string;
      verdict: string;
      maturity: string;
      primaryMetric: string;
      causality: string;
      fact: string;
    } | null;
  }[];
}

/** Карточка этапа 12 — заголовок и статус, без внутренних идентификаторов. */
export interface InsightInput {
  detectorId: string;
  status: string;
  version: number;
  title: string;
  fact: string | null;
}

/** Сверки: отчёт обязан показывать, что его числа совпадают с принятыми. */
export interface ReconciliationInput {
  trendSumRealizedRevenue: number | null;
  overviewRealizedRevenue: number | null;
  monthlyPnl: {
    month: string;
    serviceRevenue: number | null;
    reportRevenue: number;
    serviceNetProfit: number | null;
    reportNetProfit: number;
    serviceCogs: number | null;
    reportCogs: number;
  } | null;
}

export interface ReportInput {
  generatedAt: Date;
  build: string | null;
  current: PeriodSnapshot;
  previous: PeriodSnapshot;
  average30: PeriodSnapshot;
  month: PeriodSnapshot | null;
  previousMonth: PeriodSnapshot | null;
  /** Дневной ряд за длинное окно (для трендов и входа прогноза). */
  daily: TrendPoint[];
  sources: Slice<SourceRow>;
  utm: Slice<UtmRow>;
  landings: Slice<LandingRow>;
  products: CrmSlice<ProductRow>;
  salesChannels: CrmSlice<SalesChannelRow>;
  attribution: AttributionInput;
  sync: SyncInput;
  growth: GrowthInput;
  insights: InsightInput[];
  reconciliation: ReconciliationInput;
}

// ── модель отчёта ───────────────────────────────────────────────────────────

export interface MetricRow {
  key: string;
  label: string;
  unit: 'count' | 'rub' | 'percent';
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
}

export type SignalKind = 'positive' | 'negative' | 'stable' | 'insufficient';

export interface Signal {
  kind: SignalKind;
  metric: string;
  statement: string;
}

export interface FunnelStep {
  name: string;
  count: number | null;
  conversionFromPrevious: number | null;
  dropOff: number | null;
  previousCount: number | null;
}

export interface Anomaly {
  metric: string;
  current: number | null;
  baseline: number | null;
  delta: number | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  evidence: string;
}

export interface WeeklyPoint {
  week: string;
  visits: number;
  leads: number;
  accepted: number;
  paid: number;
  revenue: number;
  cogs: number | null;
  profit: number;
  marginPct: number | null;
}

export interface ForecastBlock {
  available: boolean;
  method: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  limitations: string[];
  horizons: { horizon: string; metric: string; value: number | null }[];
  reason?: string;
}

export interface QualityItem {
  metric: string;
  value: string;
  threshold: string;
  impact: string;
}

/** Строка раздела ORDER ORIGIN — происхождение заказа, не источник рекламы. */
export interface OriginRow {
  origin: string;
  label: string;
  crmLeads: number;
  acceptedOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  revenue: number | null;
  cogs: number | null;
  profit: number | null;
  marginPct: number | null;
  averageCheck: number | null;
}

/** Полнота классификации происхождения — обязательные поля качества этапа 17. */
export interface OriginCoverage {
  /** Заказы, созданные в периоде (та же база, что у блока атрибуции). */
  totalOrders: number;
  websiteOrders: number;
  avitoOrders: number;
  unknownOriginOrders: number;
  orderOriginCoveragePct: number | null;
}

/**
 * Сверка суммы каналов с итогом периода. Ненулевая разница допустима только
 * как округление: себестоимость бумаги округляется вверх до рубля в каждой
 * корзине (правило этапа 08), поэтому корзин больше — рублей больше.
 */
export interface OriginReconciliation {
  metric: string;
  originsSum: number | null;
  periodTotal: number | null;
  difference: number | null;
  explanation: string | null;
}

export interface OriginBlock {
  rows: OriginRow[];
  all: OriginRow | null;
  coverage: OriginCoverage;
  reconciliation: OriginReconciliation[];
}

export interface ReportModel {
  input: ReportInput;
  orderOrigin: OriginBlock;
  summary: MetricRow[];
  signals: Signal[];
  siteFunnel: FunnelStep[];
  crmFunnel: FunnelStep[];
  biggestDropOff: FunnelStep | null;
  comparison: MetricRow[];
  weekly: WeeklyPoint[];
  anomalies: Anomaly[];
  forecast: ForecastBlock;
  quality: QualityItem[];
  strengths: string[];
  weaknesses: string[];
  constraints: string[];
  openQuestions: string[];
}
