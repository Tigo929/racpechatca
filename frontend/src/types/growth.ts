import type { AnalyticsPeriod, Freshness } from './analytics';

/**
 * Контракт «Рост и изменения» (этап 11) — зеркало
 * `crm-new/src/analytics/growth/growth-contract.ts` и ответов
 * `GET/POST /analytics/dashboard/growth/*`. Панель только показывает:
 * окна, статистика, вердикты и тексты приходят с сервера.
 */

export type ChangeStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type ChangeType = 'SITE' | 'CRM' | 'MARKETING' | 'PRICING' | 'OPERATIONS' | 'ANALYTICS' | 'OTHER';
export type ExpectedDirection = 'INCREASE' | 'DECREASE' | 'NEUTRAL';
export type AudienceDimension = 'device' | 'source' | 'utm' | 'landing';

export interface AudienceDefinition {
  dimension: AudienceDimension;
  values: string[];
}

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
export type MetricKind = 'ratio' | 'count' | 'mean' | 'sum';
export type MetricMaturityClass = 'immediate' | 'accepted' | 'paid';
export type MetricUnit = 'visits' | 'orders' | 'events' | 'percent' | 'rub';

export interface GrowthMetricDefinition {
  key: GrowthMetricKey;
  label: string;
  scope: MetricScope;
  kind: MetricKind;
  unit: MetricUnit;
  maturity: MetricMaturityClass;
  polarity: 'higher-good' | 'lower-good' | 'neutral';
  availableFrom: string | null;
  definitionCutovers: string[];
  primaryFor: ChangeType[];
  source: string;
  description: string;
}

export type Verdict = 'POSITIVE_SIGNAL' | 'NEGATIVE_SIGNAL' | 'NO_CLEAR_CHANGE' | 'INSUFFICIENT_DATA' | 'IMMATURE' | 'INCOMPARABLE';
export type MaturityStatus = 'MATURE' | 'PARTIALLY_MATURE' | 'IMMATURE';

export type WindowFlag = 'EXCLUDED_CUTOVER_DAY' | 'WEEKDAY_MIX_MISMATCH' | 'SHORT_WINDOW' | 'AFTER_WINDOW_TRUNCATED_BY_END' | 'NO_COMPLETE_DAYS_AFTER';
export type ComparabilityCode = 'PARTIAL_MEASUREMENT_PERIOD' | 'INCOMPARABLE_WINDOWS' | 'MEASUREMENT_DEFINITION_CHANGED' | 'METRIC_UNAVAILABLE_BEFORE' | 'METRIC_UNAVAILABLE_AFTER';
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

export interface EvaluationWindows {
  cutoverDay: string;
  cutoverDayExcluded: boolean;
  before: AnalyticsPeriod;
  after: AnalyticsPeriod;
  days: number;
  observationCutoff: string;
  weekdayMix: { before: number[]; after: number[] };
  flags: WindowFlag[];
}

export interface MetricComparability {
  comparable: boolean;
  codes: ComparabilityCode[];
  measuredFrom: { before: string; after: string };
  cutoversInside: string[];
  note: string | null;
}

export interface MetricValue {
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  sample: number;
}

export interface Interval {
  low: number;
  high: number;
  level: number;
}

export interface MetricStatistics {
  method: 'two_proportion_z_pooled' | 'fisher_exact_two_sided' | 'poisson_conditional_binomial_exact' | 'bootstrap_percentile_mean_diff' | 'descriptive_only';
  absoluteDifference: number | null;
  relativeDifference: number | null;
  confidenceInterval: Interval | null;
  relativeConfidenceInterval: Interval | null;
  pValue: number | null;
  mde: { absolute: number; relative: number | null } | null;
  requiredSample: { perWindow: number; targetRelativeEffect: number } | null;
  assumptions: { alpha: number; power: number; twoSided: true };
  note: string | null;
}

export interface MaturityInfo {
  status: MaturityStatus;
  class: MetricMaturityClass;
  policyDays: number;
  maturityUntil: string;
  observationCutoff: string;
  policySource: 'empirical' | 'configured' | 'default';
  note: string | null;
}

export interface LagDistribution {
  sample: number;
  medianDays: number | null;
  p75Days: number | null;
  p90Days: number | null;
  sufficient: boolean;
}

export interface MaturityPolicy {
  leadToAccepted: LagDistribution;
  acceptedToPaid: LagDistribution;
  daysByClass: Record<MetricMaturityClass, number>;
  source: Record<MetricMaturityClass, MaturityInfo['policySource']>;
}

export interface Confounder {
  code: ConfounderCode;
  severity: 'INFO' | 'ATTENTION';
  fact: string;
  shares?: { key: string; before: number | null; after: number | null }[];
  relatedChangeIds?: string[];
}

export interface MetricEvaluation {
  metric: GrowthMetricKey;
  label: string;
  scope: MetricScope;
  kind: MetricKind;
  unit: MetricUnit;
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

export interface AnalyticsChangeRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  description: string;
  status: ChangeStatus;
  changeType: ChangeType;
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
  cutoverDay: string;
  cutoverDayIsFull: boolean;
  latestEvaluation: GrowthEvaluationSummary | null;
}

export interface ChangeInput {
  name: string;
  description?: string;
  status?: ChangeStatus;
  changeType: ChangeType;
  startedAt: string;
  endedAt?: string | null;
  deploymentRef?: string | null;
  surface: string;
  audienceDefinition?: AudienceDefinition | null;
  primaryMetric: GrowthMetricKey;
  secondaryMetrics?: GrowthMetricKey[];
  expectedDirection: ExpectedDirection;
  hypothesis?: string | null;
  maturityDays?: number | null;
  evaluationDays?: number | null;
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
