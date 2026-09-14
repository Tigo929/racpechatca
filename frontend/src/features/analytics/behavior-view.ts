import type { BehaviorQualityNote, IssueRule, IssueSeverity, SampleStatus } from '../../types/behavior';
import type { Warning } from './analytics-view';

/**
 * Подписи и правила показа раздела «Поведение» (этап 10). Числа не считаются —
 * только подписываются; единицы измерения называются явно, чтобы события,
 * визиты и посетители не смешивались в одной колонке.
 */

export const UNIT_LABELS = {
  visits: 'визиты',
  events: 'события',
  users: 'посетители',
} as const;

export const UNIT_TOOLTIPS = {
  visits: 'Целевые визиты: визит, в котором шаг достигнут хотя бы раз. Основная единица воронки — по ней считаются конверсии.',
  events: 'Достижения цели — событий может быть несколько за один визит (например, повторный фокус на поле формы). Не сравнивать с визитами.',
  users: 'Уникальные посетители за весь период, достигшие шага — отдельный снимок Метрики. Без снимка — прочерк, а не сумма по дням.',
} as const;

export const BEHAVIOR_NOTES: Record<BehaviorQualityNote, Warning> = {
  BEHAVIOR_NOT_SYNCED: {
    code: 'not-synced',
    text: 'Поведенческие данные за этот период ещё не синхронизированы',
    tooltip: 'Наборы этапа 10 (цели по устройствам и страницам, параметры визитов, пути) обновляются расписанием Метрики. Пока строк нет — раздел показывает «нет данных», а не нули.',
  },
  PERIOD_BEFORE_BEHAVIOR_GOALS: {
    code: 'before-goals',
    text: 'Период раньше 10 сентября 2026 — поведенческие цели тогда ещё не существовали',
    tooltip: 'JS-цели «начали форму», «отправили», «заявка» и шаги конструктора созданы 10.09.2026. Метрика не восстанавливает достижения задним числом.',
  },
  PERIOD_BEFORE_DIRECTION_GOALS: {
    code: 'before-direction-goals',
    text: 'Период раньше 12 сентября 2026 — цели по направлениям и ошибка формы тогда не существовали',
  },
  PARTIAL_BEHAVIOR_PERIOD: {
    code: 'partial',
    text: 'Часть периода — до появления поведенческих целей (10–12 сентября 2026): цифры за эти дни неполные',
  },
  NO_PERIOD_GOAL_SNAPSHOT: {
    code: 'no-goal-snapshot',
    text: 'Посетители по шагам за этот период не подсчитаны — показаны визиты и события',
    tooltip: 'Уникальные посетители шага считаются отдельным запросом за период только для стандартных периодов.',
  },
  LOW_SAMPLE: {
    code: 'low-sample',
    text: 'Мало данных: выводы по долям ненадёжны',
    tooltip: 'Порог — 30 визитов. Ниже него доли показываются, но не ранжируются и не рождают карточек «Требует внимания».',
  },
  METRIKA_STALE: { code: 'stale', text: 'Данные Метрики могут быть устаревшими: синхронизация давно не обновлялась' },
  METRIKA_NO_DATA: { code: 'no-data', text: 'Данных Метрики нет: синхронизация ещё не выполнялась' },
  COMPARISON_UNAVAILABLE: {
    code: 'comparison',
    text: 'Сравнение с предыдущим периодом недоступно',
    tooltip: 'Предыдущий период целиком или частично раньше появления целей, либо по нему нет поведенческих данных.',
  },
};

export function behaviorWarnings(notes: BehaviorQualityNote[]): Warning[] {
  const seen = new Set<string>();
  const out: Warning[] = [];
  for (const n of notes) {
    const w = BEHAVIOR_NOTES[n];
    if (w && !seen.has(w.code)) {
      seen.add(w.code);
      out.push(w);
    }
  }
  return out;
}

export const SAMPLE_LABELS: Record<SampleStatus, string> = {
  OK: '',
  LOW_SAMPLE: 'мало данных',
  INSUFFICIENT_DATA: 'нет данных',
};

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  CRITICAL: 'Критично',
  ATTENTION: 'Внимание',
  INFO: 'К сведению',
};

export const SEVERITY_TONE: Record<IssueSeverity, string> = {
  CRITICAL: 'border-rose-200 bg-rose-50 text-rose-900',
  ATTENTION: 'border-amber-200 bg-amber-50 text-amber-900',
  INFO: 'border-sky-200 bg-sky-50 text-sky-900',
};

export const RULE_LABELS: Record<IssueRule, string> = {
  FUNNEL_DROPOFF: 'Отвал на шаге воронки',
  DEVICE_GAP: 'Разрыв между устройствами',
  FORM_ERROR_SPIKE: 'Ошибки формы',
  LANDING_UNDERPERFORMANCE: 'Слабая страница входа',
  LEAD_RATE_ANOMALY: 'Скачок доли заявок',
};

export const DEVICE_LABELS_BEHAVIOR: Record<string, string> = {
  desktop: 'Компьютер',
  mobile: 'Телефон',
  tablet: 'Планшет',
  other: 'Другое',
};

export function formatSeconds(v: number | null): string {
  if (v === null) return '—';
  const s = Math.round(v);
  if (s < 60) return `${s} с`;
  return `${Math.floor(s / 60)} мин ${String(s % 60).padStart(2, '0')} с`;
}
