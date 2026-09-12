import {
  addDays,
  assertRange,
  calendarDateIn,
  daysBetween,
  isoToUtcDate,
  type DateRange,
  type IsoDate,
} from '../../metrika/analytics/metrika-dates';

/**
 * Периоды аналитики (этап 08, разделы 5, 9, 19).
 *
 * Период — отрезок календарных дней по Москве, включительно. Бизнес живёт
 * в Europe/Moscow: событие CRM с меткой 21:00 UTC — это уже завтрашний
 * аналитический день. Москва с 2014 года без перевода часов, смещение
 * фиксированное: +03:00.
 *
 * Предыдущий период: для календарного месяца — предыдущий календарный
 * месяц, для любого другого отрезка — непосредственно предшествующий
 * отрезок той же длины.
 */

export const MOSCOW_OFFSET_MINUTES = 180;

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'previous_7_days'
  | 'last_30_days'
  | 'previous_30_days'
  | 'current_month'
  | 'previous_month';

export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  'today',
  'yesterday',
  'last_7_days',
  'previous_7_days',
  'last_30_days',
  'previous_30_days',
  'current_month',
  'previous_month',
];

export function isPeriodPreset(value: string): value is PeriodPreset {
  return (PERIOD_PRESETS as readonly string[]).includes(value);
}

export interface AnalyticsPeriod extends DateRange {
  /** month — ровно календарный месяц; days — любой другой отрезок. */
  kind: 'days' | 'month';
  /** Пресет, из которого период получен; у произвольных дат пусто. */
  preset: PeriodPreset | null;
}

function monthOf(iso: IsoDate): { year: number; month: number } {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Первый и последний день календарного месяца (month 1..12). */
export function calendarMonth(year: number, month: number): DateRange {
  const from = `${year}-${pad(month)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${year}-${pad(month)}-${pad(lastDay)}` };
}

function isCalendarMonth(range: DateRange): boolean {
  const { year, month } = monthOf(range.from);
  const m = calendarMonth(year, month);
  return m.from === range.from && m.to === range.to;
}

export function customPeriod(from: IsoDate, to: IsoDate): AnalyticsPeriod {
  assertRange({ from, to });
  return {
    from,
    to,
    kind: isCalendarMonth({ from, to }) ? 'month' : 'days',
    preset: null,
  };
}

export function periodFromPreset(
  preset: PeriodPreset,
  now: Date = new Date(),
): AnalyticsPeriod {
  const today = calendarDateIn(now);
  const { year, month } = monthOf(today);
  const withPreset = (
    range: DateRange,
    kind: AnalyticsPeriod['kind'],
  ): AnalyticsPeriod => ({
    ...range,
    kind,
    preset,
  });
  switch (preset) {
    case 'today':
      return withPreset({ from: today, to: today }, 'days');
    case 'yesterday': {
      const y = addDays(today, -1);
      return withPreset({ from: y, to: y }, 'days');
    }
    case 'last_7_days':
      return withPreset({ from: addDays(today, -6), to: today }, 'days');
    case 'previous_7_days':
      return withPreset(
        { from: addDays(today, -13), to: addDays(today, -7) },
        'days',
      );
    case 'last_30_days':
      return withPreset({ from: addDays(today, -29), to: today }, 'days');
    case 'previous_30_days':
      return withPreset(
        { from: addDays(today, -59), to: addDays(today, -30) },
        'days',
      );
    case 'current_month':
      return withPreset(calendarMonth(year, month), 'month');
    case 'previous_month': {
      const prev =
        month === 1
          ? { year: year - 1, month: 12 }
          : { year, month: month - 1 };
      return withPreset(calendarMonth(prev.year, prev.month), 'month');
    }
  }
}

/** Предыдущий период по правилу раздела 19. */
export function previousPeriod(period: AnalyticsPeriod): AnalyticsPeriod {
  if (period.kind === 'month') {
    const { year, month } = monthOf(period.from);
    const prev =
      month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    return {
      ...calendarMonth(prev.year, prev.month),
      kind: 'month',
      preset: null,
    };
  }
  const length = daysBetween(period.from, period.to);
  return {
    from: addDays(period.from, -length),
    to: addDays(period.from, -1),
    kind: 'days',
    preset: null,
  };
}

/**
 * Границы периода как моменты времени: московская полночь начала и
 * московская полночь дня после конца (полуинтервал [start, endExclusive)).
 */
export function periodBoundsUtc(range: DateRange): {
  start: Date;
  endExclusive: Date;
} {
  const offsetMs = MOSCOW_OFFSET_MINUTES * 60_000;
  return {
    start: new Date(isoToUtcDate(range.from).getTime() - offsetMs),
    endExclusive: new Date(
      isoToUtcDate(addDays(range.to, 1)).getTime() - offsetMs,
    ),
  };
}

/** Попадает ли момент времени в период — по московскому календарному дню. */
export function inPeriod(
  at: Date | null | undefined,
  range: DateRange,
): boolean {
  if (!at) return false;
  const day = calendarDateIn(at);
  return day >= range.from && day <= range.to;
}

/** Все дни периода включительно. */
export function periodDays(range: DateRange): number {
  return daysBetween(range.from, range.to);
}

export function describePeriod(p: AnalyticsPeriod): string {
  return `${p.from}..${p.to}${p.preset ? ` (${p.preset})` : ''}`;
}
