import type { AnalyticsPeriod, Comparison, Freshness } from './analytics';

/**
 * Контракт поведения (этап 10) — зеркало `crm-new/src/analytics/behavior/behavior-contract.ts`
 * и ответа `GET /analytics/dashboard/behavior/*`. Панель только показывает: единицы
 * (события / визиты / посетители) приходят подписанными, конверсии посчитаны сервером.
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
export type StepAvailability = 'measured' | 'not_measured' | 'insufficient_data';
export type StepBasis = 'visits' | 'goal' | 'param';

/** Сопоставимость перехода с предыдущего измеренного шага (FIX_01): partial — шаги измерены с разных дат. */
export interface StepTransition {
  status: 'comparable' | 'partial';
  comparableFrom: string | null;
}

export interface FunnelStep {
  key: string;
  label: string;
  event: string | null;
  basis: StepBasis;
  availability: StepAvailability;
  availableFrom: string | null;
  measuredFrom: string | null;
  transition: StepTransition | null;
  events: number | null;
  visits: number | null;
  users: number | null;
  stepConversion: number | null;
  cumulativeConversion: number | null;
  dropoff: number | null;
  dropoffRate: number | null;
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
  comparison: FunnelComparisonStep[] | null;
  quality: BehaviorQuality;
}

export interface ErrorByKey {
  key: string;
  label: string;
  visits: number;
  users: number;
  events: number;
  shareOfErrors: number | null;
}

export interface FormErrors {
  period: AnalyticsPeriod;
  totals: {
    formErrorEvents: number;
    formErrorVisits: number;
    formStartedVisits: number;
    attemptEvents: number;
    attemptVisits: number;
    errorRate: number | null;
    errorsPerAttempt: number | null;
    serverErrorEvents: number;
    serverErrorVisits: number;
  };
  byField: ErrorByKey[];
  byDevice: { deviceCategory: string; formErrorVisits: number; formErrorEvents: number; formStartedVisits: number; errorRate: number | null }[];
  byLanding: { normalizedPath: string; visits: number; formErrorVisits: number; formStartedVisits: number; errorRate: number | null; sample: SampleStatus }[];
  comparison: { formErrorVisits: Comparison; errorRate: Comparison } | null;
  quality: BehaviorQuality;
}

export interface PageBehavior {
  normalizedPath: string;
  visits: number;
  sumDailyUsers: number;
  formStartedVisits: number;
  attemptVisits: number;
  leadVisits: number;
  formErrorVisits: number;
  matchedAccepted: number;
  formStartRate: number | null;
  leadConversion: number | null;
  errorRate: number | null;
  sample: SampleStatus;
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
  engagement: { bounceRate: number | null; pageDepth: number | null; avgDurationSeconds: number | null } | null;
  sample: SampleStatus;
}

export interface DeviceGap {
  metric: 'leadConversion' | 'formStartRate';
  mobile: number | null;
  desktop: number | null;
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

export interface PathPage {
  normalizedPath: string;
  visits: number | null;
  pageviews: number | null;
  users: number;
  share: number | null;
}

export interface PathsBehavior {
  period: AnalyticsPeriod;
  entryLead: PathPage[];
  viewedLead: PathPage[];
  exitNoLead: PathPage[];
  exitAll: PathPage[];
  totals: { leadVisits: number; leadPageviews: number; noLeadVisits: number; allVisits: number };
  dataGap: string;
  quality: BehaviorQuality;
}

export type IssueSeverity = 'INFO' | 'ATTENTION' | 'CRITICAL';
export type IssueRule = 'FUNNEL_DROPOFF' | 'DEVICE_GAP' | 'FORM_ERROR_SPIKE' | 'LANDING_UNDERPERFORMANCE' | 'LEAD_RATE_ANOMALY';

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
  fact: string;
  hypothesis: string;
  recommendation: string;
  evidence: IssueEvidence[];
  causality: 'NOT_ESTABLISHED';
  scope: { kind: 'funnel' | 'device' | 'page' | 'form' | 'site'; key: string };
}

export type SkipCode = 'LOW_SAMPLE' | 'PARTIAL_BEHAVIOR_PERIOD' | 'COMPARISON_UNAVAILABLE' | 'NO_LEADS';

export interface SkippedRule {
  rule: IssueRule;
  code: SkipCode;
  reason: string;
}

export interface BehaviorIssues {
  period: AnalyticsPeriod;
  previousPeriod: AnalyticsPeriod;
  issues: BehaviorIssue[];
  skipped: SkippedRule[];
  thresholds: Record<string, number>;
  quality: BehaviorQuality;
}

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
  generatedAt: string;
}
