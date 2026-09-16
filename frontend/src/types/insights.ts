import type { AnalyticsPeriod } from './analytics';
import type { Confounder, MetricEvaluation, Verdict } from './growth';

/** Зеркало crm-new/src/analytics/insights/insights-contract.ts (этап 12). */

export type InsightCategory =
  | 'TRAFFIC_CHANGE'
  | 'SITE_CONVERSION_CHANGE'
  | 'FUNNEL_DROPOFF'
  | 'FORM_ERROR_CHANGE'
  | 'DEVICE_GAP'
  | 'SOURCE_MIX_SHIFT'
  | 'SOURCE_PERFORMANCE_CHANGE'
  | 'LANDING_CHANGE'
  | 'PRODUCT_CHANGE'
  | 'CRM_CONVERSION_CHANGE'
  | 'REVENUE_CHANGE'
  | 'PROFIT_CHANGE'
  | 'CHANGE_EVALUATION'
  | 'DATA_QUALITY';

export type InsightSeverity = 'INFO' | 'ATTENTION' | 'CRITICAL';
export type InsightStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPERSEDED';
export type InsightScope = 'site' | 'crm' | 'money' | 'data' | 'change';
export type InsightSource = 'STAGE12_DETECTOR' | 'STAGE10_RULE' | 'STAGE11_EVALUATION';

export type SuppressionReason =
  | 'LOW_SAMPLE'
  | 'INSUFFICIENT_DATA'
  | 'IMMATURE'
  | 'INCOMPARABLE_PERIODS'
  | 'PARTIAL_BEHAVIOR_PERIOD'
  | 'METRIC_NOT_AVAILABLE'
  | 'MEASUREMENT_DEFINITION_CHANGED'
  | 'WEEKDAY_MIX_MISMATCH'
  | 'MATCHED_COVERAGE_LOW'
  | 'COGS_INCOMPLETE'
  | 'STALE_DATA'
  | 'DUPLICATE'
  | 'COOLDOWN'
  | 'NO_MATERIAL_CHANGE';

export interface InsightFact {
  text: string;
  metric: string | null;
  unit: 'percent' | 'visits' | 'events' | 'orders' | 'rub' | 'seconds' | 'ratio' | null;
  current: number | null;
  baseline: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null;
  sample: { current: number | null; baseline: number | null; minimum: number | null };
  period: AnalyticsPeriod;
  baselinePeriod: AnalyticsPeriod | null;
}

export interface InsightHypothesis {
  status: 'SUPPORTED_BY_CONCURRENT_FACTS' | 'NO_SUPPORTED_HYPOTHESIS';
  text: string | null;
  supportingFacts: string[];
}

export interface InsightRecommendation {
  text: string;
  kind:
    | 'WAIT_FOR_SAMPLE'
    | 'WAIT_FOR_MATURITY'
    | 'CHECK_TECHNICAL'
    | 'CHECK_MANUALLY'
    | 'COMPARE_SEGMENT'
    | 'REGISTER_CHANGE'
    | 'USE_STAGE11_RECOMMENDATION'
    | 'IMPROVE_DATA_QUALITY'
    | 'OBSERVE';
}

export interface InsightEvidence {
  statisticalStrength: 'NONE' | 'WEAK' | 'SIGNAL';
  businessMateriality: 'NONE' | 'LOW' | 'MATERIAL';
  metricEvaluation: MetricEvaluation | null;
  verdict: Verdict | null;
  context: { metric: string; before: number | null; after: number | null; unit: string }[];
  confounders: Confounder[];
  refs: { kind: 'stage10_issue' | 'stage11_evaluation' | 'analytics_change' | 'sync_run'; id: string; label: string }[];
  rule: { detectorId: string; thresholds: Record<string, number> };
}

export interface InsightQuality {
  freshness: 'FRESH' | 'STALE' | 'NO_DATA';
  flags: string[];
  notes: string[];
}

export interface InsightLink {
  tab: 'overview' | 'behavior' | 'growth' | 'sources' | 'products' | 'pages' | 'quality';
  id?: string;
}

export interface InsightRecord {
  id: string;
  fingerprint: string;
  episode: number;
  category: InsightCategory;
  severity: InsightSeverity;
  status: InsightStatus;
  scope: InsightScope;
  source: InsightSource;
  detectorId: string;
  metricKey: string | null;
  entityKey: string | null;
  periodStart: string;
  periodEnd: string;
  baselineStart: string | null;
  baselineEnd: string | null;
  title: string;
  fact: InsightFact;
  hypothesis: InsightHypothesis;
  recommendation: InsightRecommendation;
  evidence: InsightEvidence;
  limitations: string[];
  quality: InsightQuality;
  causality: 'NOT_ESTABLISHED';
  link: InsightLink | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  resolvedReason: string | null;
  acknowledgedAt: string | null;
  latestVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsightPayload {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  fact: InsightFact;
  hypothesis: InsightHypothesis;
  recommendation: InsightRecommendation;
  limitations: string[];
  causality: 'NOT_ESTABLISHED';
}

export interface InsightVersionRecord {
  version: number;
  generatedAt: string;
  syncRunId: string | null;
  runId: string | null;
  payload: InsightPayload;
}

export interface SuppressedResult {
  detectorId: string;
  category: InsightCategory;
  metricKey: string | null;
  entityKey: string | null;
  reason: SuppressionReason;
  detail: string;
  sample: number | null;
}

export interface InsightRunRecord {
  id: string;
  kind: 'daily' | 'hourly' | 'manual';
  status: 'SUCCESS' | 'FAILED' | 'LOCKED' | 'SKIPPED';
  startedAt: string;
  finishedAt: string | null;
  observationCutoff: string | null;
  syncRunId: string | null;
  detectors: number;
  detected: number;
  created: number;
  versioned: number;
  unchanged: number;
  resolved: number;
  reopened: number;
  suppressed: SuppressedResult[];
  errors: string[];
  durationMs: number | null;
  queryCount: number | null;
}

export interface InsightsFeed {
  items: InsightRecord[];
  total: number;
  suppressedSummary: Record<SuppressionReason, number>;
  lastRun: InsightRunRecord | null;
  generatedAt: string;
}

export interface InsightsStatus {
  enabled: boolean;
  engineVersion: string;
  causality: 'NOT_ESTABLISHED';
  categories: InsightCategory[];
  severities: InsightSeverity[];
  statuses: InsightStatus[];
  detectors: { id: string; category: InsightCategory; refresh: 'daily' | 'hourly'; source: InsightSource }[];
  thresholds: Record<string, number>;
  counts: Record<InsightStatus, number>;
  lastRun: InsightRunRecord | null;
  boundaries: {
    metrikaHistorySince: string;
    leadSemanticsCutover: string;
    incident: { from: string; to: string; label: string } | null;
  };
}

export interface InsightsQuality {
  lastRun: InsightRunRecord | null;
  recentRuns: InsightRunRecord[];
  suppressed: SuppressedResult[];
  suppressedSummary: Record<SuppressionReason, number>;
  activeByCategory: Record<InsightCategory, number>;
}

export interface FeedFilter {
  status?: 'active' | 'all' | InsightStatus;
  severity?: InsightSeverity;
  category?: InsightCategory;
  limit?: number;
}
