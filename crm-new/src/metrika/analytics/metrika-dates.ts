/**
 * Календарные даты Метрики (этап 07, раздел 17).
 *
 * Метрика режет сутки по часовому поясу счётчика — Europe/Moscow (+03:00).
 * Reports API отдаёт и принимает даты уже как календарные строки
 * `YYYY-MM-DD` в этом поясе, поэтому единственное место, где мы переводим
 * момент времени в дату, — «какое сегодня число по Москве» для скользящего
 * окна расписания. 21:00 UTC — это уже завтра по Москве.
 *
 * В базе такие даты лежат в колонках `DATE`: это «календарная дата Метрики
 * в поясе счётчика», а не момент времени. Prisma отдаёт `DATE` как Date
 * на полуночи UTC — обратно в строку он переводится только через UTC-поля,
 * иначе локальный пояс машины сдвинет число.
 */

export const COUNTER_TIME_ZONE = 'Europe/Moscow';

export type IsoDate = string; // YYYY-MM-DD

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = isoToUtcDate(value);
  return !Number.isNaN(d.getTime()) && utcDateToIso(d) === value;
}

/** Календарная дата момента `at` в поясе `timeZone`. */
export function calendarDateIn(
  at: Date,
  timeZone: string = COUNTER_TIME_ZONE,
): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Строка `YYYY-MM-DD` → Date на полуночи UTC (так `DATE` хранит Prisma). */
export function isoToUtcDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Date на полуночи UTC (из колонки `DATE`) → `YYYY-MM-DD`. */
export function utcDateToIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = isoToUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateToIso(d);
}

/** Число календарных дней в диапазоне включительно. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return (
    Math.round(
      (isoToUtcDate(to).getTime() - isoToUtcDate(from).getTime()) / 86_400_000,
    ) + 1
  );
}

/** Все даты диапазона включительно, по порядку. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/**
 * Скользящее окно из `days` дней, заканчивающееся сегодняшним московским
 * числом: последние 3 дня — это сегодня, вчера и позавчера.
 */
export function rollingWindow(days: number, now: Date = new Date()): DateRange {
  const to = calendarDateIn(now);
  return { from: addDays(to, -(days - 1)), to };
}

export function assertRange(range: DateRange): void {
  if (!isIsoDate(range.from) || !isIsoDate(range.to)) {
    throw new Error(
      `Даты должны быть в формате YYYY-MM-DD: ${range.from}..${range.to}`,
    );
  }
  if (range.from > range.to) {
    throw new Error(`Начало периода позже конца: ${range.from}..${range.to}`);
  }
}
