import type { AnalyticsPeriod } from '../metrics/analytics-period';
import type { Freshness } from '../metrics/metrics-contract';

/**
 * Контракт слоя «Рост и изменения» (этап 11): реестр изменений и оценка
 * «до / после» без объявления причинности. Зеркало — `frontend/src/types/growth.ts`,
 * описание — `docs/analytics/GROWTH_DATA_CONTRACT.md`.
 *
 * Три обязательных разделения:
 *   - FACT / INTERPRETATION / RECOMMENDATION в каждом результате;
 *   - `causality: 'NOT_ESTABLISHED'` — совпадение по времени не доказательство;
 *   - `evidenceType: 'OBSERVATIONAL_BEFORE_AFTER'` — рандомизации нет
 *     (`abCapability = 'NO_VARIANT_ASSIGNMENT'`).
 */

export const GROWTH_METRIC_VERSION = 'growth-metrics-v1';

export type ChangeStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export const CHANGE_STATUSES: readonly ChangeStatus[] = [
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
];

export type ChangeType =
  | 'SITE'
  | 'CRM'
  | 'MARKETING'
  | 'PRICING'
  | 'OPERATIONS'
  | 'ANALYTICS'
  | 'OTHER';
export const CHANGE_TYPES: readonly ChangeType[] = [
  'SITE',
  'CRM',
  'MARKETING',
  'PRICING',
  'OPERATIONS',
  'ANALYTICS',
  'OTHER',
];

export type ExpectedDirection = 'INCREASE' | 'DECREASE' | 'NEUTRAL';
export const EXPECTED_DIRECTIONS: readonly ExpectedDirection[] = [
  'INCREASE',
  'DECREASE',
  'NEUTRAL',
];

/** Аудитория — только одобренные аналитические измерения (без PII). */
export type AudienceDimension = 'device' | 'source' | 'utm' | 'landing';
export const AUDIENCE_DIMENSIONS: readonly AudienceDimension[] = [
  'device',
  'source',
  'utm',
  'landing',
];

export interface AudienceDefinition {
  dimension: AudienceDimension;
  /** Значения измерения: deviceCategory / trafficSource / utmSource / normalizedPath. */
  values: string[];
}

export interface AnalyticsChangeRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string;
  status: ChangeStatus;
  changeType: ChangeType;
  /** ISO-момент выхода в production (UTC). */
  startedAt: string;
  endedAt: string | null;
  deploymentRef: string | null;
  surface: string;
  audienceDefinition: AudienceDefinition | null;
  primaryMetric: GrowthMetricKey;
  secondaryMetrics: GrowthMetricKey[];
  expectedDirection: ExpectedDirection;
  hypothesis: string | null;
  maturityDays: number | null;
  evaluationDays: number | null;
  primaryLockedAt: string | null;
  /** Календарный день cutover по Москве и признак «полный день» (startedAt ровно в 00:00 MSK). */
  cutoverDay: string;
  cutoverDayIsFull: boolean;
  latestEvaluation: GrowthEvaluationSummary | null;
}

// ---------------------------------------------------------------------------
// Каталог метрик

export type GrowthMetricKey =
  | 'visits'
  | 'siteLeads'
  | 'siteLeadRate'
  | 'formStarts'
  | 'formStartRate'
  | 'leadAttempts'
  | 'formErrors'
  | 'formErrorRate'
  | 'matchedAccepted'
  | 'matchedAcceptedRate'
  | 'matchedPaid'
  | 'crmLeads'
  | 'acceptedOrders'
  | 'leadToAcceptedRate'
  | 'leadToPaidRate'
  | 'paidOrders'
  | 'paidAov'
  | 'contractValue'
  | 'paidOrderValue'
  | 'realizedRevenue'
  | 'netProfit';

export type MetricScope = 'site' | 'matched' | 'crm' | 'pnl';
/** ratio — доля (числитель / знаменатель); count — счётчик за окно; mean — среднее по заказам; sum — сумма денег. */
export type MetricKind = 'ratio' | 'count' | 'mean' | 'sum';
export type MetricMaturityClass = 'immediate' | 'accepted' | 'paid';
/** Куда хорошо двигаться метрике без гипотезы: выше — лучше (заявки) или ниже — лучше (ошибки). */
export type MetricPolarity = 'higher-good' | 'lower-good' | 'neutral';

export interface GrowthMetricDefinition {
  key: GrowthMetricKey;
  label: string;
  scope: MetricScope;
  kind: MetricKind;
  unit: 'visits' | 'orders' | 'events' | 'percent' | 'rub';
  maturity: MetricMaturityClass;
  polarity: MetricPolarity;
  /** Первый день, с которого метрика измеряется в нынешнем определении (null — с начала счётчика). */
  availableFrom: string | null;
  /** Даты смены определения — попадание внутрь сравнения делает окна несопоставимыми. */
  definitionCutovers: string[];
  /** Для каких типов изменений метрика может быть первичной; остальным — только контекст. */
  primaryFor: ChangeType[];
  /** Источник формулы — сервис этапа 08/10, формулы не дублируются. */
  source: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Окна и сопоставимость

export type WindowFlag =
  | 'EXCLUDED_CUTOVER_DAY'
  | 'WEEKDAY_MIX_MISMATCH'
  | 'SHORT_WINDOW'
  | 'AFTER_WINDOW_TRUNCATED_BY_END'
  | 'NO_COMPLETE_DAYS_AFTER';

export interface EvaluationWindows {
  /** Календарный день cutover (Europe/Moscow). */
  cutoverDay: string;
  cutoverDayExcluded: boolean;
  before: AnalyticsPeriod;
  after: AnalyticsPeriod;
  /** Длина каждого окна в днях (равные). */
  days: number;
  /** Последний полный московский день, вошедший в данные. */
  observationCutoff: string;
  /** Состав дней недели: 0 = понедельник … 6 = воскресенье. */
  weekdayMix: { before: number[]; after: number[] };
  flags: WindowFlag[];
}

export type ComparabilityCode =
  | 'PARTIAL_MEASUREMENT_PERIOD'
  | 'INCOMPARABLE_WINDOWS'
  | 'MEASUREMENT_DEFINITION_CHANGED'
  | 'METRIC_UNAVAILABLE_BEFORE'
  | 'METRIC_UNAVAILABLE_AFTER';

export interface MetricComparability {
  comparable: boolean;
  codes: ComparabilityCode[];
  /** С какого дня метрика реально измерена в каждом окне (max(from, availableFrom)). */
  measuredFrom: { before: string; after: string };
  /** Даты смены определения, попавшие в сравнение. */
  cutoversInside: string[];
  note: string | null;
}

// ---------------------------------------------------------------------------
// Значения и статистика

export interface MetricValue {
  /** Числитель (события, заказы, рубли) или само значение для сумм/средних. */
  numerator: number | null;
  /** Знаменатель для долей и средних (визиты, заказы); для счётчиков — дни окна. */
  denominator: number | null;
  /** Итоговое значение: доля в процентах, счётчик, среднее или сумма. */
  value: number | null;
  /** Размер выборки, к которому применяются пороги. */
  sample: number;
  /** Для средних по заказам — значения по заказам (только для бутстрэпа; в API не отдаются). */
  values?: number[];
}

export type StatisticalMethod =
  | 'two_proportion_z_pooled'
  | 'fisher_exact_two_sided'
  | 'poisson_conditional_binomial_exact'
  | 'bootstrap_percentile_mean_diff'
  | 'descriptive_only';

export interface MetricStatistics {
  method: StatisticalMethod;
  /** Абсолютная разница after − before в единицах value (п.п. для долей). */
  absoluteDifference: number | null;
  /** Относительная разница, % от before; null — знаменатель 0 или нет смысла. */
  relativeDifference: number | null;
  /** 95 % доверительный интервал абсолютной разницы; null — метод не даёт интервала. */
  confidenceInterval: { low: number; high: number; level: number } | null;
  /** 95 % интервал относительной разницы (% от before) — для счётчиков через отношение интенсивностей. */
  relativeConfidenceInterval: {
    low: number;
    high: number;
    level: number;
  } | null;
  pValue: number | null;
  /** Минимально обнаружимый эффект при текущих объёмах: абсолютный (в единицах value) и относительный (%). */
  mde: { absolute: number; relative: number | null } | null;
  /** Сколько нужно наблюдений на окно, чтобы поймать целевой относительный эффект. */
  requiredSample: { perWindow: number; targetRelativeEffect: number } | null;
  assumptions: { alpha: number; power: number; twoSided: true };
  /** Почему теста нет / чем ограничен (человеческий текст). */
  note: string | null;
}

export type MaturityStatus = 'MATURE' | 'PARTIALLY_MATURE' | 'IMMATURE';

export interface MaturityInfo {
  status: MaturityStatus;
  class: MetricMaturityClass;
  /** Дни созревания, применённые к этой метрике (0 для immediate). */
  policyDays: number;
  /** Дата, с которой исход окна «после» считается созревшим. */
  maturityUntil: string;
  observationCutoff: string;
  /** Откуда взята политика: empirical (из истории CRM) | configured (задано вручную) | default (истории мало). */
  policySource: 'empirical' | 'configured' | 'default';
  note: string | null;
}

export interface LagDistribution {
  /** Пар дат в выборке. */
  sample: number;
  medianDays: number | null;
  p75Days: number | null;
  p90Days: number | null;
  /** Достаточно ли истории для эмпирической политики (≥ MIN_LAG_SAMPLE). */
  sufficient: boolean;
}

export interface MaturityPolicy {
  leadToAccepted: LagDistribution;
  acceptedToPaid: LagDistribution;
  /** Дней созревания по классам, применённых в оценке. */
  daysByClass: Record<MetricMaturityClass, number>;
  source: Record<MetricMaturityClass, MaturityInfo['policySource']>;
}

// ---------------------------------------------------------------------------
// Вердикт, confounders, результат

export type Verdict =
  | 'POSITIVE_SIGNAL'
  | 'NEGATIVE_SIGNAL'
  | 'NO_CLEAR_CHANGE'
  | 'INSUFFICIENT_DATA'
  | 'IMMATURE'
  | 'INCOMPARABLE';

export type DataQualityFlag =
  | ComparabilityCode
  | WindowFlag
  | 'ANALYTICS_STALE'
  | 'LOW_SAMPLE'
  | 'ZERO_DENOMINATOR'
  | 'UNIQUE_USERS_UNAVAILABLE_FOR_CUSTOM_WINDOW'
  | 'MATCHED_COVERAGE_LOW'
  | 'COGS_INCOMPLETE'
  | 'IMMATURE_OUTCOME'
  | 'METRIC_SCOPE_MISMATCH'
  | 'STATISTICAL_TEST_UNAVAILABLE'
  | 'UNSUPPORTED_SEGMENT'
  | 'OVERLAPPING_CHANGE'
  | 'MATURITY_HISTORY_INSUFFICIENT';

export type ConfounderCode =
  | 'WEEKDAY_MIX_MISMATCH'
  | 'SOURCE_MIX_SHIFT'
  | 'DEVICE_MIX_SHIFT'
  | 'LANDING_MIX_SHIFT'
  | 'MEASUREMENT_DEFINITION_CHANGED'
  | 'OVERLAPPING_CHANGE'
  | 'ANALYTICS_STALE'
  | 'LOW_SAMPLE'
  | 'MATCHED_COVERAGE_LOW'
  | 'COGS_INCOMPLETE'
  | 'IMMATURE_OUTCOME';

export interface Confounder {
  code: ConfounderCode;
  severity: 'INFO' | 'ATTENTION';
  /** Факт с числами; причина не утверждается. */
  fact: string;
  /** Доли до/после для смесей (источник/устройство/страница) — описательно. */
  shares?: { key: string; before: number | null; after: number | null }[];
  /** Идентификаторы пересекающихся изменений. */
  relatedChangeIds?: string[];
}

export interface MetricEvaluation {
  metric: GrowthMetricKey;
  label: string;
  scope: MetricScope;
  kind: MetricKind;
  unit: GrowthMetricDefinition['unit'];
  /** primary — заявлена до оценки; secondary — исследовательская; context — вне области изменения. */
  role: 'primary' | 'secondary' | 'context';
  scopeCompatibility: 'valid' | 'context_only' | 'mismatch';
  before: MetricValue;
  after: MetricValue;
  comparability: MetricComparability;
  maturity: MaturityInfo;
  statistics: MetricStatistics | null;
  verdict: Verdict;
  flags: DataQualityFlag[];
}

export interface SegmentEvaluation {
  dimension: AudienceDimension;
  value: string;
  metric: GrowthMetricKey;
  before: MetricValue;
  after: MetricValue;
  statistics: MetricStatistics | null;
  verdict: Verdict;
  flags: DataQualityFlag[];
  /** Сегмент задан аудиторией изменения (primary) или исследовательский. */
  role: 'audience' | 'exploratory';
}

export interface GrowthEvaluation {
  changeId: string;
  version: number;
  evaluatedAt: string;
  trigger: 'manual' | 'scheduler';
  metricVersion: string;
  evidenceType: 'OBSERVATIONAL_BEFORE_AFTER';
  causality: 'NOT_ESTABLISHED';
  abCapability: 'NO_VARIANT_ASSIGNMENT';
  windows: EvaluationWindows;
  primaryMetric: GrowthMetricKey;
  expectedDirection: ExpectedDirection;
  primary: MetricEvaluation;
  secondary: MetricEvaluation[];
  context: MetricEvaluation[];
  segments: SegmentEvaluation[];
  /** Уникальные посетители за точные окна — только из снимков; иначе null с флагом. */
  periodUsers: { before: number | null; after: number | null };
  maturityPolicy: MaturityPolicy;
  confounders: Confounder[];
  dataQuality: {
    freshness: Freshness;
    flags: DataQualityFlag[];
    lastSyncRunId: string | null;
    clientIdCoverageAccepted: { before: number | null; after: number | null };
  };
  verdict: Verdict;
  maturity: MaturityStatus;
  FACT: string;
  INTERPRETATION: string;
  RECOMMENDATION: string;
  /** Обязательная оговорка для наблюдательных сравнений. */
  disclaimer: string;
}

export interface GrowthEvaluationSummary {
  id: string;
  version: number;
  evaluatedAt: string;
  trigger: 'manual' | 'scheduler';
  verdict: Verdict;
  maturity: MaturityStatus;
  primaryMetric: GrowthMetricKey;
  before: MetricValue;
  after: MetricValue;
  absoluteDifference: number | null;
  relativeDifference: number | null;
  windows: { before: AnalyticsPeriod; after: AnalyticsPeriod; days: number };
  flags: DataQualityFlag[];
}

export interface GrowthStatus {
  enabled: boolean;
  metricVersion: string;
  abCapability: 'NO_VARIANT_ASSIGNMENT';
  evidenceTypes: ['OBSERVATIONAL_BEFORE_AFTER'];
  metrics: GrowthMetricDefinition[];
  audienceDimensions: AudienceDimension[];
  changeTypes: ChangeType[];
  statuses: ChangeStatus[];
  defaults: {
    alpha: number;
    power: number;
    targetRelativeEffect: number;
    minSampleVisits: number;
    minEvents: number;
    evaluationDaysOptions: number[];
    matchedCoverageMinPct: number;
    mixShiftPointsAttention: number;
  };
  maturityPolicy: MaturityPolicy;
  counts: Record<ChangeStatus, number>;
}
