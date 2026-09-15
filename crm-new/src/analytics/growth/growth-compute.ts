import type { BehaviorInput } from '../behavior/behavior-compute';
import type { AnalyticsPeriod } from '../metrics/analytics-period';
import type {
  Freshness,
  Overview,
  Slice,
  SourceRow,
  UtmRow,
} from '../metrics/metrics-contract';
import { percent } from '../metrics/ratios';
import type {
  AudienceDefinition,
  ChangeType,
  Confounder,
  DataQualityFlag,
  EvaluationWindows,
  ExpectedDirection,
  GrowthEvaluation,
  GrowthMetricDefinition,
  GrowthMetricKey,
  MaturityPolicy,
  MetricEvaluation,
  MetricStatistics,
  MetricValue,
  SegmentEvaluation,
  Verdict,
} from './growth-contract';
import { GROWTH_METRIC_VERSION } from './growth-contract';
import { maturityInfo } from './growth-maturity';
import {
  defaultContextMetrics,
  GROWTH_METRICS,
  scopeCompatibility,
} from './growth-metrics';
import {
  MATCHED_COVERAGE_MIN_PCT,
  MIN_BOOTSTRAP_SAMPLE,
  MIN_EVENTS,
  MIN_ORDERS,
  MIN_SAMPLE_VISITS,
  MIN_WINDOW_DAYS_FOR_SIGNAL,
  MIX_MIN_SHARE_PCT,
  MIX_SHIFT_POINTS_ATTENTION,
  TARGET_RELATIVE_EFFECT,
} from './growth-rules';
import {
  bootstrapMeanDifference,
  fisherExactTwoSided,
  mdeCountRelative,
  mdeProportion,
  newcombeDifference,
  normalApproximationOk,
  poissonRateComparison,
  requiredEventsCount,
  requiredSampleProportion,
  STAT_ASSUMPTIONS,
  twoProportionZ,
} from './growth-statistics';
import { fmtDate, metricComparability } from './growth-windows';

/**
 * Чистая оценка «до / после» (этап 11, разделы 7–15). Данные окон собирает
 * AnalyticsGrowthService из сервисов этапов 08 и 10; здесь — извлечение
 * значений по каталогу, сопоставимость, созревание, статистика, вердикт,
 * confounders и детерминированные тексты FACT / INTERPRETATION / RECOMMENDATION.
 * Ни одна ветка не превращает заблокированное значение в 0 и не объявляет причинность.
 */

export interface CohortData {
  /** Заявки с датой заявки в окне и их исходы к дате наблюдения. */
  leads: number;
  leadsAccepted: number;
  leadsPaid: number;
  /** Принятые в окне и их оплаты к дате наблюдения; суммы заказов — для сумм и бутстрэпа. */
  accepted: number;
  acceptedPaid: number;
  acceptedContractValues: number[];
  acceptedPaidValues: number[];
}

export interface WindowData {
  period: AnalyticsPeriod;
  overview: Overview;
  /** Поведенческие агрегаты этапа 10: цели, устройства и страницы входа (с достижениями и визитами). */
  behavior: BehaviorInput;
  cohorts: CohortData;
  /** Срезы этапа 09, которых нет в поведенческих агрегатах: источники всегда, UTM — только для аудитории по UTM. */
  slices: {
    sources: Slice<SourceRow>;
    utm: Slice<UtmRow> | null;
  };
}

export interface ChangeForEvaluation {
  id: string;
  changeType: ChangeType;
  surface: string;
  primaryMetric: GrowthMetricKey;
  secondaryMetrics: GrowthMetricKey[];
  expectedDirection: ExpectedDirection;
  audienceDefinition: AudienceDefinition | null;
}

export interface OverlappingChange {
  id: string;
  name: string;
  surface: string;
  startedAt: string;
  endedAt: string | null;
}

export interface EvaluationInputs {
  change: ChangeForEvaluation;
  windows: EvaluationWindows;
  before: WindowData;
  after: WindowData;
  maturityPolicy: MaturityPolicy;
  freshness: Freshness;
  lastSyncRunId: string | null;
  overlapping: OverlappingChange[];
  evaluatedAt: Date;
  version: number;
  trigger: 'manual' | 'scheduler';
}

// ---------------------------------------------------------------------------
// Значения метрик из данных окна

function goalVisits(b: BehaviorInput, event: string): number {
  return b.goalTotals.get(event)?.visits ?? 0;
}

const ratioValue = (num: number | null, den: number | null): MetricValue => ({
  numerator: num,
  denominator: den,
  value: num === null || den === null ? null : percent(num, den),
  sample: den ?? 0,
});
const countValue = (
  num: number | null,
  days: number,
  sample?: number,
): MetricValue => ({
  numerator: num,
  denominator: days,
  value: num,
  sample: sample ?? num ?? 0,
});
const sumValue = (sum: number | null, n: number): MetricValue => ({
  numerator: sum,
  denominator: n,
  value: sum,
  sample: n,
});
const meanValue = (values: number[]): MetricValue => ({
  numerator: values.reduce((s, v) => s + v, 0),
  denominator: values.length,
  value: values.length
    ? values.reduce((s, v) => s + v, 0) / values.length
    : null,
  sample: values.length,
  values,
});

export function metricValue(
  key: GrowthMetricKey,
  w: WindowData,
  days: number,
): MetricValue {
  const o = w.overview;
  const visits = o.traffic.visits;
  const c = w.cohorts;
  switch (key) {
    case 'visits':
      return countValue(visits, days);
    case 'siteLeads':
      return countValue(o.siteFunnel.siteLeads, days, visits);
    case 'siteLeadRate':
      return ratioValue(o.siteFunnel.siteLeads, visits);
    case 'formStarts':
      return countValue(goalVisits(w.behavior, 'form_started'), days, visits);
    case 'formStartRate':
      return ratioValue(goalVisits(w.behavior, 'form_started'), visits);
    case 'leadAttempts':
      return countValue(
        goalVisits(w.behavior, 'lead_submit_attempt'),
        days,
        visits,
      );
    case 'formErrors':
      return countValue(goalVisits(w.behavior, 'form_error'), days, visits);
    case 'formErrorRate':
      return ratioValue(
        goalVisits(w.behavior, 'form_error'),
        goalVisits(w.behavior, 'form_started'),
      );
    case 'matchedAccepted':
      return countValue(o.siteFunnel.matchedAccepted, days, visits);
    case 'matchedAcceptedRate':
      return ratioValue(o.siteFunnel.matchedAccepted, visits);
    case 'matchedPaid':
      return countValue(o.siteFunnel.matchedPaid, days, visits);
    case 'crmLeads':
      return countValue(c.leads, days);
    case 'acceptedOrders':
      return countValue(c.accepted, days);
    case 'leadToAcceptedRate':
      return ratioValue(c.leadsAccepted, c.leads);
    case 'leadToPaidRate':
      return ratioValue(c.leadsPaid, c.leads);
    case 'paidOrders':
      return countValue(c.acceptedPaid, days, c.accepted);
    case 'paidAov':
      return meanValue(c.acceptedPaidValues);
    case 'contractValue':
      return sumValue(
        c.acceptedContractValues.reduce((s, v) => s + v, 0),
        c.accepted,
      );
    case 'paidOrderValue':
      return sumValue(
        c.acceptedPaidValues.reduce((s, v) => s + v, 0),
        c.acceptedPaid,
      );
    case 'realizedRevenue':
      return sumValue(
        o.financials.realized?.realizedRevenue ?? null,
        o.financials.realized?.orders ?? 0,
      );
    case 'netProfit':
      return sumValue(
        o.financials.realized?.netProfit ?? null,
        o.financials.realized?.orders ?? 0,
      );
  }
}

// ---------------------------------------------------------------------------
// Статистика по виду метрики

export function computeStatistics(
  def: GrowthMetricDefinition,
  before: MetricValue,
  after: MetricValue,
  days: number,
): MetricStatistics {
  const base: Omit<MetricStatistics, 'method'> = {
    absoluteDifference: null,
    relativeDifference: null,
    confidenceInterval: null,
    relativeConfidenceInterval: null,
    pValue: null,
    mde: null,
    requiredSample: null,
    assumptions: STAT_ASSUMPTIONS,
    note: null,
  };
  const rel = (b: number | null, a: number | null): number | null =>
    b === null || a === null || b === 0 ? null : ((a - b) / Math.abs(b)) * 100;

  if (def.kind === 'ratio') {
    const x1 = before.numerator ?? 0,
      n1 = before.denominator ?? 0;
    const x2 = after.numerator ?? 0,
      n2 = after.denominator ?? 0;
    if (n1 <= 0 || n2 <= 0)
      return {
        ...base,
        method: 'descriptive_only',
        note: 'Знаменатель одного из окон равен нулю — доля не определена.',
      };
    const p1 = x1 / n1,
      p2 = x2 / n2;
    const exact = !normalApproximationOk(x1, n1, x2, n2);
    const pValue = exact
      ? fisherExactTwoSided(x1, n1, x2, n2)
      : (twoProportionZ(x1, n1, x2, n2)?.pValue ?? null);
    const ci = newcombeDifference(x1, n1, x2, n2);
    const mdeAbs = mdeProportion(p1, n1, n2);
    const req = requiredSampleProportion(p1);
    return {
      ...base,
      method: exact ? 'fisher_exact_two_sided' : 'two_proportion_z_pooled',
      absoluteDifference: (p2 - p1) * 100,
      relativeDifference: rel(p1, p2),
      confidenceInterval: {
        low: ci.low * 100,
        high: ci.high * 100,
        level: ci.level,
      },
      relativeConfidenceInterval:
        p1 > 0
          ? {
              low: (ci.low / p1) * 100,
              high: (ci.high / p1) * 100,
              level: ci.level,
            }
          : null,
      pValue,
      mde:
        mdeAbs === null
          ? null
          : {
              absolute: mdeAbs * 100,
              relative: p1 > 0 ? (mdeAbs / p1) * 100 : null,
            },
      requiredSample:
        req === null
          ? null
          : { perWindow: req, targetRelativeEffect: TARGET_RELATIVE_EFFECT },
      note: exact
        ? 'Ожидаемые частоты малы — точный тест Фишера; интервал разности по Ньюкомбу (Wilson).'
        : 'z-тест двух долей с объединённой долей; интервал разности по Ньюкомбу (Wilson).',
    };
  }

  if (def.kind === 'count') {
    const x1 = before.numerator ?? 0,
      x2 = after.numerator ?? 0;
    const cmp = poissonRateComparison(x1, days, x2, days);
    const mdeRel = mdeCountRelative(x1, days, days);
    return {
      ...base,
      method: 'poisson_conditional_binomial_exact',
      absoluteDifference: x2 - x1,
      relativeDifference: rel(x1, x2),
      confidenceInterval: null,
      relativeConfidenceInterval:
        cmp.ci === null
          ? null
          : {
              low: (cmp.ci.low - 1) * 100,
              high:
                cmp.ci.high === Infinity ? Infinity : (cmp.ci.high - 1) * 100,
              level: cmp.ci.level,
            },
      pValue: cmp.pValue,
      mde:
        mdeRel === null
          ? null
          : { absolute: mdeRel * x1, relative: mdeRel * 100 },
      requiredSample: {
        perWindow: requiredEventsCount(),
        targetRelativeEffect: TARGET_RELATIVE_EFFECT,
      },
      note: 'Счётчики за равные окна как пуассоновские интенсивности: условный биномиальный точный тест; интервал отношения интенсивностей через Wilson; requiredSample — событий в базовом окне.',
    };
  }

  if (def.kind === 'mean') {
    const a = before.values ?? [],
      b = after.values ?? [];
    if (a.length < MIN_BOOTSTRAP_SAMPLE || b.length < MIN_BOOTSTRAP_SAMPLE)
      return {
        ...base,
        method: 'descriptive_only',
        absoluteDifference:
          before.value === null || after.value === null
            ? null
            : after.value - before.value,
        relativeDifference: rel(before.value, after.value),
        note: `Меньше ${MIN_BOOTSTRAP_SAMPLE} оплаченных заказов в окне — интервал среднего чека не считается (STATISTICAL_TEST_UNAVAILABLE).`,
      };
    const boot = bootstrapMeanDifference(a, b);
    return {
      ...base,
      method: 'bootstrap_percentile_mean_diff',
      absoluteDifference: boot?.difference ?? null,
      relativeDifference: rel(before.value, after.value),
      confidenceInterval: boot?.ci ?? null,
      note: 'Перцентильный бутстрэп разности средних по заказам когорт (2000 повторов, фиксированное зерно); p-value не вычисляется.',
    };
  }

  return {
    ...base,
    method: 'descriptive_only',
    absoluteDifference:
      before.value === null || after.value === null
        ? null
        : after.value - before.value,
    relativeDifference: rel(before.value, after.value),
    note: 'Сумма денег за окно — описательное сравнение без теста (STATISTICAL_TEST_UNAVAILABLE).',
  };
}

// ---------------------------------------------------------------------------
// Вердикт метрики

function goodDirection(
  def: GrowthMetricDefinition,
  expected: ExpectedDirection,
): 1 | -1 | 0 {
  if (expected === 'INCREASE') return 1;
  if (expected === 'DECREASE') return -1;
  return def.polarity === 'higher-good'
    ? 1
    : def.polarity === 'lower-good'
      ? -1
      : 0;
}

function sampleGate(
  def: GrowthMetricDefinition,
  before: MetricValue,
  after: MetricValue,
): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];
  const events = (before.numerator ?? 0) + (after.numerator ?? 0);
  if (def.kind === 'ratio') {
    if ((before.denominator ?? 0) === 0 || (after.denominator ?? 0) === 0)
      flags.push('ZERO_DENOMINATOR');
    const minDen = def.scope === 'crm' ? MIN_ORDERS : MIN_SAMPLE_VISITS;
    if (Math.min(before.denominator ?? 0, after.denominator ?? 0) < minDen)
      flags.push('LOW_SAMPLE');
    if (events < MIN_EVENTS) flags.push('LOW_SAMPLE');
  } else if (def.kind === 'count') {
    if (events < MIN_EVENTS) flags.push('LOW_SAMPLE');
    if (
      def.scope === 'site' &&
      def.key !== 'visits' &&
      Math.min(before.sample, after.sample) < MIN_SAMPLE_VISITS
    )
      flags.push('LOW_SAMPLE');
  } else if (def.kind === 'mean') {
    if (Math.min(before.sample, after.sample) < MIN_BOOTSTRAP_SAMPLE)
      flags.push('LOW_SAMPLE');
  } else if (Math.min(before.sample, after.sample) < MIN_ORDERS)
    flags.push('LOW_SAMPLE');
  return [...new Set(flags)];
}

function signalVerdict(
  def: GrowthMetricDefinition,
  expected: ExpectedDirection,
  stats: MetricStatistics,
): Verdict {
  const diff = stats.absoluteDifference;
  if (diff === null) return 'INSUFFICIENT_DATA';
  const ci =
    def.kind === 'count'
      ? stats.relativeConfidenceInterval
      : stats.confidenceInterval;
  const significant =
    ci !== null &&
    (ci.low > 0 || ci.high < 0) &&
    (stats.pValue === null || stats.pValue < STAT_ASSUMPTIONS.alpha);
  if (significant && diff !== 0) {
    const good = goodDirection(def, expected);
    if (good === 0) return 'POSITIVE_SIGNAL';
    return Math.sign(diff) === good ? 'POSITIVE_SIGNAL' : 'NEGATIVE_SIGNAL';
  }
  if (stats.mde?.relative !== null && stats.mde?.relative !== undefined)
    return stats.mde.relative <= TARGET_RELATIVE_EFFECT * 100
      ? 'NO_CLEAR_CHANGE'
      : 'INSUFFICIENT_DATA';
  return 'INSUFFICIENT_DATA';
}

export function evaluateMetric(
  key: GrowthMetricKey,
  role: MetricEvaluation['role'],
  inputs: EvaluationInputs,
): MetricEvaluation {
  const def = GROWTH_METRICS[key];
  const { windows, before: wb, after: wa, change } = inputs;
  const before = metricValue(key, wb, windows.days);
  const after = metricValue(key, wa, windows.days);
  const comparability = metricComparability(def, windows);
  const maturity = maturityInfo(
    def.maturity,
    windows.after.to,
    windows.observationCutoff,
    inputs.maturityPolicy,
    def.maturity === 'accepted'
      ? inputs.maturityPolicy.leadToAccepted.medianDays
      : def.maturity === 'paid'
        ? inputs.maturityPolicy.acceptedToPaid.medianDays
        : null,
  );
  const compat = scopeCompatibility(key, change.changeType);
  const flags: DataQualityFlag[] = [];
  if (role === 'primary' && compat !== 'valid')
    flags.push('METRIC_SCOPE_MISMATCH');
  flags.push(
    ...comparability.codes.filter((c) => c !== 'INCOMPARABLE_WINDOWS'),
  );
  if (!comparability.comparable) flags.push('INCOMPARABLE_WINDOWS');
  if (def.scope === 'matched') {
    const cov = [
      wb.overview.dataQuality.clientIdCoverageAccepted,
      wa.overview.dataQuality.clientIdCoverageAccepted,
    ];
    if (cov.some((c) => c === null || c < MATCHED_COVERAGE_MIN_PCT))
      flags.push('MATCHED_COVERAGE_LOW');
  }
  if (
    key === 'netProfit' &&
    [wb, wa].some((w) =>
      w.overview.dataQuality.notes.includes('COGS_UNRELIABLE_ORDERS'),
    )
  )
    flags.push('COGS_INCOMPLETE');
  if (maturity.status !== 'MATURE') flags.push('IMMATURE_OUTCOME');
  flags.push(...sampleGate(def, before, after));
  if (inputs.freshness.status === 'STALE') flags.push('ANALYTICS_STALE');
  // (a) Меньше недели полных дней — состав дней недели не уравновешен и объём мал: сигнала быть не может.
  if (windows.days < MIN_WINDOW_DAYS_FOR_SIGNAL) flags.push('SHORT_WINDOW');

  const stats = computeStatistics(def, before, after, windows.days);
  if (stats.method === 'descriptive_only')
    flags.push('STATISTICAL_TEST_UNAVAILABLE');

  let verdict: Verdict;
  if (role === 'primary' && compat !== 'valid') verdict = 'INCOMPARABLE';
  else if (!comparability.comparable) verdict = 'INCOMPARABLE';
  else if (
    flags.includes('MATCHED_COVERAGE_LOW') ||
    flags.includes('COGS_INCOMPLETE')
  )
    verdict = 'INSUFFICIENT_DATA';
  else if (maturity.status !== 'MATURE') verdict = 'IMMATURE';
  else if (
    flags.includes('ZERO_DENOMINATOR') ||
    flags.includes('LOW_SAMPLE') ||
    flags.includes('SHORT_WINDOW')
  )
    verdict = 'INSUFFICIENT_DATA';
  else if (stats.method === 'descriptive_only') verdict = 'INSUFFICIENT_DATA';
  else verdict = signalVerdict(def, change.expectedDirection, stats);

  const strip = (v: MetricValue): MetricValue => {
    const { values: _values, ...rest } = v;
    void _values;
    return rest;
  };
  return {
    metric: key,
    label: def.label,
    scope: def.scope,
    kind: def.kind,
    unit: def.unit,
    role,
    scopeCompatibility:
      role === 'primary' && compat !== 'valid' ? 'mismatch' : compat,
    before: strip(before),
    after: strip(after),
    comparability,
    maturity,
    statistics: stats,
    verdict,
    flags: [...new Set(flags)],
  };
}

// ---------------------------------------------------------------------------
// Сегменты

type SegmentRows = {
  key: string;
  visits: number;
  siteLeads: number;
  matchedAccepted: number;
  matchedPaid: number;
  goals?: Map<string, { visits: number }>;
}[];

function segmentRows(
  w: WindowData,
  dimension: AudienceDefinition['dimension'],
): SegmentRows {
  switch (dimension) {
    case 'device':
      // Достижения lead_submitted по устройствам — из поведенческого набора (те же reaches, что siteLeads).
      return w.behavior.byDevice.map((d) => ({
        key: d.deviceCategory,
        visits: d.visits,
        siteLeads: d.goals.get('lead_submitted')?.reaches ?? 0,
        matchedAccepted: d.matchedAccepted,
        matchedPaid: 0,
        goals: d.goals,
      }));
    case 'source':
      return w.slices.sources.rows.map((r) => ({
        key: r.trafficSource,
        visits: r.visits,
        siteLeads: r.siteLeads,
        matchedAccepted: r.matchedAccepted,
        matchedPaid: r.matchedPaid,
      }));
    case 'utm':
      return (w.slices.utm?.rows ?? []).map((r) => ({
        key: r.utmSource,
        visits: r.visits,
        siteLeads: r.siteLeads,
        matchedAccepted: r.matchedAccepted,
        matchedPaid: r.matchedPaid,
      }));
    case 'landing':
      return w.behavior.byLanding.map((l) => ({
        key: l.normalizedPath,
        visits: l.visits,
        siteLeads: l.goals.get('lead_submitted')?.reaches ?? 0,
        matchedAccepted: l.matchedAccepted,
        matchedPaid: 0,
        goals: l.goals,
      }));
  }
}

const SEGMENT_METRICS: Partial<
  Record<
    GrowthMetricKey,
    (row: SegmentRows[number] | undefined, days: number) => MetricValue | null
  >
> = {
  visits: (r, d) => countValue(r?.visits ?? 0, d),
  siteLeads: (r, d) => countValue(r?.siteLeads ?? 0, d, r?.visits ?? 0),
  siteLeadRate: (r) => ratioValue(r?.siteLeads ?? 0, r?.visits ?? 0),
  matchedAccepted: (r, d) =>
    countValue(r?.matchedAccepted ?? 0, d, r?.visits ?? 0),
  matchedAcceptedRate: (r) =>
    ratioValue(r?.matchedAccepted ?? 0, r?.visits ?? 0),
  formStarts: (r, d) =>
    r?.goals
      ? countValue(r.goals.get('form_started')?.visits ?? 0, d, r.visits)
      : null,
  formStartRate: (r) =>
    r?.goals
      ? ratioValue(r.goals.get('form_started')?.visits ?? 0, r.visits)
      : null,
};

/** Сегменты только там, где хранимые агрегаты честно дают числитель и знаменатель. */
export function segmentSupported(
  metric: GrowthMetricKey,
  dimension: AudienceDefinition['dimension'],
): boolean {
  if (!(metric in SEGMENT_METRICS)) return false;
  if (metric === 'matchedPaid') return false;
  if (
    (metric === 'formStarts' || metric === 'formStartRate') &&
    dimension !== 'device' &&
    dimension !== 'landing'
  )
    return false;
  return true;
}

export function evaluateSegments(
  inputs: EvaluationInputs,
  primary: MetricEvaluation,
): SegmentEvaluation[] {
  const { change, windows, before, after } = inputs;
  const def = GROWTH_METRICS[change.primaryMetric];
  const out: SegmentEvaluation[] = [];
  const wanted: {
    dimension: AudienceDefinition['dimension'];
    values: string[];
    role: SegmentEvaluation['role'];
  }[] = [];
  if (change.audienceDefinition)
    wanted.push({ ...change.audienceDefinition, role: 'audience' });
  if (
    !change.audienceDefinition ||
    change.audienceDefinition.dimension !== 'device'
  )
    wanted.push({
      dimension: 'device',
      values: ['desktop', 'mobile'],
      role: 'exploratory',
    });
  for (const w of wanted) {
    if (!segmentSupported(change.primaryMetric, w.dimension)) {
      for (const v of w.values)
        out.push({
          dimension: w.dimension,
          value: v,
          metric: change.primaryMetric,
          before: {
            numerator: null,
            denominator: null,
            value: null,
            sample: 0,
          },
          after: { numerator: null, denominator: null, value: null, sample: 0 },
          statistics: null,
          verdict: 'INCOMPARABLE',
          flags: ['UNSUPPORTED_SEGMENT'],
          role: w.role,
        });
      continue;
    }
    const rb = segmentRows(before, w.dimension);
    const ra = segmentRows(after, w.dimension);
    const extract = SEGMENT_METRICS[change.primaryMetric]!;
    for (const v of w.values) {
      const b = extract(
        rb.find((r) => r.key === v),
        windows.days,
      );
      const a = extract(
        ra.find((r) => r.key === v),
        windows.days,
      );
      if (!b || !a) continue;
      const flags: DataQualityFlag[] = [...sampleGate(def, b, a)];
      if (!primary.comparability.comparable) flags.push('INCOMPARABLE_WINDOWS');
      if (primary.maturity.status !== 'MATURE') flags.push('IMMATURE_OUTCOME');
      const stats = computeStatistics(def, b, a, windows.days);
      const verdict: Verdict = !primary.comparability.comparable
        ? 'INCOMPARABLE'
        : primary.maturity.status !== 'MATURE'
          ? 'IMMATURE'
          : flags.includes('LOW_SAMPLE') ||
              flags.includes('ZERO_DENOMINATOR') ||
              windows.days < MIN_WINDOW_DAYS_FOR_SIGNAL
            ? 'INSUFFICIENT_DATA'
            : signalVerdict(def, change.expectedDirection, stats);
      out.push({
        dimension: w.dimension,
        value: v,
        metric: change.primaryMetric,
        before: b,
        after: a,
        statistics: stats,
        verdict,
        flags: [...new Set(flags)],
        role: w.role,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Confounders

function shares(rows: { key: string; visits: number }[]): Map<string, number> {
  const total = rows.reduce((s, r) => s + r.visits, 0);
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.key, total > 0 ? (r.visits / total) * 100 : 0);
  return m;
}

function mixShift(
  code: 'SOURCE_MIX_SHIFT' | 'DEVICE_MIX_SHIFT' | 'LANDING_MIX_SHIFT',
  label: string,
  before: { key: string; visits: number }[],
  after: { key: string; visits: number }[],
): Confounder | null {
  const sb = shares(before),
    sa = shares(after);
  const keys = [...new Set([...sb.keys(), ...sa.keys()])].filter(
    (k) =>
      (sb.get(k) ?? 0) >= MIX_MIN_SHARE_PCT ||
      (sa.get(k) ?? 0) >= MIX_MIN_SHARE_PCT,
  );
  const rows = keys
    .map((k) => ({ key: k, before: sb.get(k) ?? 0, after: sa.get(k) ?? 0 }))
    .sort(
      (a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before),
    );
  const top = rows[0];
  if (!top) return null;
  const delta = Math.abs(top.after - top.before);
  if (delta < MIX_SHIFT_POINTS_ATTENTION) return null;
  return {
    code,
    severity: 'ATTENTION',
    fact: `${label}: доля «${top.key}» ${fmtPct(top.before)} → ${fmtPct(top.after)} визитов (${delta >= 0 ? '' : ''}${fmtPp(top.after - top.before)}); состав трафика изменился — сравнение окон может отражать смену аудитории, а не правку.`,
    shares: rows
      .slice(0, 6)
      .map((r) => ({ key: r.key, before: r.before, after: r.after })),
  };
}

export function computeConfounders(
  inputs: EvaluationInputs,
  metrics: MetricEvaluation[],
): Confounder[] {
  const out: Confounder[] = [];
  const { windows, before, after, overlapping, freshness } = inputs;
  if (windows.flags.includes('WEEKDAY_MIX_MISMATCH'))
    out.push({
      code: 'WEEKDAY_MIX_MISMATCH',
      severity: 'ATTENTION',
      fact: `Состав дней недели в окнах различается (${windows.days} дн. — не целые недели): будни и выходные ведут себя по-разному.`,
    });
  const src = mixShift(
    'SOURCE_MIX_SHIFT',
    'Источники',
    before.slices.sources.rows.map((r) => ({
      key: r.trafficSourceName || r.trafficSource,
      visits: r.visits,
    })),
    after.slices.sources.rows.map((r) => ({
      key: r.trafficSourceName || r.trafficSource,
      visits: r.visits,
    })),
  );
  if (src) out.push(src);
  const dev = mixShift(
    'DEVICE_MIX_SHIFT',
    'Устройства',
    before.behavior.byDevice.map((r) => ({
      key: r.deviceCategory,
      visits: r.visits,
    })),
    after.behavior.byDevice.map((r) => ({
      key: r.deviceCategory,
      visits: r.visits,
    })),
  );
  if (dev) out.push(dev);
  const land = mixShift(
    'LANDING_MIX_SHIFT',
    'Страницы входа',
    before.behavior.byLanding.map((r) => ({
      key: r.normalizedPath,
      visits: r.visits,
    })),
    after.behavior.byLanding.map((r) => ({
      key: r.normalizedPath,
      visits: r.visits,
    })),
  );
  if (land) out.push(land);
  // (b) оговорки о метриках — только по заявленным (первичная + вторичные): контекст показан рядом
  // со своими вердиктами и не должен окрашивать вывод об изменении.
  const declared = metrics.filter((m) => m.role !== 'context');
  const cutovers = [
    ...new Set(declared.flatMap((m) => m.comparability.cutoversInside)),
  ];
  if (cutovers.length > 0)
    out.push({
      code: 'MEASUREMENT_DEFINITION_CHANGED',
      severity: 'ATTENTION',
      fact: `Внутри сравнения менялось определение метрик (${cutovers.map(fmtDate).join(', ')}): ${declared
        .filter((m) => m.comparability.cutoversInside.length)
        .map((m) => m.label)
        .join(', ')} — окна несопоставимы.`,
    });
  if (overlapping.length > 0)
    out.push({
      code: 'OVERLAPPING_CHANGE',
      severity: 'ATTENTION',
      fact: `Одновременно действовали другие изменения: ${overlapping.map((o) => `«${o.name}» (${o.surface}, с ${fmtDate(o.startedAt.slice(0, 10))})`).join('; ')} — разницу нельзя приписать одному изменению.`,
      relatedChangeIds: overlapping.map((o) => o.id),
    });
  if (freshness.status === 'STALE')
    out.push({
      code: 'ANALYTICS_STALE',
      severity: 'ATTENTION',
      fact: 'Данные Метрики давно не обновлялись — окно «после» может быть неполным.',
    });
  const primary = metrics.find((m) => m.role === 'primary');
  if (primary?.flags.includes('LOW_SAMPLE'))
    out.push({
      code: 'LOW_SAMPLE',
      severity: 'ATTENTION',
      fact: `Выборка первичной метрики ниже порога (визитов ${fmtInt(primary.before.sample)} / ${fmtInt(primary.after.sample)}, событий ${fmtInt((primary.before.numerator ?? 0) + (primary.after.numerator ?? 0))}).`,
    });
  if (declared.some((m) => m.flags.includes('MATCHED_COVERAGE_LOW')))
    out.push({
      code: 'MATCHED_COVERAGE_LOW',
      severity: 'ATTENTION',
      fact: `Покрытие ClientID у принятых заказов ниже ${MATCHED_COVERAGE_MIN_PCT} % — сопоставленные метрики не переносятся на все заказы CRM.`,
    });
  if (declared.some((m) => m.flags.includes('COGS_INCOMPLETE')))
    out.push({
      code: 'COGS_INCOMPLETE',
      severity: 'ATTENTION',
      fact: 'У части заказов себестоимость ненадёжна — прибыль за окно неполная.',
    });
  if (primary && primary.maturity.status !== 'MATURE')
    out.push({
      code: 'IMMATURE_OUTCOME',
      severity: 'INFO',
      fact: primary.maturity.note ?? 'Исход первичной метрики ещё созревает.',
    });
  return out;
}

// ---------------------------------------------------------------------------
// Тексты

const fmtInt = (v: number | null): string =>
  v === null ? '—' : Math.round(v).toLocaleString('ru-RU');
const fmtPct = (v: number | null): string =>
  v === null ? '—' : `${(Math.round(v * 100) / 100).toLocaleString('ru-RU')} %`;
const fmtPp = (v: number | null): string =>
  v === null
    ? '—'
    : `${v > 0 ? '+' : ''}${(Math.round(v * 100) / 100).toLocaleString('ru-RU')} п.п.`;
const fmtRub = (v: number | null): string =>
  v === null ? '—' : `${Math.round(v).toLocaleString('ru-RU')} ₽`;
const fmtSigned = (v: number | null, unit: string): string =>
  v === null
    ? '—'
    : `${v > 0 ? '+' : ''}${(Math.round(v * 100) / 100).toLocaleString('ru-RU')}${unit}`;

export function formatMetricValue(m: MetricEvaluation, v: MetricValue): string {
  if (v.value === null) return '—';
  if (m.kind === 'ratio')
    return `${fmtPct(v.value)} (${fmtInt(v.numerator)} из ${fmtInt(v.denominator)})`;
  if (m.unit === 'rub')
    return m.kind === 'mean'
      ? `${fmtRub(v.value)} (заказов ${fmtInt(v.sample)})`
      : fmtRub(v.value);
  return fmtInt(v.value);
}

export function factText(
  m: MetricEvaluation,
  windows: EvaluationWindows,
): string {
  const s = m.statistics;
  const diff =
    s?.absoluteDifference === null || s === null
      ? '—'
      : m.kind === 'ratio'
        ? fmtPp(s.absoluteDifference)
        : m.unit === 'rub'
          ? fmtSigned(s.absoluteDifference, ' ₽')
          : fmtSigned(s.absoluteDifference, '');
  const rel =
    s?.relativeDifference === null || s === null
      ? ''
      : ` (${fmtSigned(s.relativeDifference, ' %')})`;
  const ci =
    s?.confidenceInterval && m.kind === 'ratio'
      ? `; 95 % ДИ разницы [${fmtPp(s.confidenceInterval.low)}; ${fmtPp(s.confidenceInterval.high)}]`
      : s?.relativeConfidenceInterval && m.kind === 'count'
        ? `; 95 % ДИ относительного изменения [${fmtSigned(s.relativeConfidenceInterval.low, ' %')}; ${s.relativeConfidenceInterval.high === Infinity ? '∞' : fmtSigned(s.relativeConfidenceInterval.high, ' %')}]`
        : s?.confidenceInterval && m.kind === 'mean'
          ? `; 95 % бутстрэп-ДИ [${fmtSigned(s.confidenceInterval.low, ' ₽')}; ${fmtSigned(s.confidenceInterval.high, ' ₽')}]`
          : '';
  const p =
    s?.pValue !== null && s?.pValue !== undefined
      ? `; p = ${s.pValue < 0.001 ? '< 0,001' : (Math.round(s.pValue * 1000) / 1000).toLocaleString('ru-RU')}`
      : '';
  return `«${m.label}»: до (${fmtDate(windows.before.from)}–${fmtDate(windows.before.to)}) ${formatMetricValue(m, m.before)}, после (${fmtDate(windows.after.from)}–${fmtDate(windows.after.to)}) ${formatMetricValue(m, m.after)}; разница ${diff}${rel}${ci}${p}.`;
}

export function interpretationText(
  m: MetricEvaluation,
  confounders: Confounder[],
): string {
  const s = m.statistics;
  const conf = confounders
    .filter((c) => c.severity === 'ATTENTION')
    .map((c) => c.code);
  const confText = conf.length ? ` Оговорки: ${conf.join(', ')}.` : '';
  switch (m.verdict) {
    case 'INCOMPARABLE':
      return m.scopeCompatibility === 'mismatch'
        ? `Метрика «${m.label}» не отвечает на вопрос изменения этого типа (METRIC_SCOPE_MISMATCH): она описывает другое пространство данных, разница показана только как контекст.`
        : (m.comparability.note ?? 'Окна «до» и «после» несопоставимы.') +
            confText;
    case 'IMMATURE':
      return (
        (m.maturity.note ?? 'Исход ещё созревает.') +
        ' Разница может измениться по мере созревания заказов; итог не окончательный.' +
        confText
      );
    case 'INSUFFICIENT_DATA': {
      const mde =
        s?.mde?.relative !== null && s?.mde?.relative !== undefined
          ? ` При текущем объёме обнаружим только эффект от ±${fmtInt(s.mde.relative)} % относительно базы`
          : '';
      const req = s?.requiredSample
        ? ` (для ${fmtInt(s.requiredSample.targetRelativeEffect * 100)} % нужно ≈ ${fmtInt(s.requiredSample.perWindow)} ${m.kind === 'count' ? 'событий' : m.scope === 'crm' ? 'заказов' : 'визитов'} на окно)`
        : '';
      const why = m.flags.includes('SHORT_WINDOW')
        ? ' Окно короче недели — состав дней недели не уравновешен; сигнал возможен только от 7 полных дней.'
        : m.flags.includes('MATCHED_COVERAGE_LOW')
          ? ' Покрытие ClientID недостаточно, чтобы доверять сопоставлению.'
          : m.flags.includes('COGS_INCOMPLETE')
            ? ' Себестоимость части заказов ненадёжна — прибыль неполная.'
            : m.flags.includes('STATISTICAL_TEST_UNAVAILABLE')
              ? ' Для этой метрики нет статистического теста — только описательное сравнение.'
              : '';
      return `Данных недостаточно, чтобы отличить изменение от обычных колебаний.${mde}${req}.${why}${confText}`;
    }
    case 'NO_CLEAR_CHANGE':
      return `Различие в пределах обычных колебаний; объём данных достаточен, чтобы заметить эффект ≥ ${fmtInt(TARGET_RELATIVE_EFFECT * 100)} %, — заметного изменения метрики нет.${confText}`;
    case 'POSITIVE_SIGNAL':
    case 'NEGATIVE_SIGNAL':
      return `Различие больше обычных колебаний (интервал не включает 0). Это наблюдение «до / после», а не доказательство: совпадение по времени не устанавливает причину — на метрику могли повлиять состав трафика, сезон и другие изменения.${confText}`;
  }
}

export function recommendationText(
  m: MetricEvaluation,
  windows: EvaluationWindows,
): string {
  switch (m.verdict) {
    case 'INCOMPARABLE':
      return m.scopeCompatibility === 'mismatch'
        ? 'Выбрать первичную метрику того пространства, которое затронуло изменение (правка сайта → метрики сайта; правка CRM → метрики CRM).'
        : `Сравнивать окна, целиком лежащие после смены определения (${m.comparability.cutoversInside.map(fmtDate).join(', ') || fmtDate(m.comparability.measuredFrom.after)}); до этого — не делать выводов.`;
    case 'IMMATURE':
      return `Повторить оценку после ${fmtDate(m.maturity.maturityUntil)} — расписание сделает это само после синхронизации.`;
    case 'INSUFFICIENT_DATA':
      return `Продолжить наблюдение и повторить оценку с более длинным окном (сейчас ${windows.days} дн.); проверить, нет ли ошибок формы и сбоев в окне «после».`;
    case 'NO_CLEAR_CHANGE':
      return 'Заметного эффекта нет; если ожидался — проверить, дошло ли изменение до аудитории (устройства, страницы), и посмотреть исследовательские сегменты.';
    case 'POSITIVE_SIGNAL':
      return 'Проверить оговорки (состав трафика, другие изменения) и сохранить наблюдение; для доказательства причинности нужен рандомизированный эксперимент (пока недоступен).';
    case 'NEGATIVE_SIGNAL':
      return 'Проверить вручную путь пользователя после изменения (форма, ошибки, мобильная версия) и оговорки; при подтверждении рассмотреть откат.';
  }
}

// ---------------------------------------------------------------------------
// Итоговая оценка

export function computeEvaluation(inputs: EvaluationInputs): GrowthEvaluation {
  const { change, windows } = inputs;
  const primary = evaluateMetric(change.primaryMetric, 'primary', inputs);
  const secondaryKeys = change.secondaryMetrics.filter(
    (k) => k !== change.primaryMetric,
  );
  const secondary = secondaryKeys.map((k) =>
    evaluateMetric(k, 'secondary', inputs),
  );
  const contextKeys = defaultContextMetrics(change.changeType).filter(
    (k) => k !== change.primaryMetric && !secondaryKeys.includes(k),
  );
  const context = contextKeys.map((k) => evaluateMetric(k, 'context', inputs));
  const all = [primary, ...secondary, ...context];
  const confounders = computeConfounders(inputs, all);
  const segments = evaluateSegments(inputs, primary);
  const flags = new Set<DataQualityFlag>([...windows.flags, ...primary.flags]);
  const periodUsers = {
    before: inputs.before.overview.traffic.periodUsers,
    after: inputs.after.overview.traffic.periodUsers,
  };
  if (periodUsers.before === null || periodUsers.after === null)
    flags.add('UNIQUE_USERS_UNAVAILABLE_FOR_CUSTOM_WINDOW');
  if (confounders.some((c) => c.code === 'OVERLAPPING_CHANGE'))
    flags.add('OVERLAPPING_CHANGE');
  if (
    !inputs.maturityPolicy.leadToAccepted.sufficient ||
    !inputs.maturityPolicy.acceptedToPaid.sufficient
  )
    flags.add('MATURITY_HISTORY_INSUFFICIENT');
  return {
    changeId: change.id,
    version: inputs.version,
    evaluatedAt: inputs.evaluatedAt.toISOString(),
    trigger: inputs.trigger,
    metricVersion: GROWTH_METRIC_VERSION,
    evidenceType: 'OBSERVATIONAL_BEFORE_AFTER',
    causality: 'NOT_ESTABLISHED',
    abCapability: 'NO_VARIANT_ASSIGNMENT',
    windows,
    primaryMetric: change.primaryMetric,
    expectedDirection: change.expectedDirection,
    primary,
    secondary,
    context,
    segments,
    periodUsers,
    maturityPolicy: inputs.maturityPolicy,
    confounders,
    dataQuality: {
      freshness: inputs.freshness,
      flags: [...flags],
      lastSyncRunId: inputs.lastSyncRunId,
      clientIdCoverageAccepted: {
        before: inputs.before.overview.dataQuality.clientIdCoverageAccepted,
        after: inputs.after.overview.dataQuality.clientIdCoverageAccepted,
      },
    },
    verdict: primary.verdict,
    maturity: primary.maturity.status,
    FACT: factText(primary, windows),
    INTERPRETATION: interpretationText(primary, confounders),
    RECOMMENDATION: recommendationText(primary, windows),
    disclaimer:
      'Наблюдательное сравнение «до / после»: совпадение по времени не доказывает, что изменение вызвало результат. Причинность не установлена.',
  };
}
