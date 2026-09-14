/**
 * Пороги правил «Требует внимания» (этап 10, разделы 7, 11, 12) и границы
 * доступности поведенческих данных (BEHAVIOR_EVENT_CONTRACT.md, § 3).
 *
 * Все пороги — прозрачные числа, без обучаемых моделей и без LLM. Правило
 * молчит, если выборка меньше минимальной: тишина при малых данных
 * честнее ложной тревоги. Значения описаны в BEHAVIOR_RULES.md.
 */

/** С этого дня измеряются поведенческие цели (form_started, attempt, lead, футболки, клики). */
export const BEHAVIOR_GOALS_AVAILABLE_FROM = '2026-09-10';
/** С этого дня — цели по направлениям (lead_submitted_photo/canvas/tshirt) и form_error. */
export const DIRECTION_GOALS_AVAILABLE_FROM = '2026-09-12';

/** Меньше — LOW_SAMPLE: доли по странице/устройству показываются, но не ранжируются и не рождают issue. */
export const MIN_SAMPLE_VISITS = 30;
/** Минимум визитов на входе в шаг, чтобы обсуждать конверсию шага. */
export const MIN_STEP_ENTRANTS = 20;
/** Минимум ошибок формы за период, чтобы всплеск считался всплеском. */
export const MIN_FORM_ERROR_VISITS = 5;
/** Минимум заявок (визитов с заявкой) в базовом периоде для правил про lead rate. */
export const MIN_LEADS_FOR_RATE = 3;

export const THRESHOLDS = {
  /** 11.1: доля отвала на шаге ≥ 90 % при входе ≥ MIN_STEP_ENTRANTS — ATTENTION. */
  dropoffAttentionRate: 90,
  /** 11.1: отвал вырос к предыдущему периоду на ≥ 15 п.п. — CRITICAL. */
  dropoffDeltaCriticalPp: 15,
  /** 11.2: mobile / desktop ≤ 0,5 при обоих ≥ MIN_SAMPLE_VISITS — ATTENTION; ≤ 0,25 или 0 — CRITICAL. */
  deviceGapAttentionRatio: 0.5,
  deviceGapCriticalRatio: 0.25,
  /** 11.3: визитов с ошибкой ≥ MIN_FORM_ERROR_VISITS и ≥ ×2 к предыдущему периоду — ATTENTION; ≥ ×3 — CRITICAL. */
  errorSpikeAttentionFactor: 2,
  errorSpikeCriticalFactor: 3,
  /** 11.3 (без сравнения): доля визитов с ошибкой среди начавших форму ≥ 30 % при ≥ 10 начавших — ATTENTION. */
  errorRateAttentionPct: 30,
  errorRateMinFormStarts: 10,
  /** 11.4: конверсия страницы ≤ 50 % от средней по сайту при visits ≥ MIN_SAMPLE_VISITS и ожидаемых заявках ≥ 3. */
  landingUnderperformanceRatio: 0.5,
  landingMinExpectedLeads: 3,
  /** 11.5: lead rate изменилась на ≥ 50 % относительно предыдущего периода при visits ≥ MIN_SAMPLE_VISITS в обоих. */
  leadRateAnomalyRelPct: 50,
} as const;

export type ThresholdKey = keyof typeof THRESHOLDS;
