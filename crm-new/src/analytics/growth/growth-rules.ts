/**
 * Пороги и допущения слоя «Рост и изменения» (этап 11, разделы 12–14).
 * Все числа — конфигурация и метаданные результата, не «доказательства»;
 * они отдаются в /growth/status и описаны в GROWTH_STATISTICS.md.
 */

/** Двусторонний уровень значимости и мощность для MDE / требуемой выборки (раздел 12). */
export const ALPHA = 0.05;
export const POWER = 0.8;
/** Целевой относительный эффект для оценки «сколько нужно данных» (20 % от базы). */
export const TARGET_RELATIVE_EFFECT = 0.2;

/** Меньше визитов в любом окне — INSUFFICIENT_DATA для метрик сайта (как MIN_SAMPLE_VISITS этапа 10). */
export const MIN_SAMPLE_VISITS = 30;
/** Меньше событий (числитель до + после) — доля не обсуждается: INSUFFICIENT_DATA. */
export const MIN_EVENTS = 5;
/** Меньше заказов в когорте окна — CRM-доли и средние не обсуждаются. */
export const MIN_ORDERS = 5;
/** Меньше оплаченных заказов с суммой — бутстрэп среднего чека не считается. */
export const MIN_BOOTSTRAP_SAMPLE = 5;
/** Число бутстрэп-повторов и зерно детерминированного генератора. */
export const BOOTSTRAP_ITERATIONS = 2000;
export const BOOTSTRAP_SEED = 20260915;

/** Минимум полных дней в окне, чтобы вердикт мог быть сигналом (короче — INSUFFICIENT_DATA, состав дней недели не уравновешен). */
export const MIN_WINDOW_DAYS_FOR_SIGNAL = 7;
/** Предпочтительные длины окон — целые недели, состав дней недели совпадает. */
export const EVALUATION_DAYS_OPTIONS = [7, 14, 21, 28] as const;
/** Максимум дней окна при автоматическом выборе. */
export const MAX_AUTO_WINDOW_DAYS = 28;

/** Покрытие ClientID у принятых ниже — сопоставленные метрики не оцениваются. */
export const MATCHED_COVERAGE_MIN_PCT = 50;
/** Сдвиг доли источника / устройства / страницы входа ≥ столько п.п. — confounder ATTENTION. */
export const MIX_SHIFT_POINTS_ATTENTION = 15;
/** Доля минимального окна, ниже которой источник/страница не участвует в сравнении смесей (шум). */
export const MIX_MIN_SHARE_PCT = 5;

/** Минимум пар дат в истории CRM для эмпирической политики созревания. */
export const MIN_LAG_SAMPLE = 20;
/** Политика по умолчанию, если истории мало: дней созревания по классам. */
export const DEFAULT_MATURITY_DAYS = {
  immediate: 0,
  accepted: 7,
  paid: 14,
} as const;
/** Верхняя граница эмпирической политики — p90 больше не растягивает ожидание бесконечно. */
export const MAX_MATURITY_DAYS = 45;

/** Квантили нормального распределения для alpha/power (две стороны; 0,975 и 0,8). */
export const Z_ALPHA_TWO_SIDED = 1.959963984540054;
export const Z_POWER = 0.8416212335729143;
