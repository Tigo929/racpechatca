import { createHash } from 'node:crypto';
import type { AnalyticsPeriod } from '../metrics/analytics-period';
import type {
  CrmSlice,
  DataQualityMetrics,
  Freshness,
  LandingRow,
  ProductRow,
  Slice,
  SourceRow,
} from '../metrics/metrics-contract';
import type {
  BehaviorIssue,
  BehaviorIssues,
  Funnel,
  FunnelStep,
} from '../behavior/behavior-contract';
import type {
  Confounder,
  EvaluationWindows,
  GrowthEvaluation,
  GrowthMetricKey,
  MetricEvaluation,
  MetricValue,
  Verdict,
} from '../growth/growth-contract';
import { GROWTH_METRICS } from '../growth/growth-metrics';
import { computeStatistics } from '../growth/growth-compute';
import {
  poissonRateComparison,
  STAT_ASSUMPTIONS,
} from '../growth/growth-statistics';
import {
  type DetectedInsight,
  type DetectorRunResult,
  type InsightCategory,
  type InsightEvidence,
  type InsightFact,
  type InsightHypothesis,
  type InsightPayload,
  type InsightRecommendation,
  type InsightScope,
  type InsightSeverity,
  type LimitationCode,
  type SuppressedResult,
  type SuppressionReason,
  INSIGHT_ENGINE_VERSION,
} from './insights-contract';
import {
  DISCLAIMER,
  fmtInt,
  fmtPct,
  fmtPeriod,
  fmtPoints,
  fmtRel,
  fmtRub,
  fmtSigned,
  hypothesisText,
  NO_HYPOTHESIS_TEXT,
  violatesLanguagePolicy,
} from './insights-language';
import {
  CLIENT_ID_COVERAGE_MIN_ACCEPTED,
  CLIENT_ID_COVERAGE_MIN_PCT,
  CRITICAL_FORM_ERROR_VISITS,
  CRITICAL_FUNNEL_BREAK_BASELINE_STARTS,
  CRITICAL_FUNNEL_BREAK_MIN_VISITS,
  CRITICAL_LEADS_VANISHED_BASELINE_LEADS,
  CRITICAL_LEADS_VANISHED_MIN_VISITS,
  CRITICAL_STALE_SECONDS,
  DATA_BOUNDARIES,
  MATERIAL_COUNT_ABSOLUTE,
  MATERIAL_COUNT_RELATIVE,
  MATERIAL_ERROR_VISITS,
  MATERIAL_MONEY_RELATIVE,
  MATERIAL_MONEY_RUB,
  MATERIAL_RATE_POINTS,
  MIN_ENTITY_VISITS,
  MIN_EVENTS,
  MIX_SHIFT_POINTS,
  INSIGHT_POLARITY_OVERRIDES,
  MIRRORS_GLOBAL_TRAFFIC_POINTS,
  EVENT_GAP_MIN_FUNNEL_VISITS,
  EVENT_GAP_STEP_KINDS,
} from './insights-rules';

// ---------------------------------------------------------------------------
// Контекст запуска — всё, что детекторам нужно, загружено один раз сервисом

/** Зарегистрированное изменение этапа 11 с последней оценкой — для CHANGE_EVALUATION и как контекст. */
export interface ChangeContext {
  id: string;
  name: string;
  status: string;
  surface: string;
  startedAt: string;
  endedAt: string | null;
  latest: GrowthEvaluation | null;
  /** Версия, которую движок уже поднимал в ленту в прошлых запусках (null — ещё нет). */
  seenVersion: number | null;
}

export interface InsightContext {
  now: Date;
  runKind: 'daily' | 'hourly' | 'manual';
  observationCutoff: string;
  /** Окна 7/7 полных московских дней (строятся строителем окон этапа 11). */
  windows: EvaluationWindows;
  /** Оценки всех метрик каталога этапа 11 на этих окнах — статистика, MDE, сопоставимость, созревание. */
  metrics: Record<GrowthMetricKey, MetricEvaluation>;
  /** Confounders этапа 11 на тех же окнах (сдвиги смесей, пересекающиеся изменения, stale). */
  confounders: Confounder[];
  freshness: Freshness;
  lastSyncRunId: string | null;
  /** Качество данных окна «после»; null — лёгкий часовой контекст. */
  dataQuality: DataQualityMetrics | null;
  /** Правила этапа 10 за текущее окно — зеркалятся, не пересчитываются. */
  behavior: { issues: BehaviorIssues; funnels: Funnel[] } | null;
  slices: {
    sources: { before: Slice<SourceRow>; after: Slice<SourceRow> } | null;
    landings: { before: Slice<LandingRow>; after: Slice<LandingRow> } | null;
    products: {
      before: CrmSlice<ProductRow>;
      after: CrmSlice<ProductRow>;
    } | null;
  };
  changes: ChangeContext[];
  /** Заказов, принятых в окне (для покрытия ClientID и «объём стабилен»). */
  paidWithoutDate: number;
}

export interface InsightDetector {
  id: string;
  category: InsightCategory;
  refresh: 'daily' | 'hourly';
  source: 'STAGE12_DETECTOR' | 'STAGE10_RULE' | 'STAGE11_EVALUATION';
  evaluate(ctx: InsightContext): DetectorRunResult;
}

// ---------------------------------------------------------------------------
// Общие помощники

export function fingerprintOf(
  category: InsightCategory,
  detectorId: string,
  metricKey: string | null,
  entityKey: string | null,
): string {
  return createHash('sha1')
    .update(`${category}|${detectorId}|${metricKey ?? ''}|${entityKey ?? ''}`)
    .digest('hex')
    .slice(0, 20);
}

/** Каноническое представление полезной нагрузки — без временных меток и ссылок на запуски. */
export function canonicalPayload(p: InsightPayload): string {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o).sort()) {
        // окна сдвигаются каждый день — сами по себе они не «новые данные»; факт меняется через числа
        if (
          k === 'freshness' ||
          k === 'generatedAt' ||
          k === 'period' ||
          k === 'baselinePeriod'
        )
          continue;
        out[k] = strip(o[k]);
      }
      return out;
    }
    if (typeof v === 'number') return Math.round(v * 1e6) / 1e6;
    return v;
  };
  const clone = JSON.parse(JSON.stringify(p)) as InsightPayload;
  clone.evidence.refs = clone.evidence.refs.filter(
    (r) => r.kind !== 'sync_run',
  );
  return JSON.stringify(strip(clone));
}

export function payloadHash(p: InsightPayload): string {
  return createHash('sha1').update(canonicalPayload(p)).digest('hex');
}

const scopeOf = (key: GrowthMetricKey): InsightScope => {
  const s = GROWTH_METRICS[key].scope;
  return s === 'pnl' ? 'money' : s === 'crm' ? 'crm' : 'site';
};

function fact(
  text: string,
  m: MetricEvaluation | null,
  windows: EvaluationWindows,
  extra?: Partial<InsightFact>,
): InsightFact {
  return {
    text,
    metric: m?.metric ?? null,
    unit: m ? unitOf(m) : null,
    current: m?.after.value ?? null,
    baseline: m?.before.value ?? null,
    absoluteDelta: m?.statistics?.absoluteDifference ?? null,
    relativeDelta: m?.statistics?.relativeDifference ?? null,
    sample: {
      current: m?.after.sample ?? null,
      baseline: m?.before.sample ?? null,
      minimum: null,
    },
    period: windows.after,
    baselinePeriod: windows.before,
    ...extra,
  };
}

function unitOf(m: MetricEvaluation): InsightFact['unit'] {
  switch (m.unit) {
    case 'percent':
      return 'percent';
    case 'rub':
      return 'rub';
    case 'orders':
      return 'orders';
    case 'events':
      return 'events';
    default:
      return 'visits';
  }
}

const noHypothesis: InsightHypothesis = {
  status: 'NO_SUPPORTED_HYPOTHESIS',
  text: NO_HYPOTHESIS_TEXT,
  supportingFacts: [],
};

function hypothesis(body: string, facts: string[]): InsightHypothesis {
  return {
    status: 'SUPPORTED_BY_CONCURRENT_FACTS',
    text: hypothesisText(body),
    supportingFacts: facts,
  };
}

function evidence(
  detectorId: string,
  thresholds: Record<string, number>,
  m: MetricEvaluation | null,
  ctx: InsightContext,
  strength: InsightEvidence['statisticalStrength'],
  materiality: InsightEvidence['businessMateriality'],
  refs: InsightEvidence['refs'] = [],
  contextKeys: GrowthMetricKey[] = [],
): InsightEvidence {
  return {
    statisticalStrength: strength,
    businessMateriality: materiality,
    metricEvaluation: m,
    verdict: m?.verdict ?? null,
    context: contextKeys.map((k) => ({
      metric: k,
      before: ctx.metrics[k].before.value,
      after: ctx.metrics[k].after.value,
      unit: ctx.metrics[k].unit,
    })),
    confounders: ctx.confounders,
    refs: [
      ...refs,
      ...(ctx.lastSyncRunId
        ? [
            {
              kind: 'sync_run' as const,
              id: ctx.lastSyncRunId,
              label: 'последний тик синхронизации',
            },
          ]
        : []),
    ],
    rule: { detectorId, thresholds },
  };
}

function limitationsFrom(
  m: MetricEvaluation | null,
  ctx: InsightContext,
): LimitationCode[] {
  const out = new Set<LimitationCode>();
  for (const f of m?.flags ?? []) out.add(f);
  for (const c of ctx.confounders) {
    if (c.code === 'OVERLAPPING_CHANGE') out.add('OVERLAPPING_CHANGE');
    if (c.code === 'ANALYTICS_STALE') out.add('ANALYTICS_STALE');
  }
  if (periodTouchesIncident(ctx.windows)) out.add('INCIDENT_BOUNDARY');
  return [...out].sort();
}

/** Пересекает ли сравнение известную границу инцидента (единый контракт дат, не hardcode по детекторам). */
export function periodTouchesIncident(windows: EvaluationWindows): boolean {
  const inc = DATA_BOUNDARIES.incident;
  if (!inc) return false;
  const from =
    new Date(`${windows.before.from}T00:00:00.000Z`).getTime() - 3 * 3600e3;
  const to =
    new Date(`${windows.after.to}T00:00:00.000Z`).getTime() + 21 * 3600e3;
  return new Date(inc.from).getTime() < to && new Date(inc.to).getTime() > from;
}

function build(
  d: InsightDetector,
  ctx: InsightContext,
  p: {
    severity: InsightSeverity;
    scope: InsightScope;
    metricKey: string | null;
    entityKey: string | null;
    title: string;
    fact: InsightFact;
    hypothesis: InsightHypothesis;
    recommendation: InsightRecommendation;
    evidence: InsightEvidence;
    limitations: LimitationCode[];
    link: InsightPayload['link'];
    notes?: string[];
  },
): DetectedInsight {
  const payload: InsightPayload = {
    category: d.category,
    severity: p.severity,
    scope: p.scope,
    source: d.source,
    detectorId: d.id,
    metricKey: p.metricKey,
    entityKey: p.entityKey,
    title: p.title,
    fact: p.fact,
    hypothesis: p.hypothesis,
    recommendation: p.recommendation,
    evidence: p.evidence,
    limitations: p.limitations,
    quality: {
      freshness: ctx.freshness.status,
      flags: p.evidence.metricEvaluation?.flags ?? [],
      notes: [DISCLAIMER, ...(p.notes ?? [])],
    },
    causality: 'NOT_ESTABLISHED',
    link: p.link,
    engineVersion: INSIGHT_ENGINE_VERSION,
  };
  for (const text of [
    payload.title,
    payload.fact.text,
    payload.hypothesis.text ?? '',
    payload.recommendation.text,
  ]) {
    const bad = violatesLanguagePolicy(text);
    if (bad)
      throw new Error(
        `Языковая политика: запрещённая формулировка «${bad}» в детекторе ${d.id}`,
      );
  }
  return {
    fingerprint: fingerprintOf(d.category, d.id, p.metricKey, p.entityKey),
    payload,
  };
}

function suppress(
  d: InsightDetector,
  metricKey: string | null,
  entityKey: string | null,
  reason: SuppressionReason,
  detail: string,
  sample: number | null,
): SuppressedResult {
  return {
    detectorId: d.id,
    category: d.category,
    metricKey,
    entityKey,
    reason,
    detail,
    sample,
  };
}

/** Вердикт этапа 11 → причина молчания детектора (если сигнала нет). */
function suppressionFromVerdict(m: MetricEvaluation): SuppressionReason | null {
  switch (m.verdict) {
    case 'INCOMPARABLE':
      return m.flags.includes('MEASUREMENT_DEFINITION_CHANGED')
        ? 'MEASUREMENT_DEFINITION_CHANGED'
        : m.flags.includes('METRIC_UNAVAILABLE_BEFORE') ||
            m.flags.includes('METRIC_UNAVAILABLE_AFTER')
          ? 'METRIC_NOT_AVAILABLE'
          : 'INCOMPARABLE_PERIODS';
    case 'IMMATURE':
      return 'IMMATURE';
    case 'INSUFFICIENT_DATA':
      if (m.flags.includes('MATCHED_COVERAGE_LOW'))
        return 'MATCHED_COVERAGE_LOW';
      if (m.flags.includes('COGS_INCOMPLETE')) return 'COGS_INCOMPLETE';
      if (
        m.flags.includes('LOW_SAMPLE') ||
        m.flags.includes('ZERO_DENOMINATOR')
      )
        return 'LOW_SAMPLE';
      return 'INSUFFICIENT_DATA';
    case 'NO_CLEAR_CHANGE':
      return 'NO_MATERIAL_CHANGE';
    default:
      return null;
  }
}

function suppressionDetail(
  m: MetricEvaluation,
  windows: EvaluationWindows,
): string {
  const s = m.statistics;
  const parts = [
    `${m.label}: ${valueText(m, m.before)} → ${valueText(m, m.after)} за ${windows.days} дн.`,
    `вердикт этапа 11 — ${m.verdict}`,
  ];
  if (m.verdict === 'IMMATURE')
    parts.push(`созревание до ${fmtDateIso(m.maturity.maturityUntil)}`);
  if (s?.mde?.relative !== null && s?.mde?.relative !== undefined)
    parts.push(`MDE ±${s.mde.relative.toFixed(0)} % от базы`);
  if (s?.requiredSample)
    parts.push(
      `для 20 % нужно ≈ ${fmtInt(s.requiredSample.perWindow)} на окно`,
    );
  return parts.join('; ');
}

const fmtNum = (v: number | null): string =>
  v === null ? '—' : (Math.round(v * 100) / 100).toString().replace('.', ',');
const fmtDateIso = (iso: string) =>
  `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

export function valueText(m: MetricEvaluation, v: MetricValue): string {
  if (m.kind === 'ratio')
    return `${fmtPct(v.value)} (${fmtInt(v.numerator)} из ${fmtInt(v.denominator)})`;
  if (m.unit === 'rub') return fmtRub(v.value);
  return fmtInt(v.value);
}

/** Деловая существенность по виду метрики — отдельно от статистики. */
export function materialityOf(
  m: MetricEvaluation,
): InsightEvidence['businessMateriality'] {
  const s = m.statistics;
  if (!s || s.absoluteDifference === null) return 'NONE';
  const abs = Math.abs(s.absoluteDifference);
  const rel =
    s.relativeDifference === null ? null : Math.abs(s.relativeDifference) / 100;
  if (m.kind === 'ratio')
    return abs >= MATERIAL_RATE_POINTS ? 'MATERIAL' : abs > 0 ? 'LOW' : 'NONE';
  if (m.unit === 'rub')
    return abs >= MATERIAL_MONEY_RUB && (rel ?? 0) >= MATERIAL_MONEY_RELATIVE
      ? 'MATERIAL'
      : abs > 0
        ? 'LOW'
        : 'NONE';
  // счётчики и средние
  return abs >= MATERIAL_COUNT_ABSOLUTE && (rel ?? 0) >= MATERIAL_COUNT_RELATIVE
    ? 'MATERIAL'
    : abs > 0
      ? 'LOW'
      : 'NONE';
}

/** Знак изменения относительно полярности метрики: −1 — хуже, +1 — лучше, 0 — нейтрально. */
export function harmSign(m: MetricEvaluation): -1 | 0 | 1 {
  const diff = m.statistics?.absoluteDifference ?? 0;
  const pol =
    INSIGHT_POLARITY_OVERRIDES[m.metric] ?? GROWTH_METRICS[m.metric].polarity;
  if (diff === 0 || pol === 'neutral') return 0;
  const good = pol === 'higher-good' ? 1 : -1;
  return Math.sign(diff) === good ? 1 : -1;
}

// ---------------------------------------------------------------------------
// Гипотезы V1 — только rule-based, только из сопутствующих фактов

function conversionHypothesis(ctx: InsightContext): InsightHypothesis {
  const facts: string[] = [];
  const parts: string[] = [];
  const dev = ctx.confounders.find((c) => c.code === 'DEVICE_MIX_SHIFT');
  if (dev) {
    parts.push(
      'сдвиг структуры устройств может быть одним из факторов наблюдаемой разницы',
    );
    facts.push(dev.fact);
  }
  const err = ctx.metrics.formErrorRate;
  if (
    err.verdict === 'NEGATIVE_SIGNAL' ||
    ((err.statistics?.absoluteDifference ?? 0) >= MATERIAL_RATE_POINTS &&
      (err.after.numerator ?? 0) >= MATERIAL_ERROR_VISITS)
  ) {
    parts.push(
      'рост ошибок формы совпал по времени со снижением завершения формы — техническое состояние формы стоит проверить',
    );
    facts.push(
      `Доля визитов с ошибкой формы: ${fmtPct(err.before.value)} → ${fmtPct(err.after.value)} (визитов с ошибкой ${fmtInt(err.after.numerator)})`,
    );
  }
  const src = ctx.confounders.find((c) => c.code === 'SOURCE_MIX_SHIFT');
  if (src) {
    parts.push(
      'одновременно изменилась структура источников трафика — сравнение окон может отражать смену аудитории',
    );
    facts.push(src.fact);
  }
  const ov = ctx.confounders.find((c) => c.code === 'OVERLAPPING_CHANGE');
  if (ov) {
    parts.push(
      'в окне действовали зарегистрированные изменения — разницу нельзя приписать одному из них',
    );
    facts.push(ov.fact);
  }
  if (!parts.length) return noHypothesis;
  return hypothesis(parts.join('; '), facts);
}

function trafficHypothesis(ctx: InsightContext): InsightHypothesis {
  const facts: string[] = [];
  const parts: string[] = [];
  const src = ctx.confounders.find((c) => c.code === 'SOURCE_MIX_SHIFT');
  if (src) {
    parts.push('изменение визитов совпало со сдвигом долей источников');
    facts.push(src.fact);
  }
  const s = ctx.slices.sources;
  if (s) {
    const before = new Map(
      s.before.rows.map((r) => [
        r.trafficSourceName || r.trafficSource,
        r.visits,
      ]),
    );
    for (const [name, v] of before) {
      const after =
        s.after.rows.find(
          (r) => (r.trafficSourceName || r.trafficSource) === name,
        )?.visits ?? 0;
      if (v >= MIN_ENTITY_VISITS && after <= v * 0.5) {
        parts.push(`визиты источника «${name}» снизились более чем вдвое`);
        facts.push(`«${name}»: ${fmtInt(v)} → ${fmtInt(after)} визитов`);
      }
    }
  }
  if (!parts.length) return noHypothesis;
  return hypothesis(parts.join('; '), facts);
}

function profitHypothesis(ctx: InsightContext): InsightHypothesis {
  const orders = ctx.metrics.acceptedOrders;
  const rel = orders.statistics?.relativeDifference;
  const stable =
    rel !== null &&
    rel !== undefined &&
    Math.abs(rel) < MATERIAL_COUNT_RELATIVE * 100;
  const cogsOk = !ctx.metrics.netProfit.flags.includes('COGS_INCOMPLETE');
  if (stable && cogsOk)
    return hypothesis(
      'при сопоставимом объёме заказов изменилась прибыль — стоит проверить структуру выручки и затрат',
      [
        `Принятых заказов: ${fmtInt(orders.before.value)} → ${fmtInt(orders.after.value)}${fmtRel(rel ?? null)}`,
      ],
    );
  return noHypothesis;
}

// ---------------------------------------------------------------------------
// Рекомендации V1 — rule-based, по evidence

const rec = (
  text: string,
  kind: InsightRecommendation['kind'],
): InsightRecommendation => ({ text, kind });

function recForMetric(
  m: MetricEvaluation,
  h: InsightHypothesis,
  ctx: InsightContext,
): InsightRecommendation {
  if (ctx.confounders.some((c) => c.code === 'OVERLAPPING_CHANGE'))
    return rec(
      'Не делать вывода об эффекте до чистого окна без пересекающихся изменений; оценивать конкретное изменение — через «Рост / Изменения».',
      'OBSERVE',
    );
  if (h.status === 'SUPPORTED_BY_CONCURRENT_FACTS' && /ошиб/.test(h.text ?? ''))
    return rec(
      'Технически проверить форму и логи приложения за период; сравнить ошибки по устройствам и полям во вкладке «Поведение».',
      'CHECK_TECHNICAL',
    );
  if (
    h.status === 'SUPPORTED_BY_CONCURRENT_FACTS' &&
    /устройств/.test(h.text ?? '')
  )
    return rec(
      'Вручную пройти путь до заявки на проблемном устройстве и сравнить конверсию устройств во вкладке «Поведение».',
      'CHECK_MANUALLY',
    );
  if (
    h.status === 'SUPPORTED_BY_CONCURRENT_FACTS' &&
    /источник/.test(h.text ?? '')
  )
    return rec(
      'Сравнить источник с наибольшим сдвигом по визитам и доле заявок во вкладке «Источники»; выводы по конверсии — только внутри одного источника.',
      'COMPARE_SEGMENT',
    );
  if (m.scope === 'crm' || m.scope === 'pnl')
    return rec(
      'Проверить вклад каналов (сайт, Avito, мессенджеры) и категорий товара; итоги CRM не приписывать изменениям сайта без оценки в «Рост / Изменения».',
      'CHECK_MANUALLY',
    );
  return rec(
    'Наблюдать метрику в следующем окне; перед следующей правкой сайта зарегистрировать изменение в «Рост / Изменения».',
    'OBSERVE',
  );
}

// ---------------------------------------------------------------------------
// Детекторы изменения метрик (через оценки этапа 11)

function metricChangeDetector(opts: {
  id: string;
  category: InsightCategory;
  key: GrowthMetricKey;
  title: (m: MetricEvaluation) => string;
  hypothesis: (ctx: InsightContext) => InsightHypothesis;
  link: InsightPayload['link'];
  contextKeys: GrowthMetricKey[];
  /** Дополнительное правило CRITICAL — только для ограниченного набора ситуаций. */
  critical?: (ctx: InsightContext) => { title: string; text: string } | null;
  extraLimitations?: LimitationCode[];
}): InsightDetector {
  const d: InsightDetector = {
    id: opts.id,
    category: opts.category,
    refresh: 'daily',
    source: 'STAGE12_DETECTOR',
    evaluate(ctx) {
      const m = ctx.metrics[opts.key];
      const w = ctx.windows;
      const thresholds = {
        minSampleVisits: MIN_ENTITY_VISITS,
        minEvents: MIN_EVENTS,
        materialRatePoints: MATERIAL_RATE_POINTS,
        materialCountRelative: MATERIAL_COUNT_RELATIVE,
        materialCountAbsolute: MATERIAL_COUNT_ABSOLUTE,
        materialMoneyRub: MATERIAL_MONEY_RUB,
      };
      const crit = opts.critical?.(ctx) ?? null;
      if (crit) {
        return {
          detected: [
            build(d, ctx, {
              severity: 'CRITICAL',
              scope: scopeOf(opts.key),
              metricKey: opts.key,
              entityKey: null,
              title: crit.title,
              fact: fact(crit.text, m, w),
              hypothesis: noHypothesis,
              recommendation: rec(
                'Срочно проверить работу форм и отправку событий сайта (событие lead_submitted / form_started) и логи приложения; сравнить с предыдущим окном.',
                'CHECK_TECHNICAL',
              ),
              evidence: evidence(
                d.id,
                thresholds,
                m,
                ctx,
                'SIGNAL',
                'MATERIAL',
                [],
                opts.contextKeys,
              ),
              limitations: [
                ...limitationsFrom(m, ctx),
                ...(opts.extraLimitations ?? []),
              ],
              link: opts.link,
            }),
          ],
          suppressed: [],
        };
      }
      const reason = suppressionFromVerdict(m);
      if (reason)
        return {
          detected: [],
          suppressed: [
            suppress(
              d,
              opts.key,
              null,
              reason,
              suppressionDetail(m, w),
              m.after.sample,
            ),
          ],
        };
      // сигнал этапа 11 есть — существенность отдельно
      const materiality = materialityOf(m);
      if (materiality !== 'MATERIAL')
        return {
          detected: [],
          suppressed: [
            suppress(
              d,
              opts.key,
              null,
              'NO_MATERIAL_CHANGE',
              `${suppressionDetail(m, w)}; изменение статистически заметно, но ниже порога существенности`,
              m.after.sample,
            ),
          ],
        };
      const harm = harmSign(m);
      const severity: InsightSeverity = harm < 0 ? 'ATTENTION' : 'INFO';
      const h = opts.hypothesis(ctx);
      const s = m.statistics;
      const text =
        `${m.label}: за ${fmtPeriod(w.after)} ${valueText(m, m.after)}, в предыдущем сопоставимом окне (${fmtPeriod(w.before)}) ${valueText(m, m.before)}; ` +
        `разница ${m.kind === 'ratio' ? fmtPoints(s?.absoluteDifference ?? null) : fmtSigned(s?.absoluteDifference ?? null, m.unit === 'rub' ? '₽' : '')}${fmtRel(s?.relativeDifference ?? null)}` +
        (s?.pValue !== null && s?.pValue !== undefined
          ? `; p = ${s.pValue.toFixed(3).replace('.', ',')}`
          : '') +
        (s?.mde?.relative !== null && s?.mde?.relative !== undefined
          ? `; при текущем объёме заметен эффект от ±${s.mde.relative.toFixed(0)} % базы`
          : '') +
        '.';
      return {
        detected: [
          build(d, ctx, {
            severity,
            scope: scopeOf(opts.key),
            metricKey: opts.key,
            entityKey: null,
            title: opts.title(m),
            fact: fact(text, m, w),
            hypothesis: h,
            recommendation: recForMetric(m, h, ctx),
            evidence: evidence(
              d.id,
              thresholds,
              m,
              ctx,
              'SIGNAL',
              materiality,
              [],
              opts.contextKeys,
            ),
            limitations: [
              ...limitationsFrom(m, ctx),
              ...(opts.extraLimitations ?? []),
            ],
            link: opts.link,
          }),
        ],
        suppressed: [],
      };
    },
  };
  return d;
}

const dir = (m: MetricEvaluation) =>
  (m.statistics?.absoluteDifference ?? 0) < 0 ? 'снизилась' : 'выросла';
const dirCount = (m: MetricEvaluation) =>
  (m.statistics?.absoluteDifference ?? 0) < 0 ? 'снизились' : 'выросли';

export const trafficDetector = metricChangeDetector({
  id: 'traffic.visits',
  category: 'TRAFFIC_CHANGE',
  key: 'visits',
  title: (m) =>
    `Визиты ${dirCount(m)}: ${fmtInt(m.before.value)} → ${fmtInt(m.after.value)} за 7 дней`,
  hypothesis: trafficHypothesis,
  link: { tab: 'overview' },
  contextKeys: ['siteLeads', 'siteLeadRate'],
});

export const siteLeadRateDetector = metricChangeDetector({
  id: 'site.leadRate',
  category: 'SITE_CONVERSION_CHANGE',
  key: 'siteLeadRate',
  title: (m) =>
    `Конверсия визитов в заявку ${dir(m)}: ${fmtPct(m.before.value)} → ${fmtPct(m.after.value)}`,
  hypothesis: conversionHypothesis,
  link: { tab: 'behavior' },
  contextKeys: ['visits', 'siteLeads', 'formStarts', 'formErrorRate'],
  critical: (ctx) => {
    const leads = ctx.metrics.siteLeads;
    const visits = ctx.metrics.visits;
    if (!leads.comparability.comparable) return null;
    if (
      (leads.after.value ?? 0) === 0 &&
      (visits.after.value ?? 0) >= CRITICAL_LEADS_VANISHED_MIN_VISITS &&
      (leads.before.value ?? 0) >= CRITICAL_LEADS_VANISHED_BASELINE_LEADS
    )
      return {
        title: 'Заявки с сайта исчезли при сохранившемся трафике',
        text: `За ${fmtPeriod(ctx.windows.after)} заявок с сайта 0 при ${fmtInt(visits.after.value)} визитах; в предыдущем окне — ${fmtInt(leads.before.value)} заявок при ${fmtInt(visits.before.value)} визитах.`,
      };
    return null;
  },
});

export const formStartRateDetector = metricChangeDetector({
  id: 'site.formStartRate',
  category: 'FUNNEL_DROPOFF',
  key: 'formStartRate',
  title: (m) =>
    `Доля визитов с началом формы ${dir(m)}: ${fmtPct(m.before.value)} → ${fmtPct(m.after.value)}`,
  hypothesis: conversionHypothesis,
  link: { tab: 'behavior' },
  contextKeys: ['visits', 'formStarts', 'siteLeads'],
  critical: (ctx) => {
    const starts = ctx.metrics.formStarts;
    const visits = ctx.metrics.visits;
    if (!starts.comparability.comparable) return null;
    if (
      (starts.after.value ?? 0) === 0 &&
      (visits.after.value ?? 0) >= CRITICAL_FUNNEL_BREAK_MIN_VISITS &&
      (starts.before.value ?? 0) >= CRITICAL_FUNNEL_BREAK_BASELINE_STARTS
    )
      return {
        title: 'Обрыв воронки: формы не начинаются при сохранившемся трафике',
        text: `За ${fmtPeriod(ctx.windows.after)} начатых форм 0 при ${fmtInt(visits.after.value)} визитах; в предыдущем окне — ${fmtInt(starts.before.value)} при ${fmtInt(visits.before.value)} визитах.`,
      };
    return null;
  },
});

export const formErrorRateDetector: InsightDetector = {
  id: 'site.formErrorRate',
  category: 'FORM_ERROR_CHANGE',
  refresh: 'daily',
  source: 'STAGE12_DETECTOR',
  evaluate(ctx) {
    const d = formErrorRateDetector;
    const m = ctx.metrics.formErrorRate;
    const w = ctx.windows;
    const thresholds = {
      materialErrorVisits: MATERIAL_ERROR_VISITS,
      criticalFormErrorVisits: CRITICAL_FORM_ERROR_VISITS,
      materialRatePoints: MATERIAL_RATE_POINTS,
    };
    const reason = suppressionFromVerdict(m);
    if (reason)
      return {
        detected: [],
        suppressed: [
          suppress(
            d,
            'formErrorRate',
            null,
            reason,
            suppressionDetail(m, w),
            m.after.sample,
          ),
        ],
      };
    const affected = m.after.numerator ?? 0;
    const rising = (m.statistics?.absoluteDifference ?? 0) > 0;
    if (!rising || affected < MATERIAL_ERROR_VISITS)
      return {
        detected: [],
        suppressed: [
          suppress(
            d,
            'formErrorRate',
            null,
            'NO_MATERIAL_CHANGE',
            `${suppressionDetail(m, w)}; затронуто визитов ${affected} (порог ${MATERIAL_ERROR_VISITS})`,
            m.after.sample,
          ),
        ],
      };
    const severity: InsightSeverity =
      affected >= CRITICAL_FORM_ERROR_VISITS ? 'CRITICAL' : 'ATTENTION';
    const text = `Доля визитов с ошибкой формы: за ${fmtPeriod(w.after)} ${fmtPct(m.after.value)} (${fmtInt(affected)} из ${fmtInt(m.after.denominator)} начавших форму), в предыдущем окне ${fmtPct(m.before.value)} (${fmtInt(m.before.numerator)} из ${fmtInt(m.before.denominator)}); разница ${fmtPoints(m.statistics?.absoluteDifference ?? null)}${m.statistics?.pValue !== null && m.statistics?.pValue !== undefined ? `; p = ${m.statistics.pValue.toFixed(3).replace('.', ',')}` : ''}.`;
    const lead = ctx.metrics.siteLeadRate;
    const h =
      (lead.statistics?.absoluteDifference ?? 0) < 0
        ? hypothesis(
            'рост ошибок формы совпал по времени со снижением завершения формы — техническое состояние формы стоит проверить',
            [
              `Конверсия визитов в заявку: ${fmtPct(lead.before.value)} → ${fmtPct(lead.after.value)}`,
            ],
          )
        : noHypothesis;
    return {
      detected: [
        build(d, ctx, {
          severity,
          scope: 'site',
          metricKey: 'formErrorRate',
          entityKey: null,
          title: `Ошибки формы выросли: ${fmtPct(m.before.value)} → ${fmtPct(m.after.value)} визитов с ошибкой`,
          fact: fact(text, m, w),
          hypothesis: h,
          recommendation: rec(
            'Технически проверить форму и логи приложения за период; во вкладке «Поведение» посмотреть ошибки по полям и устройствам.',
            'CHECK_TECHNICAL',
          ),
          evidence: evidence(
            d.id,
            thresholds,
            m,
            ctx,
            'SIGNAL',
            'MATERIAL',
            [],
            ['formStarts', 'siteLeadRate'],
          ),
          limitations: limitationsFrom(m, ctx),
          link: { tab: 'behavior' },
        }),
      ],
      suppressed: [],
    };
  },
};

export const crmLeadToAcceptedDetector = metricChangeDetector({
  id: 'crm.leadToAccepted',
  category: 'CRM_CONVERSION_CHANGE',
  key: 'leadToAcceptedRate',
  title: (m) =>
    `Заявка → принят (когорта CRM) ${dir(m)}: ${fmtPct(m.before.value)} → ${fmtPct(m.after.value)}`,
  hypothesis: () => noHypothesis,
  link: { tab: 'overview' },
  contextKeys: ['crmLeads', 'acceptedOrders'],
  extraLimitations: ['CRM_INCLUDES_OFFLINE'],
});

export const crmLeadToPaidDetector = metricChangeDetector({
  id: 'crm.leadToPaid',
  category: 'CRM_CONVERSION_CHANGE',
  key: 'leadToPaidRate',
  title: (m) =>
    `Заявка → оплата (когорта CRM) ${dir(m)}: ${fmtPct(m.before.value)} → ${fmtPct(m.after.value)}`,
  hypothesis: () => noHypothesis,
  link: { tab: 'overview' },
  contextKeys: ['crmLeads', 'paidOrders'],
  extraLimitations: ['CRM_INCLUDES_OFFLINE'],
});

export const revenueDetector = metricChangeDetector({
  id: 'money.realizedRevenue',
  category: 'REVENUE_CHANGE',
  key: 'realizedRevenue',
  title: (m) =>
    `Реализованная выручка ${dir(m)}: ${fmtRub(m.before.value)} → ${fmtRub(m.after.value)}`,
  hypothesis: () => noHypothesis,
  link: { tab: 'overview' },
  contextKeys: ['acceptedOrders', 'paidOrders'],
  extraLimitations: ['CRM_INCLUDES_OFFLINE', 'DESCRIPTIVE_ONLY'],
});

export const profitDetector = metricChangeDetector({
  id: 'money.netProfit',
  category: 'PROFIT_CHANGE',
  key: 'netProfit',
  title: (m) =>
    `Чистая прибыль ${dir(m)}: ${fmtRub(m.before.value)} → ${fmtRub(m.after.value)}`,
  hypothesis: profitHypothesis,
  link: { tab: 'overview' },
  contextKeys: ['realizedRevenue', 'acceptedOrders'],
  extraLimitations: ['CRM_INCLUDES_OFFLINE', 'DESCRIPTIVE_ONLY'],
});

// ---------------------------------------------------------------------------
// Правила этапа 10 — зеркало, не пересчёт

const STAGE10_CATEGORY: Record<BehaviorIssue['rule'], InsightCategory> = {
  FUNNEL_DROPOFF: 'FUNNEL_DROPOFF',
  DEVICE_GAP: 'DEVICE_GAP',
  FORM_ERROR_SPIKE: 'FORM_ERROR_CHANGE',
  LANDING_UNDERPERFORMANCE: 'LANDING_CHANGE',
  LEAD_RATE_ANOMALY: 'SITE_CONVERSION_CHANGE',
};

export const stage10Detector: InsightDetector = {
  id: 'stage10.issues',
  category: 'DEVICE_GAP',
  refresh: 'daily',
  source: 'STAGE10_RULE',
  evaluate(ctx) {
    const b = ctx.behavior;
    if (!b) return { detected: [], suppressed: [] };
    const detected: DetectedInsight[] = [];
    const suppressed: SuppressedResult[] = [];
    for (const issue of b.issues.issues) {
      const category = STAGE10_CATEGORY[issue.rule];
      const d: InsightDetector = { ...stage10Detector, category };
      const sampleEv = issue.evidence[0];
      detected.push(
        build(d, ctx, {
          severity: issue.severity,
          scope: 'site',
          metricKey: issue.rule,
          entityKey: `${issue.scope.kind}:${issue.scope.key}`,
          title: issue.title,
          fact: {
            text: issue.fact,
            metric: sampleEv?.metric ?? null,
            unit: sampleEv
              ? sampleEv.unit === 'percent'
                ? 'percent'
                : sampleEv.unit === 'ratio'
                  ? 'ratio'
                  : sampleEv.unit
              : null,
            current: sampleEv?.current ?? null,
            baseline: sampleEv?.baseline ?? null,
            absoluteDelta:
              sampleEv &&
              sampleEv.current !== null &&
              sampleEv.baseline !== null
                ? sampleEv.current - sampleEv.baseline
                : null,
            relativeDelta: null,
            sample: {
              current: sampleEv?.sample ?? null,
              baseline: null,
              minimum: sampleEv?.minSample ?? null,
            },
            period: b.issues.period,
            baselinePeriod: b.issues.previousPeriod,
          },
          hypothesis: hypothesis(
            issue.hypothesis.replace(/^Гипотеза:\s*/i, '').replace(/\.$/, ''),
            issue.evidence.map(
              (e) =>
                `${e.metric}: ${fmtNum(e.current)} (база ${fmtNum(e.baseline)}, выборка ${e.sample} ≥ ${e.minSample})`,
            ),
          ),
          recommendation: rec(issue.recommendation, 'CHECK_MANUALLY'),
          evidence: evidence(
            d.id,
            b.issues.thresholds,
            null,
            ctx,
            'SIGNAL',
            'MATERIAL',
            [
              {
                kind: 'stage10_issue',
                id: issue.id,
                label: `правило этапа 10 ${issue.rule}`,
              },
            ],
          ),
          limitations: [
            'STAGE10_RULE_MIRROR',
            ...(periodTouchesIncident(ctx.windows)
              ? (['INCIDENT_BOUNDARY'] as LimitationCode[])
              : []),
          ],
          link: { tab: 'behavior' },
          notes: [
            'Сигнал вычислен правилом этапа 10 («Требует внимания») и показан здесь без пересчёта.',
          ],
        }),
      );
    }
    for (const sk of b.issues.skipped) {
      const category = STAGE10_CATEGORY[sk.rule];
      const reason: SuppressionReason =
        sk.code === 'PARTIAL_BEHAVIOR_PERIOD'
          ? 'PARTIAL_BEHAVIOR_PERIOD'
          : sk.code === 'LOW_SAMPLE'
            ? 'LOW_SAMPLE'
            : sk.code === 'NO_LEADS'
              ? 'INSUFFICIENT_DATA'
              : 'INCOMPARABLE_PERIODS';
      suppressed.push({
        detectorId: stage10Detector.id,
        category,
        metricKey: sk.rule,
        entityKey: null,
        reason,
        detail: sk.reason,
        sample: null,
      });
    }
    return { detected, suppressed };
  },
};

// ---------------------------------------------------------------------------
// Источники / страницы входа / товары

export const sourceMixDetector: InsightDetector = {
  id: 'source.mixShift',
  category: 'SOURCE_MIX_SHIFT',
  refresh: 'daily',
  source: 'STAGE12_DETECTOR',
  evaluate(ctx) {
    const d = sourceMixDetector;
    const c = ctx.confounders.find((x) => x.code === 'SOURCE_MIX_SHIFT');
    if (!c)
      return {
        detected: [],
        suppressed: [
          suppress(
            d,
            null,
            null,
            'NO_MATERIAL_CHANGE',
            `сдвиг долей источников меньше ${MIX_SHIFT_POINTS} п.п.`,
            ctx.metrics.visits.after.sample,
          ),
        ],
      };
    const top = (c.shares ?? [])
      .map((s) => ({ ...s, delta: (s.after ?? 0) - (s.before ?? 0) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    return {
      detected: [
        build(d, ctx, {
          severity: 'INFO',
          scope: 'site',
          metricKey: 'sourceShare',
          entityKey: top ? top.key : null,
          title: top
            ? `Структура источников сдвинулась: «${top.key}» ${fmtPct(top.before)} → ${fmtPct(top.after)} визитов`
            : 'Структура источников трафика сдвинулась',
          fact: {
            ...fact(c.fact, null, ctx.windows),
            metric: 'sourceShare',
            unit: 'percent',
            current: top?.after ?? null,
            baseline: top?.before ?? null,
            absoluteDelta: top?.delta ?? null,
            sample: {
              current: ctx.metrics.visits.after.sample,
              baseline: ctx.metrics.visits.before.sample,
              minimum: MIN_ENTITY_VISITS,
            },
          },
          hypothesis: noHypothesis,
          recommendation: rec(
            'Сравнить источник с наибольшим сдвигом и качество его трафика во вкладке «Источники»; общие доли конверсии между окнами могут отражать смену аудитории, а не правку сайта.',
            'COMPARE_SEGMENT',
          ),
          evidence: evidence(
            d.id,
            { mixShiftPoints: MIX_SHIFT_POINTS },
            null,
            ctx,
            'NONE',
            'MATERIAL',
            [],
            ['visits', 'siteLeadRate'],
          ),
          limitations: [
            'DESCRIPTIVE_ONLY',
            ...(periodTouchesIncident(ctx.windows)
              ? (['INCIDENT_BOUNDARY'] as LimitationCode[])
              : []),
          ],
          link: { tab: 'sources' },
        }),
      ],
      suppressed: [],
    };
  },
};

interface EntityRow {
  key: string;
  label: string;
  visits: number;
  leads: number;
}

function entityChangeDetector(opts: {
  id: string;
  category: InsightCategory;
  metricLabel: string;
  rows: (
    ctx: InsightContext,
  ) => { before: EntityRow[]; after: EntityRow[] } | null;
  link: InsightPayload['link'];
  entityWord: string;
}): InsightDetector {
  const d: InsightDetector = {
    id: opts.id,
    category: opts.category,
    refresh: 'daily',
    source: 'STAGE12_DETECTOR',
    evaluate(ctx) {
      const rows = opts.rows(ctx);
      if (!rows) return { detected: [], suppressed: [] };
      const detected: DetectedInsight[] = [];
      const suppressed: SuppressedResult[] = [];
      const keys = new Set([
        ...rows.before.map((r) => r.key),
        ...rows.after.map((r) => r.key),
      ]);
      const days = ctx.windows.days;
      const leadDef = GROWTH_METRICS.siteLeadRate;
      const leadComparable = ctx.metrics.siteLeadRate.comparability.comparable;
      for (const key of [...keys].sort()) {
        const b = rows.before.find((r) => r.key === key) ?? {
          key,
          label: key,
          visits: 0,
          leads: 0,
        };
        const a = rows.after.find((r) => r.key === key) ?? {
          key,
          label: key,
          visits: 0,
          leads: 0,
        };
        const label = a.label || b.label || key;
        if (Math.max(a.visits, b.visits) < MIN_ENTITY_VISITS) {
          suppressed.push(
            suppress(
              d,
              'visits',
              key,
              'LOW_SAMPLE',
              `${opts.entityWord} «${label}»: визитов ${b.visits} → ${a.visits}, порог ${MIN_ENTITY_VISITS}`,
              a.visits,
            ),
          );
          continue;
        }
        // визиты — пуассоновское сравнение этапа 11
        const pr = poissonRateComparison(b.visits, days, a.visits, days);
        const relCi = pr.ci;
        const visitsSignal =
          pr.pValue !== null &&
          pr.pValue < STAT_ASSUMPTIONS.alpha &&
          relCi !== null &&
          (relCi.low > 1 || relCi.high < 1);
        const absV = a.visits - b.visits;
        const relV = b.visits ? absV / b.visits : null;
        const materialV =
          Math.abs(absV) >= MATERIAL_COUNT_ABSOLUTE &&
          (relV === null || Math.abs(relV) >= MATERIAL_COUNT_RELATIVE);
        // доля заявок внутри сущности — статистика долей этапа 11 (только если определение метрики сопоставимо)
        let leadStats = null as ReturnType<typeof computeStatistics> | null;
        let leadSignal = false;
        if (
          leadComparable &&
          b.visits >= MIN_ENTITY_VISITS &&
          a.visits >= MIN_ENTITY_VISITS &&
          b.leads + a.leads >= MIN_EVENTS
        ) {
          leadStats = computeStatistics(
            leadDef,
            mv(b.leads, b.visits),
            mv(a.leads, a.visits),
            days,
          );
          const ci = leadStats.confidenceInterval;
          leadSignal =
            !!ci &&
            (ci.low > 0 || ci.high < 0) &&
            (leadStats.pValue === null ||
              leadStats.pValue < STAT_ASSUMPTIONS.alpha) &&
            Math.abs(leadStats.absoluteDifference ?? 0) >= MATERIAL_RATE_POINTS;
        }
        if (!visitsSignal && !leadSignal) {
          suppressed.push(
            suppress(
              d,
              'visits',
              key,
              visitsSignal || leadSignal
                ? 'NO_MATERIAL_CHANGE'
                : 'INSUFFICIENT_DATA',
              `${opts.entityWord} «${label}»: визиты ${b.visits} → ${a.visits} (p ${pr.pValue === null ? '—' : pr.pValue.toFixed(3)}), заявки ${b.leads} → ${a.leads}`,
              a.visits,
            ),
          );
          continue;
        }
        // Визиты сущности движутся вместе с общим трафиком сайта — это уже сказала карточка визитов;
        // отдельная карточка дублировала бы её (сущность попадёт в её гипотезу как сопутствующий факт).
        const globalRel = ctx.metrics.visits.statistics?.relativeDifference;
        if (
          !leadSignal &&
          visitsSignal &&
          globalRel !== null &&
          globalRel !== undefined &&
          relV !== null &&
          a.visits > 0 &&
          Math.abs(relV * 100 - globalRel) < MIRRORS_GLOBAL_TRAFFIC_POINTS
        ) {
          suppressed.push(
            suppress(
              d,
              'visits',
              key,
              'DUPLICATE',
              `${opts.entityWord} «${label}»: визиты ${b.visits} → ${a.visits} движутся вместе с общим трафиком (${fmtRel(globalRel).trim()}) — см. карточку визитов`,
              a.visits,
            ),
          );
          continue;
        }
        if (visitsSignal && !materialV && !leadSignal) {
          suppressed.push(
            suppress(
              d,
              'visits',
              key,
              'NO_MATERIAL_CHANGE',
              `${opts.entityWord} «${label}»: визиты ${b.visits} → ${a.visits} — заметно статистически, но ниже порога существенности`,
              a.visits,
            ),
          );
          continue;
        }
        const parts: string[] = [];
        parts.push(
          `${opts.entityWord} «${label}»: визитов за ${fmtPeriod(ctx.windows.after)} ${fmtInt(a.visits)}, в предыдущем окне ${fmtInt(b.visits)}${relV !== null ? fmtRel(relV * 100) : ''}${pr.pValue !== null ? `, p = ${pr.pValue.toFixed(3).replace('.', ',')}` : ''}`,
        );
        if (leadStats)
          parts.push(
            `доля заявок ${fmtPct(b.visits ? (b.leads / b.visits) * 100 : null)} (${b.leads} из ${b.visits}) → ${fmtPct(a.visits ? (a.leads / a.visits) * 100 : null)} (${a.leads} из ${a.visits})${leadStats.pValue !== null ? `, p = ${leadStats.pValue.toFixed(3).replace('.', ',')}` : ''}`,
          );
        const negative = leadSignal
          ? (leadStats?.absoluteDifference ?? 0) < 0
          : false;
        const vanished = a.visits === 0 && b.visits >= MIN_ENTITY_VISITS;
        detected.push(
          build(d, ctx, {
            severity: negative ? 'ATTENTION' : 'INFO',
            scope: 'site',
            metricKey: leadSignal ? 'siteLeadRate' : 'visits',
            entityKey: key,
            title: vanished
              ? `${opts.entityWord} «${label}»: трафик исчез (${fmtInt(b.visits)} → 0 визитов)`
              : leadSignal
                ? `${opts.entityWord} «${label}»: доля заявок ${negative ? 'снизилась' : 'выросла'} ${fmtPct(b.visits ? (b.leads / b.visits) * 100 : null)} → ${fmtPct(a.visits ? (a.leads / a.visits) * 100 : null)}`
                : `${opts.entityWord} «${label}»: визиты ${absV < 0 ? 'снизились' : 'выросли'} ${fmtInt(b.visits)} → ${fmtInt(a.visits)}`,
            fact: {
              text: parts.join('; ') + '.',
              metric: leadSignal ? 'siteLeadRate' : 'visits',
              unit: leadSignal ? 'percent' : 'visits',
              current: leadSignal
                ? a.visits
                  ? (a.leads / a.visits) * 100
                  : null
                : a.visits,
              baseline: leadSignal
                ? b.visits
                  ? (b.leads / b.visits) * 100
                  : null
                : b.visits,
              absoluteDelta: leadSignal
                ? (leadStats?.absoluteDifference ?? null)
                : absV,
              relativeDelta: leadSignal
                ? (leadStats?.relativeDifference ?? null)
                : relV === null
                  ? null
                  : relV * 100,
              sample: {
                current: a.visits,
                baseline: b.visits,
                minimum: MIN_ENTITY_VISITS,
              },
              period: ctx.windows.after,
              baselinePeriod: ctx.windows.before,
            },
            hypothesis: noHypothesis,
            recommendation: rec(
              leadSignal
                ? `Сравнить ${opts.entityWord.toLowerCase()} «${label}» с остальными по визитам и заявкам за оба окна; выводы о конверсии — только внутри одного сегмента и после набора выборки.`
                : `Проверить ${opts.entityWord.toLowerCase()} «${label}»: кампании, ссылки и посадочные страницы за период; сам по себе объём трафика не хороший и не плохой сигнал.`,
              'COMPARE_SEGMENT',
            ),
            evidence: {
              ...evidence(
                d.id,
                {
                  minEntityVisits: MIN_ENTITY_VISITS,
                  materialCountAbsolute: MATERIAL_COUNT_ABSOLUTE,
                  materialCountRelative: MATERIAL_COUNT_RELATIVE,
                  materialRatePoints: MATERIAL_RATE_POINTS,
                },
                null,
                ctx,
                'SIGNAL',
                'MATERIAL',
                [],
                ['visits', 'siteLeadRate'],
              ),
              context: [
                {
                  metric: 'visits',
                  before: b.visits,
                  after: a.visits,
                  unit: 'visits',
                },
                {
                  metric: 'siteLeads',
                  before: b.leads,
                  after: a.leads,
                  unit: 'events',
                },
              ],
            },
            limitations: [
              ...(leadComparable
                ? []
                : (['MEASUREMENT_DEFINITION_CHANGED'] as LimitationCode[])),
              ...(periodTouchesIncident(ctx.windows)
                ? (['INCIDENT_BOUNDARY'] as LimitationCode[])
                : []),
            ],
            link: opts.link,
          }),
        );
      }
      return { detected, suppressed };
    },
  };
  return d;
}

const mv = (num: number, den: number): MetricValue => ({
  numerator: num,
  denominator: den,
  value: den ? (num / den) * 100 : null,
  sample: den,
});

export const sourcePerformanceDetector = entityChangeDetector({
  id: 'source.performance',
  category: 'SOURCE_PERFORMANCE_CHANGE',
  metricLabel: 'источник',
  entityWord: 'Источник',
  link: { tab: 'sources' },
  rows: (ctx) =>
    ctx.slices.sources
      ? {
          before: ctx.slices.sources.before.rows.map((r) => ({
            key: r.trafficSource,
            label: r.trafficSourceName || r.trafficSource,
            visits: r.visits,
            leads: r.siteLeads,
          })),
          after: ctx.slices.sources.after.rows.map((r) => ({
            key: r.trafficSource,
            label: r.trafficSourceName || r.trafficSource,
            visits: r.visits,
            leads: r.siteLeads,
          })),
        }
      : null,
});

export const landingDetector = entityChangeDetector({
  id: 'landing.change',
  category: 'LANDING_CHANGE',
  metricLabel: 'страница входа',
  entityWord: 'Страница входа',
  link: { tab: 'pages' },
  rows: (ctx) =>
    ctx.slices.landings
      ? {
          before: ctx.slices.landings.before.rows.map((r) => ({
            key: r.normalizedPath,
            label: r.normalizedPath,
            visits: r.visits,
            leads: r.siteLeads,
          })),
          after: ctx.slices.landings.after.rows.map((r) => ({
            key: r.normalizedPath,
            label: r.normalizedPath,
            visits: r.visits,
            leads: r.siteLeads,
          })),
        }
      : null,
});

export const productDetector: InsightDetector = {
  id: 'product.change',
  category: 'PRODUCT_CHANGE',
  refresh: 'daily',
  source: 'STAGE12_DETECTOR',
  evaluate(ctx) {
    const d = productDetector;
    const s = ctx.slices.products;
    if (!s) return { detected: [], suppressed: [] };
    const detected: DetectedInsight[] = [];
    const suppressed: SuppressedResult[] = [];
    const days = ctx.windows.days;
    const keys = [
      ...new Set(
        [...s.before.rows, ...s.after.rows].map((r) => r.productCategory),
      ),
    ].sort();
    for (const key of keys) {
      const b = s.before.rows.find((r) => r.productCategory === key);
      const a = s.after.rows.find((r) => r.productCategory === key);
      const bo = b?.acceptedOrders ?? 0,
        ao = a?.acceptedOrders ?? 0;
      if (bo + ao < MIN_EVENTS) {
        suppressed.push(
          suppress(
            d,
            'acceptedOrders',
            key,
            'LOW_SAMPLE',
            `категория ${key}: принятых ${bo} → ${ao}, событий меньше ${MIN_EVENTS}`,
            ao,
          ),
        );
        continue;
      }
      const pr = poissonRateComparison(bo, days, ao, days);
      const ci = pr.ci;
      const signal =
        pr.pValue !== null &&
        pr.pValue < STAT_ASSUMPTIONS.alpha &&
        !!ci &&
        (ci.low > 1 || ci.high < 1);
      const abs = ao - bo;
      const material =
        Math.abs(abs) >= MATERIAL_COUNT_ABSOLUTE &&
        (bo === 0 || Math.abs(abs) / bo >= MATERIAL_COUNT_RELATIVE);
      if (!signal) {
        suppressed.push(
          suppress(
            d,
            'acceptedOrders',
            key,
            'INSUFFICIENT_DATA',
            `категория ${key}: принятых ${bo} → ${ao}, p ${pr.pValue === null ? '—' : pr.pValue.toFixed(3)}`,
            ao,
          ),
        );
        continue;
      }
      if (!material) {
        suppressed.push(
          suppress(
            d,
            'acceptedOrders',
            key,
            'NO_MATERIAL_CHANGE',
            `категория ${key}: принятых ${bo} → ${ao} — заметно статистически, но ниже порога существенности`,
            ao,
          ),
        );
        continue;
      }
      detected.push(
        build(d, ctx, {
          severity: 'INFO',
          scope: 'crm',
          metricKey: 'acceptedOrders',
          entityKey: key,
          title: `Категория ${key}: принятых заказов ${abs < 0 ? 'меньше' : 'больше'} — ${fmtInt(bo)} → ${fmtInt(ao)} за 7 дней`,
          fact: {
            text: `Категория ${key}: принятых заказов за ${fmtPeriod(ctx.windows.after)} ${fmtInt(ao)}, в предыдущем окне ${fmtInt(bo)}${bo ? fmtRel((abs / bo) * 100) : ''}${pr.pValue !== null ? `; p = ${pr.pValue.toFixed(3).replace('.', ',')}` : ''}; сумма договоров ${fmtRub(b?.contractValue ?? 0)} → ${fmtRub(a?.contractValue ?? 0)}.`,
            metric: 'acceptedOrders',
            unit: 'orders',
            current: ao,
            baseline: bo,
            absoluteDelta: abs,
            relativeDelta: bo ? (abs / bo) * 100 : null,
            sample: { current: ao, baseline: bo, minimum: MIN_EVENTS },
            period: ctx.windows.after,
            baselinePeriod: ctx.windows.before,
          },
          hypothesis: noHypothesis,
          recommendation: rec(
            'Проверить каналы и источники заказов категории за оба окна (сайт, Avito, мессенджеры); итоги CRM включают не только заявки сайта.',
            'CHECK_MANUALLY',
          ),
          evidence: {
            ...evidence(
              d.id,
              {
                minEvents: MIN_EVENTS,
                materialCountAbsolute: MATERIAL_COUNT_ABSOLUTE,
                materialCountRelative: MATERIAL_COUNT_RELATIVE,
              },
              null,
              ctx,
              'SIGNAL',
              'MATERIAL',
              [],
              ['acceptedOrders'],
            ),
            context: [
              {
                metric: 'contractValue',
                before: b?.contractValue ?? 0,
                after: a?.contractValue ?? 0,
                unit: 'rub',
              },
              {
                metric: 'paidOrders',
                before: b?.paidOrders ?? 0,
                after: a?.paidOrders ?? 0,
                unit: 'orders',
              },
            ],
          },
          limitations: ['CRM_INCLUDES_OFFLINE', 'IMMATURE_OUTCOME'],
          link: { tab: 'products' },
          notes: [
            'Оплаты и суммы когорты ещё созревают — здесь только принятые заказы как факт объёма.',
          ],
        }),
      );
    }
    return { detected, suppressed };
  },
};

// ---------------------------------------------------------------------------
// Оценки этапа 11 → лента

const VERDICT_RU: Record<Verdict, string> = {
  POSITIVE_SIGNAL: 'положительный сигнал',
  NEGATIVE_SIGNAL: 'отрицательный сигнал',
  NO_CLEAR_CHANGE: 'явного изменения нет',
  INSUFFICIENT_DATA: 'данных недостаточно',
  IMMATURE: 'исход ещё созревает',
  INCOMPARABLE: 'окна несопоставимы',
};

export const changeEvaluationDetector: InsightDetector = {
  id: 'change.evaluation',
  category: 'CHANGE_EVALUATION',
  refresh: 'hourly',
  source: 'STAGE11_EVALUATION',
  evaluate(ctx) {
    const d = changeEvaluationDetector;
    const detected: DetectedInsight[] = [];
    const suppressed: SuppressedResult[] = [];
    for (const ch of ctx.changes) {
      const e = ch.latest;
      if (!e) {
        suppressed.push(
          suppress(
            d,
            null,
            ch.id,
            'INSUFFICIENT_DATA',
            `изменение «${ch.name}»: оценок ещё нет`,
            null,
          ),
        );
        continue;
      }
      if (ch.seenVersion !== null && ch.seenVersion >= e.version) {
        suppressed.push(
          suppress(
            d,
            null,
            ch.id,
            'DUPLICATE',
            `изменение «${ch.name}»: версия v${e.version} уже поднята в ленту`,
            null,
          ),
        );
        continue;
      }
      const p = e.primary;
      const severity: InsightSeverity =
        e.verdict === 'NEGATIVE_SIGNAL' ? 'ATTENTION' : 'INFO';
      detected.push(
        build(d, ctx, {
          severity,
          scope: 'change',
          metricKey: e.primaryMetric,
          entityKey: ch.id,
          title: `Оценка изменения «${ch.name}» обновилась: v${e.version} — ${VERDICT_RU[e.verdict]}`,
          fact: {
            text: `${e.FACT} Вердикт этапа 11: ${e.verdict} (${VERDICT_RU[e.verdict]}), созревание ${e.maturity}.`,
            metric: e.primaryMetric,
            unit:
              p.unit === 'percent'
                ? 'percent'
                : p.unit === 'rub'
                  ? 'rub'
                  : p.unit === 'orders'
                    ? 'orders'
                    : p.unit === 'events'
                      ? 'events'
                      : 'visits',
            current: p.after.value,
            baseline: p.before.value,
            absoluteDelta: p.statistics?.absoluteDifference ?? null,
            relativeDelta: p.statistics?.relativeDifference ?? null,
            sample: {
              current: p.after.sample,
              baseline: p.before.sample,
              minimum: null,
            },
            period: e.windows.after,
            baselinePeriod: e.windows.before,
          },
          hypothesis: {
            status: 'SUPPORTED_BY_CONCURRENT_FACTS',
            text: `Гипотеза: ${e.INTERPRETATION.replace(/\.$/, '')}. Причинность не установлена.`,
            supportingFacts: e.confounders.map((c) => c.fact),
          },
          recommendation: rec(e.RECOMMENDATION, 'USE_STAGE11_RECOMMENDATION'),
          evidence: {
            ...evidence(
              d.id,
              {},
              null,
              ctx,
              e.verdict === 'POSITIVE_SIGNAL' || e.verdict === 'NEGATIVE_SIGNAL'
                ? 'SIGNAL'
                : 'NONE',
              'NONE',
              [
                { kind: 'analytics_change', id: ch.id, label: ch.name },
                {
                  kind: 'stage11_evaluation',
                  id: `${ch.id}#${e.version}`,
                  label: `оценка v${e.version}`,
                },
              ],
            ),
            metricEvaluation: e.primary,
            verdict: e.verdict,
            confounders: e.confounders,
          },
          limitations: ['STAGE11_VERDICT_PRESERVED', ...e.dataQuality.flags],
          link: { tab: 'growth', id: ch.id },
          notes: [
            'Вердикт, статистика и рекомендация — этапа 11 без переинтерпретации.',
          ],
        }),
      );
    }
    return { detected, suppressed };
  },
};

// ---------------------------------------------------------------------------
// Качество данных

export const staleDetector: InsightDetector = {
  id: 'quality.stale',
  category: 'DATA_QUALITY',
  refresh: 'hourly',
  source: 'STAGE12_DETECTOR',
  evaluate(ctx) {
    const d = staleDetector;
    const f = ctx.freshness;
    if (f.status === 'FRESH')
      return {
        detected: [],
        suppressed: [
          suppress(
            d,
            'freshness',
            'metrika',
            'NO_MATERIAL_CHANGE',
            `данные Метрики свежие (возраст ${fmtInt(f.metrikaDataAgeSeconds)} с, порог ${f.thresholdSeconds} с)`,
            null,
          ),
        ],
      };
    const age = f.metrikaDataAgeSeconds;
    const severity: InsightSeverity =
      f.status === 'NO_DATA' || (age ?? 0) >= CRITICAL_STALE_SECONDS
        ? 'CRITICAL'
        : 'ATTENTION';
    return {
      detected: [
        build(d, ctx, {
          severity,
          scope: 'data',
          metricKey: 'freshness',
          entityKey: 'metrika',
          title:
            f.status === 'NO_DATA'
              ? 'Данные Метрики отсутствуют'
              : `Данные Метрики устарели: последняя синхронизация ${fmtInt((age ?? 0) / 3600)} ч назад`,
          fact: {
            text:
              f.status === 'NO_DATA'
                ? 'Успешной синхронизации Метрики нет — все показатели сайта недоступны.'
                : `Последняя успешная синхронизация Метрики: ${f.lastMetrikaSyncAt?.toISOString() ?? '—'}; возраст данных ${fmtInt(age)} с при пороге ${f.thresholdSeconds} с (расписание — раз в час).`,
            metric: 'freshness',
            unit: 'seconds',
            current: age,
            baseline: f.thresholdSeconds,
            absoluteDelta: age === null ? null : age - f.thresholdSeconds,
            relativeDelta: null,
            sample: { current: null, baseline: null, minimum: null },
            period: ctx.windows.after,
            baselinePeriod: null,
          },
          hypothesis: noHypothesis,
          recommendation: rec(
            'Проверить журнал синхронизации (MetrikaSyncRun) и доступность API Метрики; пока данные устарели, сигналы по сайту не считать актуальными.',
            'IMPROVE_DATA_QUALITY',
          ),
          evidence: {
            ...evidence(
              d.id,
              {
                criticalStaleSeconds: CRITICAL_STALE_SECONDS,
                thresholdSeconds: f.thresholdSeconds,
              },
              null,
              ctx,
              'NONE',
              'MATERIAL',
            ),
            confounders: [],
          },
          limitations: ['ANALYTICS_STALE'],
          link: { tab: 'quality' },
        }),
      ],
      suppressed: [],
    };
  },
};

export const clientIdCoverageDetector: InsightDetector = {
  id: 'quality.clientIdCoverage',
  category: 'DATA_QUALITY',
  refresh: 'daily',
  source: 'STAGE12_DETECTOR',
  evaluate(ctx) {
    const d = clientIdCoverageDetector;
    const q = ctx.dataQuality;
    if (!q) return { detected: [], suppressed: [] };
    const accepted = ctx.metrics.acceptedOrders.after.value ?? 0;
    if (accepted < CLIENT_ID_COVERAGE_MIN_ACCEPTED)
      return {
        detected: [],
        suppressed: [
          suppress(
            d,
            'clientIdCoverageAccepted',
            null,
            'LOW_SAMPLE',
            `принятых в окне ${fmtInt(accepted)} < ${CLIENT_ID_COVERAGE_MIN_ACCEPTED}`,
            accepted,
          ),
        ],
      };
    const cov = q.clientIdCoverageAccepted;
    if (cov !== null && cov >= CLIENT_ID_COVERAGE_MIN_PCT)
      return {
        detected: [],
        suppressed: [
          suppress(
            d,
            'clientIdCoverageAccepted',
            null,
            'NO_MATERIAL_CHANGE',
            `покрытие ClientID ${fmtPct(cov)} ≥ ${CLIENT_ID_COVERAGE_MIN_PCT} %`,
            accepted,
          ),
        ],
      };
    return {
      detected: [
        build(d, ctx, {
          severity: 'INFO',
          scope: 'data',
          metricKey: 'clientIdCoverageAccepted',
          entityKey: null,
          title: `Покрытие ClientID у принятых заказов ${fmtPct(cov, 0)} — сопоставление сайт → заказ ненадёжно`,
          fact: {
            text: `За ${fmtPeriod(ctx.windows.after)} ClientID есть у ${fmtPct(cov, 0)} принятых заказов (принятых ${fmtInt(accepted)}); порог для сопоставленных метрик — ${CLIENT_ID_COVERAGE_MIN_PCT} %.`,
            metric: 'clientIdCoverageAccepted',
            unit: 'percent',
            current: cov,
            baseline: CLIENT_ID_COVERAGE_MIN_PCT,
            absoluteDelta:
              cov === null ? null : cov - CLIENT_ID_COVERAGE_MIN_PCT,
            relativeDelta: null,
            sample: {
              current: accepted,
              baseline: null,
              minimum: CLIENT_ID_COVERAGE_MIN_ACCEPTED,
            },
            period: ctx.windows.after,
            baselinePeriod: null,
          },
          hypothesis: noHypothesis,
          recommendation: rec(
            'Не использовать сопоставленную конверсию сайт → заказ как основной KPI, пока покрытие ниже порога; заявки с сайта и заказы CRM читать по отдельности.',
            'IMPROVE_DATA_QUALITY',
          ),
          evidence: evidence(
            d.id,
            {
              clientIdCoverageMinPct: CLIENT_ID_COVERAGE_MIN_PCT,
              clientIdCoverageMinAccepted: CLIENT_ID_COVERAGE_MIN_ACCEPTED,
            },
            null,
            ctx,
            'NONE',
            'MATERIAL',
            [],
            ['acceptedOrders', 'matchedAccepted'],
          ),
          limitations: ['MATCHED_COVERAGE_LOW'],
          link: { tab: 'quality' },
        }),
      ],
      suppressed: [],
    };
  },
};

export const cogsDetector: InsightDetector = {
  id: 'quality.cogs',
  category: 'DATA_QUALITY',
  refresh: 'daily',
  source: 'STAGE12_DETECTOR',
  evaluate(ctx) {
    const d = cogsDetector;
    const incomplete = ctx.metrics.netProfit.flags.includes('COGS_INCOMPLETE');
    if (!incomplete)
      return {
        detected: [],
        suppressed: [
          suppress(
            d,
            'netProfit',
            null,
            'NO_MATERIAL_CHANGE',
            'себестоимость по заказам окна полная',
            null,
          ),
        ],
      };
    return {
      detected: [
        build(d, ctx, {
          severity: 'INFO',
          scope: 'data',
          metricKey: 'netProfit',
          entityKey: null,
          title:
            'Себестоимость по части заказов не заполнена — прибыль за окно неточна',
          fact: {
            text: `В окне ${fmtPeriod(ctx.windows.before)} — ${fmtPeriod(ctx.windows.after)} есть выполненные заказы без себестоимости (пометка COGS_UNRELIABLE_ORDERS канонических метрик); чистая прибыль ${fmtRub(ctx.metrics.netProfit.before.value)} → ${fmtRub(ctx.metrics.netProfit.after.value)} не является точной.`,
            metric: 'netProfit',
            unit: 'rub',
            current: ctx.metrics.netProfit.after.value,
            baseline: ctx.metrics.netProfit.before.value,
            absoluteDelta: null,
            relativeDelta: null,
            sample: {
              current: ctx.metrics.netProfit.after.sample,
              baseline: ctx.metrics.netProfit.before.sample,
              minimum: null,
            },
            period: ctx.windows.after,
            baselinePeriod: ctx.windows.before,
          },
          hypothesis: noHypothesis,
          recommendation: rec(
            'Заполнить себестоимость в заказах без неё (раздел «Отчёты» / карточки заказов); до этого выводы о прибыли не делать.',
            'IMPROVE_DATA_QUALITY',
          ),
          evidence: evidence(
            d.id,
            {},
            ctx.metrics.netProfit,
            ctx,
            'NONE',
            'MATERIAL',
          ),
          limitations: ['COGS_INCOMPLETE'],
          link: { tab: 'quality' },
        }),
      ],
      suppressed: [],
    };
  },
};

export const paidWithoutDateDetector: InsightDetector = {
  id: 'quality.paidWithoutDate',
  category: 'DATA_QUALITY',
  refresh: 'daily',
  source: 'STAGE12_DETECTOR',
  evaluate(ctx) {
    const d = paidWithoutDateDetector;
    const n = ctx.paidWithoutDate;
    if (n <= 0)
      return {
        detected: [],
        suppressed: [
          suppress(
            d,
            'paidWithoutDate',
            null,
            'NO_MATERIAL_CHANGE',
            'оплаченных без даты оплаты нет',
            0,
          ),
        ],
      };
    return {
      detected: [
        build(d, ctx, {
          severity: 'INFO',
          scope: 'data',
          metricKey: 'paidWithoutDate',
          entityKey: null,
          title: `${fmtInt(n)} оплаченных заказов без даты оплаты — когорты оплат смещены`,
          fact: {
            text: `Среди заказов, принятых за ${fmtPeriod(ctx.windows.after)}, ${fmtInt(n)} со статусом «оплачен» без даты оплаты (существующий показатель качества этапа 08).`,
            metric: 'paidWithoutDate',
            unit: 'orders',
            current: n,
            baseline: 0,
            absoluteDelta: n,
            relativeDelta: null,
            sample: {
              current: ctx.metrics.acceptedOrders.after.value,
              baseline: null,
              minimum: null,
            },
            period: ctx.windows.after,
            baselinePeriod: null,
          },
          hypothesis: noHypothesis,
          recommendation: rec(
            'Проставить дату оплаты в карточках этих заказов — иначе конверсия в оплату и созревание когорт считаются неполно.',
            'IMPROVE_DATA_QUALITY',
          ),
          evidence: evidence(
            d.id,
            {},
            null,
            ctx,
            'NONE',
            'LOW',
            [],
            ['acceptedOrders', 'paidOrders'],
          ),
          limitations: [],
          link: { tab: 'quality' },
        }),
      ],
      suppressed: [],
    };
  },
};

// ---------------------------------------------------------------------------
// Пропуски измерения (FIX_01): один агрегированный сигнал на воронку, только если пропуск
// реально ограничивает анализ отвала в текущем окне

type GapKind = 'INSTRUMENTATION_GAP' | 'NOT_ON_SITE';

function gapKindOf(step: FunnelStep): GapKind {
  const configured = EVENT_GAP_STEP_KINDS[step.key];
  if (configured) return configured;
  return /не существует|нет на сайте/i.test(step.note ?? '')
    ? 'NOT_ON_SITE'
    : 'INSTRUMENTATION_GAP';
}

/** Что именно нельзя сделать без шага — по его месту среди измеренных шагов. */
function gapConsequence(steps: FunnelStep[], idx: number): string {
  const label = steps[idx].label;
  const prev = [...steps.slice(0, idx)]
    .reverse()
    .find((s) => s.availability === 'measured');
  const next = steps.slice(idx + 1).find((s) => s.availability === 'measured');
  if (!prev && next)
    return `нельзя посчитать конверсию из «${label}» в «${next.label}» и долю потерь до этого шага`;
  if (prev && next)
    return `переход «${prev.label}» → «${next.label}» нельзя разложить через «${label}»: потеря не локализуется между этими шагами`;
  if (prev && !next)
    return `нельзя измерить завершение воронки после «${prev.label}» (шаг «${label}»)`;
  return `шаг «${label}» не измеряется`;
}

export const eventNotMeasuredDetector: InsightDetector = {
  id: 'quality.eventNotMeasured',
  category: 'DATA_QUALITY',
  refresh: 'daily',
  source: 'STAGE12_DETECTOR',
  evaluate(ctx) {
    const d = eventNotMeasuredDetector;
    const funnels = ctx.behavior?.funnels;
    if (!funnels) return { detected: [], suppressed: [] };
    const detected: DetectedInsight[] = [];
    const suppressed: SuppressedResult[] = [];
    const thresholds = { eventGapMinFunnelVisits: EVENT_GAP_MIN_FUNNEL_VISITS };
    for (const f of funnels) {
      const gaps = f.steps
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => s.availability === 'not_measured');
      if (!gaps.length) continue;
      const relevant = gaps.filter(
        ({ s }) => gapKindOf(s) === 'INSTRUMENTATION_GAP',
      );
      const notOnSite = gaps.filter(({ s }) => gapKindOf(s) === 'NOT_ON_SITE');
      const labels = (list: { s: FunnelStep }[]) =>
        list.map(({ s }) => `«${s.label}»`).join(', ');
      if (!relevant.length) {
        suppressed.push(
          suppress(
            d,
            'funnelSteps',
            f.key,
            'NO_MATERIAL_CHANGE',
            `воронка «${f.title}»: шаг(и) ${labels(notOnSite)} на сайте не существуют — ни одному анализу не нужны, карточка не создаётся`,
            null,
          ),
        );
        continue;
      }
      // Анализ отвала возможен только при активности на входе измеренной части (порог правила 11.1 этапа 10)
      const entry = f.steps.find(
        (s) => s.availability === 'measured' && s.visits !== null,
      );
      const entryVisits = entry?.visits ?? null;
      if (entryVisits === null || entryVisits < EVENT_GAP_MIN_FUNNEL_VISITS) {
        suppressed.push(
          suppress(
            d,
            'funnelSteps',
            f.key,
            'LOW_SAMPLE',
            `воронка «${f.title}»: не измеряются ${labels(relevant)}, но на входе измеренной части ${entryVisits === null ? 'нет данных' : `${entryVisits} визитов`} (< ${EVENT_GAP_MIN_FUNNEL_VISITS}) — анализ отвала сейчас не идёт, пропуск ничего не ограничивает`,
            entryVisits,
          ),
        );
        continue;
      }
      const stepsText = relevant
        .map(
          ({ s }) =>
            `«${s.label}» (${s.note ? s.note.replace(/\.$/, '') : 'цели в счётчике нет'})`,
        )
        .join('; ');
      const consequences = relevant
        .map(({ idx }) => gapConsequence(f.steps, idx))
        .join('; ');
      // Без чисел окна: карточка описывает пропуск измерения, а не дневные объёмы — иначе версия росла бы
      // каждый день без изменения сути; текущие числа шагов — во вкладке «Поведение».
      const measuredText = f.steps
        .filter((s) => s.availability === 'measured' && s.visits !== null)
        .map((s) => `«${s.label}»`)
        .join(' → ');
      const notOnSiteText = notOnSite.length
        ? ` Шаг(и) ${labels(notOnSite)} на сайте не существуют и в анализе не нужны.`
        : '';
      const text =
        `Анализ отвала воронки «${f.title}» (правило этапа 10) ограничен: не измеряется ${relevant.length === 1 ? 'шаг' : `шагов ${relevant.length}`} — ${stepsText}. ` +
        `Значение таких шагов — not_measured, не 0. Нельзя сделать выводы: ${consequences}. ` +
        `Измеренная часть воронки: ${measuredText || 'нет измеренных шагов'}; на входе в текущем окне не меньше ${EVENT_GAP_MIN_FUNNEL_VISITS} визитов — анализ актуален (числа шагов — во вкладке «Поведение»).${notOnSiteText}`;
      detected.push(
        build(d, ctx, {
          severity: 'INFO',
          scope: 'data',
          metricKey: 'funnelSteps',
          entityKey: f.key,
          title: `Воронка «${f.title}»: ${relevant.length === 1 ? 'шаг не измеряется' : `${relevant.length} шага не измеряются`} — анализ отвала ограничен`,
          fact: {
            text,
            metric: 'funnelSteps',
            unit: null,
            current: null,
            baseline: null,
            absoluteDelta: null,
            relativeDelta: null,
            sample: {
              current: null,
              baseline: null,
              minimum: EVENT_GAP_MIN_FUNNEL_VISITS,
            },
            period: ctx.windows.after,
            baselinePeriod: null,
          },
          hypothesis: {
            status: 'NO_SUPPORTED_HYPOTHESIS',
            text: 'Гипотезы нет: отсутствие измерения — известный факт настройки счётчика, а не поведение клиентов.',
            supportingFacts: [],
          },
          recommendation: rec(
            `Проверить настройку счётчика Метрики: завести цели для событий, которые сайт уже отправляет (${labels(relevant)}), либо зафиксировать шаг как намеренно неизмеряемый. Событийную модель сайта (web-photo) в рамках этапа 12 не менять; до появления измерения выводы об отвале на этих шагах не делать.`,
            'IMPROVE_DATA_QUALITY',
          ),
          evidence: {
            ...evidence(d.id, thresholds, null, ctx, 'NONE', 'LOW', [], []),
            context: relevant.map(({ s }) => ({
              metric: `step:${s.key}`,
              before: null,
              after: null,
              unit: 'visits',
            })),
            confounders: [],
          },
          limitations: ['NOT_MEASURED_STEPS', 'STAGE10_RULE_MIRROR'],
          link: { tab: 'behavior' },
          notes: [
            'Это качество измерения, а не проблема поведения клиентов: не измеряемые шаги отдаются как not_measured (null), в 0 не превращаются.',
          ],
        }),
      );
    }
    return { detected, suppressed };
  },
};

// ---------------------------------------------------------------------------
// Реестр и запуск

export const DETECTORS: InsightDetector[] = [
  trafficDetector,
  siteLeadRateDetector,
  formStartRateDetector,
  formErrorRateDetector,
  stage10Detector,
  sourceMixDetector,
  sourcePerformanceDetector,
  landingDetector,
  productDetector,
  crmLeadToAcceptedDetector,
  crmLeadToPaidDetector,
  revenueDetector,
  profitDetector,
  changeEvaluationDetector,
  staleDetector,
  clientIdCoverageDetector,
  cogsDetector,
  paidWithoutDateDetector,
  eventNotMeasuredDetector,
];

/** Запуск детекторов: daily — все, hourly — только с refresh: 'hourly'. Детерминирован: порядок фиксирован. */
export function runDetectors(
  ctx: InsightContext,
  detectors: InsightDetector[] = DETECTORS,
): DetectorRunResult & { errors: string[] } {
  const detected: DetectedInsight[] = [];
  const suppressed: SuppressedResult[] = [];
  const errors: string[] = [];
  for (const d of detectors) {
    if (ctx.runKind === 'hourly' && d.refresh !== 'hourly') continue;
    try {
      const r = d.evaluate(ctx);
      detected.push(...r.detected);
      suppressed.push(...r.suppressed);
    } catch (e) {
      errors.push(`${d.id}: ${(e as Error).message}`);
    }
  }
  // один отпечаток — одна карточка за запуск (дубли внутри запуска — DUPLICATE)
  const seen = new Set<string>();
  const unique: DetectedInsight[] = [];
  for (const di of detected) {
    if (seen.has(di.fingerprint)) {
      suppressed.push({
        detectorId: di.payload.detectorId,
        category: di.payload.category,
        metricKey: di.payload.metricKey,
        entityKey: di.payload.entityKey,
        reason: 'DUPLICATE',
        detail: 'тот же отпечаток уже обнаружен в этом запуске',
        sample: null,
      });
      continue;
    }
    seen.add(di.fingerprint);
    unique.push(di);
  }
  return { detected: unique, suppressed, errors };
}

export { periodTouchesIncident as touchesIncident };
export type { AnalyticsPeriod };
