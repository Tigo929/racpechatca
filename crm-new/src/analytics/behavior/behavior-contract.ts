import type { AnalyticsPeriod } from '../metrics/analytics-period';
import type { Freshness } from '../metrics/metrics-contract';
import type { Comparison } from '../metrics/ratios';

/**
 * Контракт поведенческого слоя (этап 10, разделы 4–13, 17). То, что отдаёт
 * `/analytics/dashboard/behavior/*`, и то, что показывает раздел «Поведение».
 *
 * Три единицы измерения никогда не смешиваются и подписаны явно:
 *   - events — достижения цели (`reaches`); у форм без дедупликации завышены;
 *   - visits — целевые визиты (`goalVisits`): визит, в котором шаг достигнут
 *     хотя бы раз. Канонический счётчик шагов и конверсий;
 *   - users — посетители, достигшие шага за весь период (снимок периода);
 *     без снимка — null, а не сумма дневных.
 *
 * Причинность не утверждается: карточки «Требует внимания» разделяют
 * FACT / HYPOTHESIS / RECOMMENDATION, гипотеза — это гипотеза.
 */

export type BehaviorQualityNote =
  | 'BEHAVIOR_NOT_SYNCED'
  | 'PERIOD_BEFORE_BEHAVIOR_GOALS'
  | 'PERIOD_BEFORE_DIRECTION_GOALS'
  | 'PARTIAL_BEHAVIOR_PERIOD'
  | 'NO_PERIOD_GOAL_SNAPSHOT'
  | 'LOW_SAMPLE'
  | 'METRIKA_STALE'
  | 'METRIKA_NO_DATA'
  | 'COMPARISON_UNAVAILABLE';

export interface BehaviorQuality {
  completeness: 'complete' | 'partial' | 'unavailable';
  notes: BehaviorQualityNote[];
}

export type SampleStatus = 'OK' | 'LOW_SAMPLE' | 'INSUFFICIENT_DATA';

export type StepAvailability =
  | 'measured'
  | 'not_measured'
  | 'insufficient_data';

/** На чём построен шаг: целевые визиты цели или визиты с параметром визита. */
export type StepBasis = 'visits' | 'goal' | 'param';

/**
 * Сопоставимость перехода с предыдущего измеренного шага (FIX_01 этапа 10).
 * `comparable` — оба шага измерены внутри периода с одной даты, конверсию шага
 * можно обсуждать; `partial` — шаги измерены с разных дат (например, параметр
 * визита хранится с начала счётчика, а цель направления создана позже):
 * конверсия и отвал структурно смещены, правило 11.1 по такому переходу молчит.
 */
export interface StepTransition {
  status: 'comparable' | 'partial';
  /** С какого дня начала периода переход сопоставим (поздняя из дат доступности двух шагов); null — с любого. */
  comparableFrom: string | null;
}

export interface FunnelStep {
  key: string;
  label: string;
  /** Идентификатор события сайта или ключ параметра; у «визитов» — null. */
  event: string | null;
  basis: StepBasis;
  availability: StepAvailability;
  /** С какого дня шаг измеряется; null — измеряется с начала счётчика или не измеряется вовсе. */
  availableFrom: string | null;
  /** Первый день периода, с которого шаг реально измерен: max(period.from, availableFrom); null — шаг не измерен. */
  measuredFrom: string | null;
  /** Переход с предыдущего измеренного шага; null — предыдущего измеренного шага нет или этот шаг не измерен. */
  transition: StepTransition | null;
  events: number | null;
  visits: number | null;
  users: number | null;
  /** visits(шаг) / visits(предыдущий шаг) × 100. */
  stepConversion: number | null;
  /** visits(шаг) / visits(первый шаг) × 100. */
  cumulativeConversion: number | null;
  /** visits(предыдущий) − visits(шаг). */
  dropoff: number | null;
  dropoffRate: number | null;
  /** Почему шаг не измеряется / чем ограничен (ссылка на BEHAVIOR_EVENT_CONTRACT.md). */
  note: string | null;
}

export type FunnelKey = 'global' | 'photo' | 'tshirt' | 'canvas' | 'contact';

export interface FunnelComparisonStep {
  key: string;
  visits: Comparison;
  stepConversion: Comparison;
}

export interface Funnel {
  key: FunnelKey;
  title: string;
  description: string;
  steps: FunnelStep[];
  sample: { visits: number; status: SampleStatus };
  /** Сравнение с предыдущим периодом по визитам шагов; null — сравнивать нельзя (см. quality). */
  comparison: FunnelComparisonStep[] | null;
  quality: BehaviorQuality;
}

// ---------------------------------------------------------------------------
// Ошибки форм

export interface ErrorByKey {
  key: string;
  label: string;
  visits: number;
  users: number;
  /** Число параметров (≈ число событий ошибки с этим полем). */
  events: number;
  shareOfErrors: number | null;
}

export interface ErrorsByDevice {
  deviceCategory: string;
  formErrorVisits: number;
  formErrorEvents: number;
  formStartedVisits: number;
  errorRate: number | null;
}

export interface ErrorsByLanding {
  normalizedPath: string;
  visits: number;
  formErrorVisits: number;
  formStartedVisits: number;
  errorRate: number | null;
  sample: SampleStatus;
}

export interface FormErrors {
  period: AnalyticsPeriod;
  totals: {
    formErrorEvents: number;
    formErrorVisits: number;
    formStartedVisits: number;
    attemptEvents: number;
    attemptVisits: number;
    /** formErrorVisits / formStartedVisits × 100. */
    errorRate: number | null;
    /** formErrorEvents / (attemptEvents + formErrorEvents) × 100. */
    errorsPerAttempt: number | null;
    serverErrorEvents: number;
    serverErrorVisits: number;
  };
  byField: ErrorByKey[];
  byDevice: ErrorsByDevice[];
  byLanding: ErrorsByLanding[];
  comparison: {
    formErrorVisits: Comparison;
    errorRate: Comparison;
  } | null;
  quality: BehaviorQuality;
}

// ---------------------------------------------------------------------------
// Страницы

export interface PageBehavior {
  normalizedPath: string;
  visits: number;
  /** Сумма дневных посетителей — не уникальные периода. */
  sumDailyUsers: number;
  formStartedVisits: number;
  attemptVisits: number;
  leadVisits: number;
  formErrorVisits: number;
  /** Сопоставленные принятые заказы (цель CRM «заказ создан»), если есть. */
  matchedAccepted: number;
  formStartRate: number | null;
  leadConversion: number | null;
  errorRate: number | null;
  sample: SampleStatus;
  /** Отклонение конверсии в заявку от средней по сайту, п.п.; null при малой выборке. */
  leadConversionVsSite: number | null;
}

export interface PagesBehavior {
  period: AnalyticsPeriod;
  siteLeadConversion: number | null;
  siteFormStartRate: number | null;
  minSampleVisits: number;
  rows: PageBehavior[];
  quality: BehaviorQuality;
}

// ---------------------------------------------------------------------------
// Устройства

export interface DeviceBehavior {
  deviceCategory: string;
  visits: number;
  sumDailyUsers: number;
  formStartedVisits: number;
  attemptVisits: number;
  leadVisits: number;
  formErrorVisits: number;
  matchedAccepted: number;
  formStartRate: number | null;
  attemptRate: number | null;
  leadConversion: number | null;
  errorRate: number | null;
  /** Вовлечённость из аддитивных величин периода. */
  engagement: {
    bounceRate: number | null;
    pageDepth: number | null;
    avgDurationSeconds: number | null;
  } | null;
  sample: SampleStatus;
}

export interface DeviceGap {
  metric: 'leadConversion' | 'formStartRate';
  mobile: number | null;
  desktop: number | null;
  /** mobile / desktop; null если нельзя сравнить. */
  ratio: number | null;
  status: 'COMPARABLE' | 'INSUFFICIENT_DATA';
}

export interface DevicesBehavior {
  period: AnalyticsPeriod;
  rows: DeviceBehavior[];
  gap: DeviceGap;
  minSampleVisits: number;
  quality: BehaviorQuality;
}

// ---------------------------------------------------------------------------
// Пути (V1 — агрегаты, не последовательности)

export interface PathPage {
  normalizedPath: string;
  visits: number | null;
  pageviews: number | null;
  users: number;
  share: number | null;
}

export interface PathsBehavior {
  period: AnalyticsPeriod;
  /** Страницы входа визитов с заявкой. */
  entryLead: PathPage[];
  /** Страницы, просмотренные в визитах с заявкой (по просмотрам). */
  viewedLead: PathPage[];
  /** Страницы выхода визитов без заявки. */
  exitNoLead: PathPage[];
  /** Страницы выхода всех визитов. */
  exitAll: PathPage[];
  totals: {
    leadVisits: number;
    leadPageviews: number;
    noLeadVisits: number;
    allVisits: number;
  };
  /** Порядок страниц внутри визита Reports API не отдаёт — это фиксируется, не домысливается. */
  dataGap: string;
  quality: BehaviorQuality;
}

// ---------------------------------------------------------------------------
// «Требует внимания»

export type IssueSeverity = 'INFO' | 'ATTENTION' | 'CRITICAL';

export type IssueRule =
  | 'FUNNEL_DROPOFF'
  | 'DEVICE_GAP'
  | 'FORM_ERROR_SPIKE'
  | 'LANDING_UNDERPERFORMANCE'
  | 'LEAD_RATE_ANOMALY';

export interface IssueEvidence {
  metric: string;
  current: number | null;
  baseline: number | null;
  unit: 'visits' | 'events' | 'percent' | 'ratio';
  sample: number;
  minSample: number;
}

export interface BehaviorIssue {
  id: string;
  rule: IssueRule;
  severity: IssueSeverity;
  title: string;
  /** Наблюдаемое измерение — только числа и их подписи. */
  fact: string;
  /** Возможное объяснение, всегда в сослагательной форме. */
  hypothesis: string;
  /** Что проверить, чтобы подтвердить или отбросить гипотезу. */
  recommendation: string;
  evidence: IssueEvidence[];
  /** Явное напоминание, что причина не установлена. */
  causality: 'NOT_ESTABLISHED';
  /** Чего касается: воронка/устройство/страница/поле. */
  scope: { kind: 'funnel' | 'device' | 'page' | 'form' | 'site'; key: string };
}

/**
 * Почему правило промолчало. LOW_SAMPLE — данных меньше порога;
 * PARTIAL_BEHAVIOR_PERIOD — шаги перехода измерены с разных дат внутри периода
 * (окна несопоставимы, FIX_01); COMPARISON_UNAVAILABLE — нет сопоставимого
 * предыдущего периода; NO_LEADS — по сайту нет заявок, сравнивать не с чем.
 */
export type SkipCode =
  | 'LOW_SAMPLE'
  | 'PARTIAL_BEHAVIOR_PERIOD'
  | 'COMPARISON_UNAVAILABLE'
  | 'NO_LEADS';

export interface SkippedRule {
  rule: IssueRule;
  code: SkipCode;
  reason: string;
}

export interface BehaviorIssues {
  period: AnalyticsPeriod;
  previousPeriod: AnalyticsPeriod;
  issues: BehaviorIssue[];
  /** Правила, которые не сработали (не тишина, а причина): код для программ, текст для людей. */
  skipped: SkippedRule[];
  thresholds: Record<string, number>;
  quality: BehaviorQuality;
}

// ---------------------------------------------------------------------------
// Сводка

export interface BehaviorSummary {
  period: AnalyticsPeriod;
  previousPeriod: AnalyticsPeriod;
  global: Funnel;
  headline: {
    visits: number;
    formStartedVisits: number;
    attemptVisits: number;
    leadVisits: number;
    formErrorVisits: number;
    formStartRate: number | null;
    startToLead: number | null;
    leadConversion: number | null;
    errorRate: number | null;
  };
  deviceGap: DeviceGap;
  issuesBySeverity: Record<IssueSeverity, number>;
  dataQuality: {
    freshness: Freshness;
    behaviorGoalsAvailableFrom: string;
    directionGoalsAvailableFrom: string;
    behaviorRowsInPeriod: number;
    snapshotAvailable: boolean;
    notes: BehaviorQualityNote[];
  };
  generatedAt: Date;
}
