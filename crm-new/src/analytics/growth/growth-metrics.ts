import {
  BEHAVIOR_GOALS_AVAILABLE_FROM,
  DIRECTION_GOALS_AVAILABLE_FROM,
} from '../behavior/behavior-rules';
import {
  COUNTER_DATA_SINCE,
  WEB_CUTOVER_COMPLETE_FROM,
} from '../metrics/analytics-constants';
import type {
  ChangeType,
  GrowthMetricDefinition,
  GrowthMetricKey,
  MetricEvaluation,
} from './growth-contract';

/**
 * Каталог метрик оценки «до / после» (этап 11, раздел 6). Формулы не
 * дублируются: значения берутся из AnalyticsMetricsService (этап 08) и
 * BehaviorMetricsService (этап 10); здесь — только семантика: область,
 * единица, созревание, дата доступности и совместимость с типом изменения.
 *
 * Даты доступности — из этапов 08/10: счётчик с 13.08; lead_submitted в нынешнем
 * определении (без ложного purchase) — полные дни с 13.09; поведенческие цели
 * — с 10.09; сопоставление сайт→CRM — с включения воркера 12.09.
 */

/** Первый полный день после включения CRM→Метрика: до него сопоставленных заказов быть не может. */
export const MATCHED_AVAILABLE_FROM = '2026-09-13';

const SITE: ChangeType[] = ['SITE', 'MARKETING', 'ANALYTICS', 'OTHER'];
const CRM: ChangeType[] = ['CRM', 'PRICING', 'OPERATIONS', 'OTHER'];
const BUSINESS: ChangeType[] = ['PRICING', 'OPERATIONS', 'MARKETING', 'OTHER'];

export const GROWTH_METRICS: Record<GrowthMetricKey, GrowthMetricDefinition> = {
  visits: {
    key: 'visits',
    label: 'Визиты',
    scope: 'site',
    kind: 'count',
    unit: 'visits',
    maturity: 'immediate',
    polarity: 'higher-good',
    availableFrom: COUNTER_DATA_SINCE,
    definitionCutovers: [],
    primaryFor: ['MARKETING', 'SITE', 'OTHER'],
    source: 'AnalyticsMetricsService.getOverview → traffic.visits',
    description: 'Визиты счётчика за окно (ym:s:visits, сумма по дням).',
  },
  siteLeads: {
    key: 'siteLeads',
    label: 'Заявки сайта',
    scope: 'site',
    kind: 'count',
    unit: 'events',
    maturity: 'immediate',
    polarity: 'higher-good',
    availableFrom: WEB_CUTOVER_COMPLETE_FROM,
    definitionCutovers: [WEB_CUTOVER_COMPLETE_FROM],
    primaryFor: SITE,
    source: 'AnalyticsMetricsService.getOverview → siteFunnel.siteLeads',
    description:
      'Достижения канонической цели lead_submitted. До 13.09 цель считалась иначе (ложный purchase) — окна до этой даты несопоставимы.',
  },
  siteLeadRate: {
    key: 'siteLeadRate',
    label: 'Конверсия визитов в заявку',
    scope: 'site',
    kind: 'ratio',
    unit: 'percent',
    maturity: 'immediate',
    polarity: 'higher-good',
    availableFrom: WEB_CUTOVER_COMPLETE_FROM,
    definitionCutovers: [WEB_CUTOVER_COMPLETE_FROM],
    primaryFor: SITE,
    source: 'siteLeads / visits (AnalyticsMetricsService.getOverview)',
    description:
      'Заявки сайта / визиты × 100. Первичная метрика для правок форм и страниц.',
  },
  formStarts: {
    key: 'formStarts',
    label: 'Начали форму (визиты)',
    scope: 'site',
    kind: 'count',
    unit: 'visits',
    maturity: 'immediate',
    polarity: 'higher-good',
    availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
    definitionCutovers: [BEHAVIOR_GOALS_AVAILABLE_FROM],
    primaryFor: SITE,
    source: 'BehaviorMetricsService.loadInput → goalTotals.form_started.visits',
    description:
      'Целевые визиты form_started (этап 10); цель существует с 10.09.',
  },
  formStartRate: {
    key: 'formStartRate',
    label: 'Доля визитов с началом формы',
    scope: 'site',
    kind: 'ratio',
    unit: 'percent',
    maturity: 'immediate',
    polarity: 'higher-good',
    availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
    definitionCutovers: [BEHAVIOR_GOALS_AVAILABLE_FROM],
    primaryFor: SITE,
    source: 'formStarts / visits',
    description: 'Визиты с началом формы / визиты × 100.',
  },
  leadAttempts: {
    key: 'leadAttempts',
    label: 'Отправили форму (визиты)',
    scope: 'site',
    kind: 'count',
    unit: 'visits',
    maturity: 'immediate',
    polarity: 'higher-good',
    availableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
    definitionCutovers: [BEHAVIOR_GOALS_AVAILABLE_FROM],
    primaryFor: SITE,
    source:
      'BehaviorMetricsService.loadInput → goalTotals.lead_submit_attempt.visits',
    description:
      'Целевые визиты lead_submit_attempt (проверка формы пройдена).',
  },
  formErrors: {
    key: 'formErrors',
    label: 'Ошибки формы (визиты)',
    scope: 'site',
    kind: 'count',
    unit: 'visits',
    maturity: 'immediate',
    polarity: 'lower-good',
    availableFrom: DIRECTION_GOALS_AVAILABLE_FROM,
    definitionCutovers: [DIRECTION_GOALS_AVAILABLE_FROM],
    primaryFor: SITE,
    source: 'BehaviorMetricsService.loadInput → goalTotals.form_error.visits',
    description: 'Визиты с ошибкой проверки формы (цель form_error с 12.09).',
  },
  formErrorRate: {
    key: 'formErrorRate',
    label: 'Доля ошибок среди начавших форму',
    scope: 'site',
    kind: 'ratio',
    unit: 'percent',
    maturity: 'immediate',
    polarity: 'lower-good',
    availableFrom: DIRECTION_GOALS_AVAILABLE_FROM,
    definitionCutovers: [DIRECTION_GOALS_AVAILABLE_FROM],
    primaryFor: SITE,
    source: 'formErrors / formStarts',
    description: 'Визиты с ошибкой / визиты с началом формы × 100.',
  },
  matchedAccepted: {
    key: 'matchedAccepted',
    label: 'Сопоставленные принятые заказы',
    scope: 'matched',
    kind: 'count',
    unit: 'orders',
    maturity: 'accepted',
    polarity: 'higher-good',
    availableFrom: MATCHED_AVAILABLE_FROM,
    definitionCutovers: [MATCHED_AVAILABLE_FROM],
    primaryFor: [],
    source: 'AnalyticsMetricsService.getOverview → siteFunnel.matchedAccepted',
    description:
      'Принятые заказы, дошедшие до Метрики как CRM-цель с ClientID. Зависит от покрытия ClientID — только контекст.',
  },
  matchedAcceptedRate: {
    key: 'matchedAcceptedRate',
    label: 'Конверсия визитов в сопоставленный заказ',
    scope: 'matched',
    kind: 'ratio',
    unit: 'percent',
    maturity: 'accepted',
    polarity: 'higher-good',
    availableFrom: MATCHED_AVAILABLE_FROM,
    definitionCutovers: [MATCHED_AVAILABLE_FROM],
    primaryFor: [],
    source: 'matchedAccepted / visits',
    description:
      'Только при достаточном покрытии ClientID; иначе MATCHED_COVERAGE_LOW.',
  },
  matchedPaid: {
    key: 'matchedPaid',
    label: 'Сопоставленные оплаченные заказы',
    scope: 'matched',
    kind: 'count',
    unit: 'orders',
    maturity: 'paid',
    polarity: 'higher-good',
    availableFrom: MATCHED_AVAILABLE_FROM,
    definitionCutovers: [MATCHED_AVAILABLE_FROM],
    primaryFor: [],
    source: 'AnalyticsMetricsService.getOverview → siteFunnel.matchedPaid',
    description: 'Оплаченные заказы, дошедшие до Метрики как CRM-цель.',
  },
  crmLeads: {
    key: 'crmLeads',
    label: 'Заявки CRM (когорта по дате заявки)',
    scope: 'crm',
    kind: 'count',
    unit: 'orders',
    maturity: 'immediate',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: CRM,
    source: 'AnalyticsMetricsService.lifecycles → leadAt в окне',
    description:
      'Все заявки CRM (сайт, Avito, оператор) с датой заявки в окне — бизнес целиком, не эффект сайта.',
  },
  acceptedOrders: {
    key: 'acceptedOrders',
    label: 'Принятые заказы (по дате принятия)',
    scope: 'crm',
    kind: 'count',
    unit: 'orders',
    maturity: 'immediate',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: CRM,
    source: 'AnalyticsMetricsService.lifecycles → acceptedAt в окне',
    description: 'Заказы, принятые в работу в окне (событие принятия).',
  },
  leadToAcceptedRate: {
    key: 'leadToAcceptedRate',
    label: 'Заявка → принят (когорта заявок)',
    scope: 'crm',
    kind: 'ratio',
    unit: 'percent',
    maturity: 'accepted',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: CRM,
    source: 'когорта leadAt в окне: принято к дате наблюдения / заявок',
    description:
      'Доля заявок окна, принятых к дате наблюдения; созревает по эмпирической задержке.',
  },
  leadToPaidRate: {
    key: 'leadToPaidRate',
    label: 'Заявка → оплата (когорта заявок)',
    scope: 'crm',
    kind: 'ratio',
    unit: 'percent',
    maturity: 'paid',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: CRM,
    source: 'когорта leadAt в окне: оплачено к дате наблюдения / заявок',
    description: 'Доля заявок окна, оплаченных к дате наблюдения.',
  },
  paidOrders: {
    key: 'paidOrders',
    label: 'Оплаченные заказы (когорта принятых)',
    scope: 'crm',
    kind: 'count',
    unit: 'orders',
    maturity: 'paid',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: CRM,
    source: 'когорта acceptedAt в окне: оплачено к дате наблюдения',
    description:
      'Заказы, принятые в окне и оплаченные к дате наблюдения (не календарные оплаты).',
  },
  paidAov: {
    key: 'paidAov',
    label: 'Средний чек оплаченных (когорта принятых)',
    scope: 'crm',
    kind: 'mean',
    unit: 'rub',
    maturity: 'paid',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: BUSINESS,
    source: 'когорта acceptedAt в окне: сумма заказов / оплаченные',
    description:
      'Средняя сумма оплаченного заказа когорты; интервал — бутстрэп по заказам.',
  },
  contractValue: {
    key: 'contractValue',
    label: 'Сумма принятых заказов',
    scope: 'crm',
    kind: 'sum',
    unit: 'rub',
    maturity: 'accepted',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: BUSINESS,
    source: 'когорта acceptedAt в окне: Σ totalOrder',
    description:
      'Контрактная стоимость заказов, принятых в окне (описательно, без теста).',
  },
  paidOrderValue: {
    key: 'paidOrderValue',
    label: 'Сумма оплаченных заказов',
    scope: 'crm',
    kind: 'sum',
    unit: 'rub',
    maturity: 'paid',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: BUSINESS,
    source:
      'когорта acceptedAt в окне: Σ totalOrder оплаченных к дате наблюдения',
    description: 'Оплаченная стоимость заказов когорты (описательно).',
  },
  realizedRevenue: {
    key: 'realizedRevenue',
    label: 'Реализованная выручка (P&L)',
    scope: 'pnl',
    kind: 'sum',
    unit: 'rub',
    maturity: 'paid',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: BUSINESS,
    source:
      'AnalyticsMetricsService.getOverview → financials.realized.realizedRevenue',
    description:
      'Выручка по дате признания отчёта владельца за окно — календарная, не когортная.',
  },
  netProfit: {
    key: 'netProfit',
    label: 'Чистая прибыль (P&L)',
    scope: 'pnl',
    kind: 'sum',
    unit: 'rub',
    maturity: 'paid',
    polarity: 'higher-good',
    availableFrom: null,
    definitionCutovers: [],
    primaryFor: BUSINESS,
    source:
      'AnalyticsMetricsService.getOverview → financials.realized.netProfit',
    description:
      'По методике отчёта; при ненадёжной себестоимости — COGS_INCOMPLETE.',
  },
};

export const GROWTH_METRIC_KEYS = Object.keys(
  GROWTH_METRICS,
) as GrowthMetricKey[];

export function isGrowthMetricKey(value: string): value is GrowthMetricKey {
  return value in GROWTH_METRICS;
}

/**
 * Совместимость метрики с вопросом изменения (раздел 7): правка сайта → метрики
 * сайта первичны, CRM-итоги — контекст; правка CRM — наоборот; сопоставленные
 * метрики — всегда контекст (зависят от покрытия ClientID); P&L — контекст для
 * правок сайта/CRM и первична только для ценовых/операционных изменений.
 */
export function scopeCompatibility(
  metric: GrowthMetricKey,
  changeType: ChangeType,
): MetricEvaluation['scopeCompatibility'] {
  const def = GROWTH_METRICS[metric];
  if (def.primaryFor.includes(changeType)) return 'valid';
  if (def.scope === 'matched') return 'context_only';
  // Сайт ↔ CRM: итоги другого пространства данных — контекст, а не ответ на вопрос.
  if (changeType === 'SITE' && (def.scope === 'crm' || def.scope === 'pnl'))
    return 'context_only';
  if (changeType === 'CRM' && def.scope === 'site') return 'context_only';
  if (changeType === 'ANALYTICS' && def.scope !== 'site') return 'context_only';
  return 'context_only';
}

/** Метрики контекста по умолчанию для типа изменения — то, что показывается рядом, но не оценивает изменение. */
export function defaultContextMetrics(
  changeType: ChangeType,
): GrowthMetricKey[] {
  if (changeType === 'SITE' || changeType === 'ANALYTICS')
    return ['crmLeads', 'acceptedOrders', 'matchedAccepted', 'realizedRevenue'];
  if (changeType === 'CRM' || changeType === 'OPERATIONS')
    return ['visits', 'siteLeads', 'realizedRevenue', 'netProfit'];
  return ['visits', 'siteLeads', 'crmLeads', 'acceptedOrders'];
}
