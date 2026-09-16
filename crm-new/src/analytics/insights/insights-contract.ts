import type { AnalyticsPeriod } from '../metrics/analytics-period';
import type { Freshness } from '../metrics/metrics-contract';
import type {
  Confounder,
  DataQualityFlag,
  MetricEvaluation,
  Verdict,
} from '../growth/growth-contract';

/**
 * Контракт автоматических сигналов (этап 12, INSIGHTS_DATA_CONTRACT.md).
 *
 * Каждый сигнал — FACT → HYPOTHESIS → RECOMMENDATION: факт воспроизводим из
 * данных, гипотеза явно помечена как гипотеза (или её нет), рекомендация —
 * следующее безопасное действие для проверки. Причинность всегда
 * NOT_ESTABLISHED: движок обнаруживает совпадения по времени, а не причины.
 */

export const INSIGHT_ENGINE_VERSION = 'insights-v1';

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
export const INSIGHT_CATEGORIES: readonly InsightCategory[] = [
  'TRAFFIC_CHANGE',
  'SITE_CONVERSION_CHANGE',
  'FUNNEL_DROPOFF',
  'FORM_ERROR_CHANGE',
  'DEVICE_GAP',
  'SOURCE_MIX_SHIFT',
  'SOURCE_PERFORMANCE_CHANGE',
  'LANDING_CHANGE',
  'PRODUCT_CHANGE',
  'CRM_CONVERSION_CHANGE',
  'REVENUE_CHANGE',
  'PROFIT_CHANGE',
  'CHANGE_EVALUATION',
  'DATA_QUALITY',
];

export type InsightSeverity = 'INFO' | 'ATTENTION' | 'CRITICAL';
export const INSIGHT_SEVERITIES: readonly InsightSeverity[] = [
  'INFO',
  'ATTENTION',
  'CRITICAL',
];

export type InsightStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPERSEDED';
export const INSIGHT_STATUSES: readonly InsightStatus[] = [
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'SUPERSEDED',
];

/** Область сигнала: сайт, CRM, деньги, данные, зарегистрированное изменение. */
export type InsightScope = 'site' | 'crm' | 'money' | 'data' | 'change';

/** Откуда сигнал: собственный детектор этапа 12, правило этапа 10 или оценка этапа 11. */
export type InsightSource =
  | 'STAGE12_DETECTOR'
  | 'STAGE10_RULE'
  | 'STAGE11_EVALUATION';

/** Почему детектор промолчал — диагностика для Reviewer/quality, не для ленты менеджера. */
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

export type LimitationCode =
  | DataQualityFlag
  | 'PARTIAL_BEHAVIOR_PERIOD'
  | 'NOT_MEASURED_STEPS'
  | 'CRM_INCLUDES_OFFLINE'
  | 'INCIDENT_BOUNDARY'
  | 'STAGE10_RULE_MIRROR'
  | 'STAGE11_VERDICT_PRESERVED'
  | 'NO_SUPPORTED_HYPOTHESIS'
  | 'DESCRIPTIVE_ONLY';

/** Факт: только числа и их подписи. */
export interface InsightFact {
  text: string;
  /** Ключ метрики каталога этапа 11 или собственный ключ детектора (freshness, sourceShare…). */
  metric: string | null;
  unit:
    | 'percent'
    | 'visits'
    | 'events'
    | 'orders'
    | 'rub'
    | 'seconds'
    | 'ratio'
    | null;
  current: number | null;
  baseline: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null;
  /** Знаменатель / объём наблюдений, на которых стоит факт. */
  sample: {
    current: number | null;
    baseline: number | null;
    minimum: number | null;
  };
  period: AnalyticsPeriod;
  baselinePeriod: AnalyticsPeriod | null;
}

export interface InsightHypothesis {
  status: 'SUPPORTED_BY_CONCURRENT_FACTS' | 'NO_SUPPORTED_HYPOTHESIS';
  /** Всегда в сослагательной форме; пусто при NO_SUPPORTED_HYPOTHESIS. */
  text: string | null;
  /** Сопутствующие проверяемые факты, на которых стоит гипотеза (числа, не мнения). */
  supportingFacts: string[];
}

export interface InsightRecommendation {
  text: string;
  /** Тип следующего действия — аналитическое или операционная проверка, никогда не бизнес-решение. */
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

/** Статистическая сила и деловая существенность — отдельно, без единого «скора». */
export interface InsightEvidence {
  statisticalStrength: 'NONE' | 'WEAK' | 'SIGNAL';
  businessMateriality: 'NONE' | 'LOW' | 'MATERIAL';
  /** Оценка метрики этапа 11 на тех же окнах (статистика, MDE, сопоставимость, созревание). */
  metricEvaluation: MetricEvaluation | null;
  verdict: Verdict | null;
  /** Сопутствующий контекст: другие метрики и confounders этапа 11 на тех же окнах. */
  context: {
    metric: string;
    before: number | null;
    after: number | null;
    unit: string;
  }[];
  confounders: Confounder[];
  /** Ссылки на источники: правило этапа 10, оценка этапа 11, изменения реестра. */
  refs: {
    kind:
      | 'stage10_issue'
      | 'stage11_evaluation'
      | 'analytics_change'
      | 'sync_run';
    id: string;
    label: string;
  }[];
  /** Порог/правило, по которому детектор решил, что сигнал есть. */
  rule: { detectorId: string; thresholds: Record<string, number> };
}

export interface InsightQuality {
  freshness: Freshness['status'];
  flags: DataQualityFlag[];
  notes: string[];
}

/** Полезная нагрузка версии — неизменяемая, без временных меток (для канонического сравнения). */
export interface InsightPayload {
  category: InsightCategory;
  severity: InsightSeverity;
  scope: InsightScope;
  source: InsightSource;
  detectorId: string;
  metricKey: string | null;
  entityKey: string | null;
  title: string;
  fact: InsightFact;
  hypothesis: InsightHypothesis;
  recommendation: InsightRecommendation;
  evidence: InsightEvidence;
  limitations: LimitationCode[];
  quality: InsightQuality;
  causality: 'NOT_ESTABLISHED';
  /** Куда перейти в панели за деталями (вкладка аналитики и, если есть, идентификатор). */
  link: {
    tab:
      | 'overview'
      | 'behavior'
      | 'growth'
      | 'sources'
      | 'products'
      | 'pages'
      | 'quality';
    id?: string;
  } | null;
  engineVersion: string;
}

/** Результат детектора до записи: либо сигнал, либо причина молчания. */
export interface DetectedInsight {
  fingerprint: string;
  payload: InsightPayload;
}

export interface SuppressedResult {
  detectorId: string;
  category: InsightCategory;
  metricKey: string | null;
  entityKey: string | null;
  reason: SuppressionReason;
  /** Число словами: что именно не хватило (выборка, дата созревания, порог). */
  detail: string;
  sample: number | null;
}

export interface DetectorRunResult {
  detected: DetectedInsight[];
  suppressed: SuppressedResult[];
}

// ---------------------------------------------------------------------------
// Хранимые сущности и API

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
  limitations: LimitationCode[];
  quality: InsightQuality;
  causality: 'NOT_ESTABLISHED';
  link: InsightPayload['link'];
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  resolvedReason: string | null;
  acknowledgedAt: string | null;
  latestVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsightVersionRecord {
  version: number;
  generatedAt: string;
  syncRunId: string | null;
  runId: string | null;
  payload: InsightPayload;
}

export type InsightRunKind = 'daily' | 'hourly' | 'manual';
export type InsightRunStatus = 'SUCCESS' | 'FAILED' | 'LOCKED' | 'SKIPPED';

export interface InsightRunRecord {
  id: string;
  kind: InsightRunKind;
  status: InsightRunStatus;
  startedAt: string;
  finishedAt: string | null;
  /** Последний полный московский день, вошедший в окна. */
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
  /** Сколько правил промолчало в последнем запуске — по причинам (без карточек). */
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
  detectors: {
    id: string;
    category: InsightCategory;
    refresh: 'daily' | 'hourly';
    source: InsightSource;
  }[];
  thresholds: Record<string, number>;
  counts: Record<InsightStatus, number>;
  lastRun: InsightRunRecord | null;
  /** Данные Метрики начинаются с этого дня; смена семантики заявок; граница инцидента. */
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
