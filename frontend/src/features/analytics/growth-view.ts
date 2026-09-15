import type {
  ChangeStatus,
  ChangeType,
  ConfounderCode,
  DataQualityFlag,
  ExpectedDirection,
  MaturityStatus,
  MetricEvaluation,
  MetricValue,
  Verdict,
} from '../../types/growth';

/**
 * Подписи и форматы раздела «Рост / Изменения» (этап 11). Ничего не считается:
 * вердикты, интервалы, MDE и тексты приходят с сервера, здесь — только слова
 * и цвета. Вердикт INSUFFICIENT_DATA никогда не подписывается как успех.
 */

export const VERDICT_LABELS: Record<Verdict, string> = {
  POSITIVE_SIGNAL: 'Сигнал в нужную сторону',
  NEGATIVE_SIGNAL: 'Сигнал в плохую сторону',
  NO_CLEAR_CHANGE: 'Заметного изменения нет',
  INSUFFICIENT_DATA: 'Данных недостаточно',
  IMMATURE: 'Исход ещё созревает',
  INCOMPARABLE: 'Окна несопоставимы',
};

export const VERDICT_TONE: Record<Verdict, string> = {
  POSITIVE_SIGNAL: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  NEGATIVE_SIGNAL: 'border-rose-200 bg-rose-50 text-rose-900',
  NO_CLEAR_CHANGE: 'border-gray-200 bg-gray-50 text-gray-800',
  INSUFFICIENT_DATA: 'border-amber-200 bg-amber-50 text-amber-900',
  IMMATURE: 'border-sky-200 bg-sky-50 text-sky-900',
  INCOMPARABLE: 'border-gray-300 bg-gray-100 text-gray-700',
};

/** Показывать ли дельту крупно: только когда вердикт вообще что-то говорит о разнице. */
export function deltaIsHeadline(verdict: Verdict): boolean {
  return verdict === 'POSITIVE_SIGNAL' || verdict === 'NEGATIVE_SIGNAL' || verdict === 'NO_CLEAR_CHANGE';
}

export const MATURITY_LABELS: Record<MaturityStatus, string> = {
  MATURE: 'созрело',
  PARTIALLY_MATURE: 'созрело частично',
  IMMATURE: 'не созрело',
};

export const STATUS_LABELS: Record<ChangeStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Действует',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
};

export const STATUS_TONE: Record<ChangeStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-200 text-gray-500 line-through',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  SITE: 'Сайт',
  CRM: 'CRM',
  MARKETING: 'Маркетинг',
  PRICING: 'Цены',
  OPERATIONS: 'Операции',
  ANALYTICS: 'Аналитика',
  OTHER: 'Другое',
};

export const DIRECTION_LABELS: Record<ExpectedDirection, string> = {
  INCREASE: 'ожидаем рост',
  DECREASE: 'ожидаем снижение',
  NEUTRAL: 'направление не задано',
};

export const AUDIENCE_LABELS: Record<string, string> = {
  device: 'устройство',
  source: 'источник',
  utm: 'UTM-источник',
  landing: 'страница входа',
};

export const FLAG_LABELS: Record<DataQualityFlag, string> = {
  EXCLUDED_CUTOVER_DAY: 'день выхода изменения исключён из сравнения',
  WEEKDAY_MIX_MISMATCH: 'состав дней недели в окнах различается',
  SHORT_WINDOW: 'окно короче запрошенного — полных дней после изменения пока мало',
  AFTER_WINDOW_TRUNCATED_BY_END: 'окно «после» обрезано датой окончания изменения',
  NO_COMPLETE_DAYS_AFTER: 'после изменения ещё нет полного дня',
  PARTIAL_MEASUREMENT_PERIOD: 'метрика измерена не за всё окно',
  INCOMPARABLE_WINDOWS: 'окна несопоставимы',
  MEASUREMENT_DEFINITION_CHANGED: 'внутри сравнения менялось определение метрики',
  METRIC_UNAVAILABLE_BEFORE: 'метрики ещё не было в окне «до»',
  METRIC_UNAVAILABLE_AFTER: 'метрики нет в окне «после»',
  ANALYTICS_STALE: 'данные Метрики давно не обновлялись',
  LOW_SAMPLE: 'мало данных',
  ZERO_DENOMINATOR: 'нулевой знаменатель',
  UNIQUE_USERS_UNAVAILABLE_FOR_CUSTOM_WINDOW: 'уникальные посетители за эти окна ещё не сняты (прочерк, не сумма по дням)',
  MATCHED_COVERAGE_LOW: 'покрытие ClientID низкое — сопоставление ненадёжно',
  COGS_INCOMPLETE: 'себестоимость части заказов ненадёжна',
  IMMATURE_OUTCOME: 'исход ещё созревает',
  METRIC_SCOPE_MISMATCH: 'метрика не отвечает на вопрос изменения этого типа',
  STATISTICAL_TEST_UNAVAILABLE: 'статистического теста для метрики нет — только описание',
  UNSUPPORTED_SEGMENT: 'сегмент не поддерживается хранимыми агрегатами',
  OVERLAPPING_CHANGE: 'одновременно действовало другое изменение',
  MATURITY_HISTORY_INSUFFICIENT: 'истории CRM мало для эмпирического созревания — политика по умолчанию',
};

export const CONFOUNDER_LABELS: Record<ConfounderCode, string> = {
  WEEKDAY_MIX_MISMATCH: 'Дни недели',
  SOURCE_MIX_SHIFT: 'Сдвиг источников',
  DEVICE_MIX_SHIFT: 'Сдвиг устройств',
  LANDING_MIX_SHIFT: 'Сдвиг страниц входа',
  MEASUREMENT_DEFINITION_CHANGED: 'Смена определения',
  OVERLAPPING_CHANGE: 'Другое изменение рядом',
  ANALYTICS_STALE: 'Устаревшие данные',
  LOW_SAMPLE: 'Мало данных',
  MATCHED_COVERAGE_LOW: 'Покрытие ClientID',
  COGS_INCOMPLETE: 'Себестоимость',
  IMMATURE_OUTCOME: 'Созревание',
};

export const METHOD_LABELS: Record<NonNullable<MetricEvaluation['statistics']>['method'], string> = {
  two_proportion_z_pooled: 'z-тест двух долей, интервал Ньюкомба',
  fisher_exact_two_sided: 'точный тест Фишера, интервал Ньюкомба',
  poisson_conditional_binomial_exact: 'точный тест для счётчиков (Пуассон)',
  bootstrap_percentile_mean_diff: 'бутстрэп разности средних',
  descriptive_only: 'без теста — описательно',
};

const ru = (v: number, digits = 2) => (Math.round(v * 10 ** digits) / 10 ** digits).toLocaleString('ru-RU');

export function formatDateRu(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('.');
}

/** Момент по Москве: 24.09.2026 15:00 MSK. */
export function formatMoscow(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })} MSK`;
}

export function formatValue(m: Pick<MetricEvaluation, 'kind' | 'unit'>, v: MetricValue): string {
  if (v.value === null) return '—';
  if (m.kind === 'ratio') return `${ru(v.value)} %`;
  if (m.unit === 'rub') return `${ru(v.value, 0)} ₽`;
  return ru(v.value, 0);
}

/** Подпись знаменателя: «12 из 640», «8 заказов», «7 дней». */
export function formatBasis(m: Pick<MetricEvaluation, 'kind' | 'unit'>, v: MetricValue): string {
  if (m.kind === 'ratio') return v.numerator === null || v.denominator === null ? '' : `${ru(v.numerator, 0)} из ${ru(v.denominator, 0)}`;
  if (m.kind === 'mean') return `заказов ${ru(v.sample, 0)}`;
  if (m.kind === 'count') return v.denominator ? `за ${ru(v.denominator, 0)} дн.` : '';
  return v.sample ? `заказов ${ru(v.sample, 0)}` : '';
}

export function formatDifference(m: Pick<MetricEvaluation, 'kind' | 'unit'>, abs: number | null, rel: number | null): string {
  if (abs === null) return '—';
  const sign = abs > 0 ? '+' : '';
  const a = m.kind === 'ratio' ? `${sign}${ru(abs)} п.п.` : m.unit === 'rub' ? `${sign}${ru(abs, 0)} ₽` : `${sign}${ru(abs, 0)}`;
  return rel === null ? a : `${a} (${rel > 0 ? '+' : ''}${ru(rel, 1)} %)`;
}

export function formatInterval(m: Pick<MetricEvaluation, 'kind' | 'unit'>, s: MetricEvaluation['statistics']): string | null {
  if (!s) return null;
  const f = (v: number) => (v === Infinity ? '∞' : `${v > 0 ? '+' : ''}${ru(v, m.kind === 'ratio' ? 2 : m.unit === 'rub' ? 0 : 1)}`);
  if (m.kind === 'ratio' && s.confidenceInterval) return `95 % ДИ разницы: ${f(s.confidenceInterval.low)} … ${f(s.confidenceInterval.high)} п.п.`;
  if (m.kind === 'count' && s.relativeConfidenceInterval) return `95 % ДИ относительного изменения: ${f(s.relativeConfidenceInterval.low)} … ${f(s.relativeConfidenceInterval.high)} %`;
  if (m.kind === 'mean' && s.confidenceInterval) return `95 % бутстрэп-интервал: ${f(s.confidenceInterval.low)} … ${f(s.confidenceInterval.high)} ₽`;
  return null;
}

/** Человеческое объяснение MDE: что вообще можно заметить при таком объёме. */
export function mdeText(m: MetricEvaluation): string | null {
  const s = m.statistics;
  if (!s?.mde) return null;
  const unit = m.kind === 'count' ? 'событий' : m.scope === 'crm' ? 'заказов' : 'визитов';
  const rel = s.mde.relative === null ? '' : ` (±${ru(s.mde.relative, 0)} % от базы)`;
  const abs = m.kind === 'ratio' ? `±${ru(s.mde.absolute)} п.п.` : `±${ru(s.mde.absolute, 0)}`;
  const req = s.requiredSample ? `; чтобы заметить ${ru(s.requiredSample.targetRelativeEffect * 100, 0)} %, нужно ≈ ${ru(s.requiredSample.perWindow, 0)} ${unit} на окно` : '';
  return `При текущем объёме заметим только эффект от ${abs}${rel}${req}.`;
}

export function pValueText(p: number | null): string | null {
  if (p === null) return null;
  return p < 0.001 ? 'p < 0,001' : `p = ${ru(p, 3)}`;
}
