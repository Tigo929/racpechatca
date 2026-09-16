import type { InsightCategory, InsightRecord, InsightSeverity, InsightStatus, SuppressionReason } from '../../types/insights';

/** Подписи и тона раздела «Инсайты» (этап 12). Тексты — из API; здесь только словари. */

export const SEVERITY_LABELS: Record<InsightSeverity, string> = {
  CRITICAL: 'Критично',
  ATTENTION: 'Внимание',
  INFO: 'К сведению',
};

export const SEVERITY_TONE: Record<InsightSeverity, string> = {
  CRITICAL: 'bg-red-50 text-red-800 border-red-200',
  ATTENTION: 'bg-amber-50 text-amber-800 border-amber-200',
  INFO: 'bg-gray-100 text-gray-700 border-gray-200',
};

export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  TRAFFIC_CHANGE: 'Трафик',
  SITE_CONVERSION_CHANGE: 'Конверсия сайта',
  FUNNEL_DROPOFF: 'Воронка',
  FORM_ERROR_CHANGE: 'Ошибки форм',
  DEVICE_GAP: 'Устройства',
  SOURCE_MIX_SHIFT: 'Структура источников',
  SOURCE_PERFORMANCE_CHANGE: 'Источник',
  LANDING_CHANGE: 'Страница входа',
  PRODUCT_CHANGE: 'Товары',
  CRM_CONVERSION_CHANGE: 'Конверсия CRM',
  REVENUE_CHANGE: 'Выручка',
  PROFIT_CHANGE: 'Прибыль',
  CHANGE_EVALUATION: 'Оценка изменения',
  DATA_QUALITY: 'Качество данных',
};

export const STATUS_LABELS: Record<InsightStatus, string> = {
  OPEN: 'Новый',
  ACKNOWLEDGED: 'Принят к сведению',
  RESOLVED: 'Закрыт',
  SUPERSEDED: 'Заменён новым эпизодом',
};

export const SOURCE_LABELS = {
  STAGE12_DETECTOR: 'детектор',
  STAGE10_RULE: 'правило «Поведения» (этап 10)',
  STAGE11_EVALUATION: 'оценка «Рост / Изменения» (этап 11)',
} as const;

export const SUPPRESSION_LABELS: Record<SuppressionReason, string> = {
  LOW_SAMPLE: 'мало данных (выборка)',
  INSUFFICIENT_DATA: 'данных недостаточно',
  IMMATURE: 'исход ещё созревает',
  INCOMPARABLE_PERIODS: 'окна несопоставимы',
  PARTIAL_BEHAVIOR_PERIOD: 'часть периода без поведенческих целей',
  METRIC_NOT_AVAILABLE: 'метрика ещё не измерялась',
  MEASUREMENT_DEFINITION_CHANGED: 'менялось определение метрики',
  WEEKDAY_MIX_MISMATCH: 'разный состав дней недели',
  MATCHED_COVERAGE_LOW: 'низкое покрытие ClientID',
  COGS_INCOMPLETE: 'себестоимость неполная',
  STALE_DATA: 'данные устарели',
  DUPLICATE: 'уже показано',
  COOLDOWN: 'пауза после закрытия / лимит карточек',
  NO_MATERIAL_CHANGE: 'существенного изменения нет',
};

export const LIMITATION_LABELS: Record<string, string> = {
  OVERLAPPING_CHANGE: 'рядом действовали другие изменения',
  ANALYTICS_STALE: 'данные Метрики устарели',
  LOW_SAMPLE: 'малая выборка',
  SHORT_WINDOW: 'окно короче недели',
  WEEKDAY_MIX_MISMATCH: 'разный состав дней недели',
  MEASUREMENT_DEFINITION_CHANGED: 'менялось определение метрики',
  METRIC_UNAVAILABLE_BEFORE: 'метрика не измерялась в окне «до»',
  METRIC_UNAVAILABLE_AFTER: 'метрика не измерялась в окне «после»',
  PARTIAL_MEASUREMENT_PERIOD: 'часть окна без измерения',
  INCOMPARABLE_WINDOWS: 'окна несопоставимы',
  IMMATURE_OUTCOME: 'исход ещё созревает',
  MATCHED_COVERAGE_LOW: 'низкое покрытие ClientID',
  COGS_INCOMPLETE: 'себестоимость неполная',
  STATISTICAL_TEST_UNAVAILABLE: 'без статистического теста',
  PARTIAL_BEHAVIOR_PERIOD: 'часть периода без поведенческих целей',
  NOT_MEASURED_STEPS: 'часть шагов не измеряется',
  CRM_INCLUDES_OFFLINE: 'итоги CRM включают не только сайт',
  INCIDENT_BOUNDARY: 'окно пересекает инцидент 14–15.09',
  STAGE10_RULE_MIRROR: 'вычислено правилом этапа 10',
  STAGE11_VERDICT_PRESERVED: 'вердикт этапа 11 без переинтерпретации',
  NO_SUPPORTED_HYPOTHESIS: 'гипотезы нет',
  DESCRIPTIVE_ONLY: 'только описательно',
  ZERO_DENOMINATOR: 'нулевой знаменатель',
  EXCLUDED_CUTOVER_DAY: 'день изменения исключён',
  UNIQUE_USERS_UNAVAILABLE_FOR_CUSTOM_WINDOW: 'уникальные за окно недоступны',
  METRIC_SCOPE_MISMATCH: 'метрика другой области',
  MATURITY_HISTORY_INSUFFICIENT: 'истории созревания мало',
};

export const LINK_LABELS: Record<NonNullable<InsightRecord['link']>['tab'], string> = {
  overview: 'Обзор',
  behavior: 'Поведение',
  growth: 'Рост / Изменения',
  sources: 'Источники',
  products: 'Товары',
  pages: 'Страницы',
  quality: 'Качество данных',
};

export function limitationLabel(code: string): string {
  return LIMITATION_LABELS[code] ?? code;
}

export function formatMoscowShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatDateShort(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

export function periodText(i: InsightRecord): string {
  const cur = i.periodStart === i.periodEnd ? formatDateShort(i.periodStart) : `${formatDateShort(i.periodStart)}–${formatDateShort(i.periodEnd)}`;
  if (!i.baselineStart || !i.baselineEnd) return cur;
  return `${formatDateShort(i.baselineStart)}–${formatDateShort(i.baselineEnd)} → ${cur}`;
}
