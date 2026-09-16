/**
 * Пороги движка сигналов (этап 12, INSIGHTS_RULES.md). Все числа V1 — здесь и
 * только здесь; детекторы читают их, тесты фиксируют, Reviewer видит таблицей.
 * Статистика и MDE берутся из этапа 11 (growth-rules.ts / growth-statistics.ts)
 * — своих формул у этапа 12 нет.
 */

/** Окна ежедневного запуска: последние 7 полных московских дней против предыдущих 7. */
export const ROLLING_WINDOW_DAYS = 7;
/** Длинное окно 28/28 — только когда истории хватает (данные Метрики с 13.08.2026). */
export const LONG_WINDOW_DAYS = 28;

/** Минимум визитов в окне для долей и счётчиков сайта (как этап 10/11). */
export const MIN_SAMPLE_VISITS = 30;
/** Минимум событий (числитель до + после) — иначе LOW_SAMPLE. */
export const MIN_EVENTS = 5;
/** Минимум заказов когорты для CRM-долей. */
export const MIN_ORDERS = 5;
/** Минимум визитов по источнику / странице входа для отдельного сигнала (этап 10: < 30 — LOW_SAMPLE). */
export const MIN_ENTITY_VISITS = 30;

// ── Деловая существенность (отдельно от статистики) ──────────────────────────
/** Доли: |Δ| в процентных пунктах не меньше этого — иначе NO_MATERIAL_CHANGE. */
export const MATERIAL_RATE_POINTS = 2;
/** Счётчики: относительное изменение не меньше 20 % И абсолютное не меньше 10 единиц. */
export const MATERIAL_COUNT_RELATIVE = 0.2;
export const MATERIAL_COUNT_ABSOLUTE = 10;
/** Деньги: |Δ| не меньше 5 000 ₽ И не меньше 10 % базы. */
export const MATERIAL_MONEY_RUB = 5000;
export const MATERIAL_MONEY_RELATIVE = 0.1;
/** Ошибки форм: затронуто не меньше стольких визитов с ошибкой в текущем окне. */
export const MATERIAL_ERROR_VISITS = 5;
/** Источник / страница входа, чьи визиты меняются вместе с общим трафиком (разница относительных изменений
 *  меньше этого, п.п.), отдельной карточки не получает — попадает в гипотезу карточки визитов. */
export const MIRRORS_GLOBAL_TRAFFIC_POINTS = 20;
/** Сдвиг смеси источников — как в этапе 11 (п.п.). */
export const MIX_SHIFT_POINTS = 15;

// ── CRITICAL — только ограниченный набор ситуаций ────────────────────────────
/** Почти полное исчезновение заявок: в текущем окне заявок 0 при визитах не меньше порога, а в базовом — не меньше N. */
export const CRITICAL_LEADS_VANISHED_MIN_VISITS = 150;
export const CRITICAL_LEADS_VANISHED_BASELINE_LEADS = 3;
/** Обрыв воронки: начатых форм 0 при визитах не меньше порога, в базовом окне — не меньше N. */
export const CRITICAL_FUNNEL_BREAK_MIN_VISITS = 100;
export const CRITICAL_FUNNEL_BREAK_BASELINE_STARTS = 5;
/** Подтверждённый рост ошибок форм: NEGATIVE_SIGNAL по доле ошибок и затронуто визитов не меньше порога. */
export const CRITICAL_FORM_ERROR_VISITS = 10;
/** Данные Метрики старше этого — критическая просрочка (расписание — раз в час; порог этапа 08 STALE — меньше). */
export const CRITICAL_STALE_SECONDS = 6 * 3600;

// ── Качество данных ──────────────────────────────────────────────────────────
/** Покрытие ClientID у принятых ниже — сигнал DATA_QUALITY (тот же порог, что гейт этапа 11). */
export const CLIENT_ID_COVERAGE_MIN_PCT = 50;
/** Минимум принятых в окне, чтобы покрытие вообще обсуждать. */
export const CLIENT_ID_COVERAGE_MIN_ACCEPTED = 5;

// ── Жизненный цикл ───────────────────────────────────────────────────────────
/** Сигнал, вернувшийся после RESOLVED раньше этого срока, открывается заново тем же эпизодом; позже — новый эпизод. */
export const REOPEN_WINDOW_DAYS = 7;
/** Не больше активных сигналов на детектор (остальные — в диагностику как COOLDOWN). */
export const MAX_ACTIVE_PER_DETECTOR = 3;
/** Кулдаун между новыми эпизодами одного отпечатка (дней). */
export const COOLDOWN_DAYS = 3;

/**
 * Полярность для сигналов (раздел 11): визиты — контекст, а не «больше = лучше»;
 * остальное — как в каталоге метрик этапа 11.
 */
export const INSIGHT_POLARITY_OVERRIDES: Record<string, 'neutral'> = {
  visits: 'neutral',
};

/** Порядок ленты — детерминированный; сначала критические технические/данные, потом деловые. */
export const SEVERITY_ORDER: Record<'CRITICAL' | 'ATTENTION' | 'INFO', number> =
  {
    CRITICAL: 0,
    ATTENTION: 1,
    INFO: 2,
  };

/** Все пороги одним объектом — для status API и документации. */
export const INSIGHT_THRESHOLDS: Record<string, number> = {
  rollingWindowDays: ROLLING_WINDOW_DAYS,
  longWindowDays: LONG_WINDOW_DAYS,
  minSampleVisits: MIN_SAMPLE_VISITS,
  minEvents: MIN_EVENTS,
  minOrders: MIN_ORDERS,
  minEntityVisits: MIN_ENTITY_VISITS,
  materialRatePoints: MATERIAL_RATE_POINTS,
  materialCountRelative: MATERIAL_COUNT_RELATIVE,
  materialCountAbsolute: MATERIAL_COUNT_ABSOLUTE,
  materialMoneyRub: MATERIAL_MONEY_RUB,
  materialMoneyRelative: MATERIAL_MONEY_RELATIVE,
  materialErrorVisits: MATERIAL_ERROR_VISITS,
  mixShiftPoints: MIX_SHIFT_POINTS,
  mirrorsGlobalTrafficPoints: MIRRORS_GLOBAL_TRAFFIC_POINTS,
  criticalLeadsVanishedMinVisits: CRITICAL_LEADS_VANISHED_MIN_VISITS,
  criticalLeadsVanishedBaselineLeads: CRITICAL_LEADS_VANISHED_BASELINE_LEADS,
  criticalFunnelBreakMinVisits: CRITICAL_FUNNEL_BREAK_MIN_VISITS,
  criticalFunnelBreakBaselineStarts: CRITICAL_FUNNEL_BREAK_BASELINE_STARTS,
  criticalFormErrorVisits: CRITICAL_FORM_ERROR_VISITS,
  criticalStaleSeconds: CRITICAL_STALE_SECONDS,
  clientIdCoverageMinPct: CLIENT_ID_COVERAGE_MIN_PCT,
  clientIdCoverageMinAccepted: CLIENT_ID_COVERAGE_MIN_ACCEPTED,
  reopenWindowDays: REOPEN_WINDOW_DAYS,
  maxActivePerDetector: MAX_ACTIVE_PER_DETECTOR,
  cooldownDays: COOLDOWN_DAYS,
};

/** Известные границы данных — единый контракт, а не hardcode по детекторам. */
export const DATA_BOUNDARIES = {
  metrikaHistorySince: '2026-08-13',
  leadSemanticsCutover: '2026-09-12T10:19:00.000Z',
  incident: {
    from: '2026-09-14T15:20:00.000Z',
    to: '2026-09-15T17:32:00.000Z',
    label:
      'Инцидент 14.09 18:20 → 15.09 20:32 MSK: сайт работал на августовской сборке, цели заявок за период неполные',
  },
} as const;
