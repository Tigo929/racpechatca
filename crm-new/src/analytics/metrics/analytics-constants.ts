/**
 * Неизменяемые границы данных (этап 08, раздел 6) и константы качества.
 * Строки — как в документах плана; Date — те же моменты в UTC для сравнений.
 */

/** Сайт перестал слать ложный ecommerce.purchase; lead_submitted стал полным. */
export const FALSE_BROWSER_PURCHASE_STOPPED_AT =
  '2026-09-12 13:19:22 Europe/Moscow';
export const LEAD_GOAL_SEMANTICS_CHANGED_AT =
  '2026-09-12 13:19:22 Europe/Moscow';
export const WEB_CUTOVER_AT = new Date('2026-09-12T10:19:22.000Z');
/** Первый день, целиком лежащий после web cutover: с него siteLeads полные. */
export const WEB_CUTOVER_COMPLETE_FROM = '2026-09-13';

/** Воркер CRM→Метрика включён: заказы уходят в CDP только с этого момента. */
export const CRM_TO_METRIKA_LIVE_SINCE = '2026-09-12 12:20:10 Europe/Moscow';
export const CRM_TO_METRIKA_LIVE_AT = new Date('2026-09-12T09:20:10.000Z');

/** Счётчик собирает данные с этого дня; раньше — нули, а не отсутствие трафика. */
export const COUNTER_DATA_SINCE = '2026-08-13';

/** Свежесть данных Метрики: моложе двух часов — FRESH. */
export const FRESHNESS_THRESHOLD_SECONDS = 2 * 3600;

export const METRIKA_SCOPE_COUNTER = 'counter';
