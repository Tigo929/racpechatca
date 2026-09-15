import {
  addDays,
  calendarDateIn,
  daysBetween,
  eachDay,
  isoToUtcDate,
  type IsoDate,
} from '../../metrika/analytics/metrika-dates';
import {
  customPeriod,
  MOSCOW_OFFSET_MINUTES,
} from '../metrics/analytics-period';
import type {
  ComparabilityCode,
  EvaluationWindows,
  GrowthMetricDefinition,
  MetricComparability,
  WindowFlag,
} from './growth-contract';
import { EVALUATION_DAYS_OPTIONS, MAX_AUTO_WINDOW_DAYS } from './growth-rules';

/**
 * Окна сравнения (этап 11, разделы 8–9): равные по длине окна «до» и «после»
 * из полных московских дней, день cutover исключён (если изменение вышло не в
 * полночь), состав дней недели сравнивается, а сопоставимость метрики
 * проверяется по её дате доступности и датам смены определения — тот же
 * принцип `measuredFrom` / `transition`, что в этапе 10.
 */

export interface WindowInput {
  /** Момент выхода изменения в production (UTC). */
  startedAt: Date;
  /** Конец действия изменения (UTC) — окно «после» не выходит за него. */
  endedAt: Date | null;
  /** Заданная длина окна (7/14/21/28) или null — авто по доступным дням. */
  evaluationDays: number | null;
  /** «Сейчас» — последний полный день = вчера по Москве. */
  now: Date;
  /** Последний день, за который есть синхронизированные данные (null — не ограничивать). */
  lastDataDay?: IsoDate | null;
}

/** Календарный день cutover по Москве и признак «изменение вышло ровно в 00:00 MSK». */
export function cutoverDayOf(startedAt: Date): {
  day: IsoDate;
  isFullDay: boolean;
} {
  const day = calendarDateIn(startedAt);
  const midnightUtc =
    isoToUtcDate(day).getTime() - MOSCOW_OFFSET_MINUTES * 60_000;
  return { day, isFullDay: startedAt.getTime() === midnightUtc };
}

/** 0 = понедельник … 6 = воскресенье (ISO). */
export function weekdayOf(iso: IsoDate): number {
  return (isoToUtcDate(iso).getUTCDay() + 6) % 7;
}

export function weekdayMix(from: IsoDate, to: IsoDate): number[] {
  const mix = [0, 0, 0, 0, 0, 0, 0];
  for (const d of eachDay(from, to)) mix[weekdayOf(d)] += 1;
  return mix;
}

/** Последний полный московский день: вчера относительно `now`, не позже последнего дня с данными. */
export function observationCutoffOf(
  now: Date,
  lastDataDay: IsoDate | null | undefined,
): IsoDate {
  const yesterday = addDays(calendarDateIn(now), -1);
  return lastDataDay && lastDataDay < yesterday ? lastDataDay : yesterday;
}

/**
 * Строит окна. Возвращает null, если после cutover ещё нет ни одного полного дня.
 * Авто-длина: наибольшая из целых недель (28/21/14/7), помещающаяся в доступные
 * дни «после»; меньше 7 дней — окно равно доступным дням и помечено SHORT_WINDOW.
 */
export function buildWindows(input: WindowInput): EvaluationWindows | null {
  const flags: WindowFlag[] = [];
  const cutover = cutoverDayOf(input.startedAt);
  const observationCutoff = observationCutoffOf(input.now, input.lastDataDay);
  const cutoverDayExcluded = !cutover.isFullDay;
  if (cutoverDayExcluded) flags.push('EXCLUDED_CUTOVER_DAY');

  const afterFrom = cutoverDayExcluded ? addDays(cutover.day, 1) : cutover.day;
  let lastAfterDay = observationCutoff;
  if (input.endedAt) {
    // Последний полный день действия — день до окончания: день окончания либо
    // неполный (изменение выключили днём), либо уже не под изменением (ровно в полночь).
    const endFull = addDays(calendarDateIn(input.endedAt), -1);
    if (endFull < lastAfterDay) {
      lastAfterDay = endFull;
      flags.push('AFTER_WINDOW_TRUNCATED_BY_END');
    }
  }
  const availableAfter = daysBetween(afterFrom, lastAfterDay);
  if (availableAfter <= 0) return null;

  let days: number;
  if (input.evaluationDays && input.evaluationDays > 0) {
    days = Math.min(input.evaluationDays, availableAfter);
    if (days < input.evaluationDays) flags.push('SHORT_WINDOW');
  } else {
    const weeks = [...EVALUATION_DAYS_OPTIONS]
      .filter((d) => d <= Math.min(availableAfter, MAX_AUTO_WINDOW_DAYS))
      .sort((a, b) => b - a);
    days = weeks[0] ?? availableAfter;
    if (weeks.length === 0) flags.push('SHORT_WINDOW');
  }

  const afterTo = addDays(afterFrom, days - 1);
  // «До» заканчивается накануне дня cutover: сам день либо исключён, либо уже «после».
  const beforeTo = addDays(cutover.day, -1);
  const beforeFrom = addDays(beforeTo, -(days - 1));
  const mix = {
    before: weekdayMix(beforeFrom, beforeTo),
    after: weekdayMix(afterFrom, afterTo),
  };
  if (mix.before.some((n, i) => n !== mix.after[i]))
    flags.push('WEEKDAY_MIX_MISMATCH');

  return {
    cutoverDay: cutover.day,
    cutoverDayExcluded,
    before: customPeriod(beforeFrom, beforeTo),
    after: customPeriod(afterFrom, afterTo),
    days,
    observationCutoff,
    weekdayMix: mix,
    flags,
  };
}

/**
 * Сопоставимость метрики в окнах: измерена ли она целиком в обоих окнах в
 * одном определении. Дата смены определения внутри [before.from, after.to]
 * делает окна несопоставимыми — «до» и «после» считают разное.
 */
export function metricComparability(
  def: Pick<
    GrowthMetricDefinition,
    'availableFrom' | 'definitionCutovers' | 'label'
  >,
  windows: Pick<EvaluationWindows, 'before' | 'after'>,
): MetricComparability {
  const codes: ComparabilityCode[] = [];
  const from = def.availableFrom;
  const measuredFrom = {
    before: from && from > windows.before.from ? from : windows.before.from,
    after: from && from > windows.after.from ? from : windows.after.from,
  };
  if (from && from > windows.before.to) codes.push('METRIC_UNAVAILABLE_BEFORE');
  else if (from && from > windows.before.from)
    codes.push('PARTIAL_MEASUREMENT_PERIOD');
  if (from && from > windows.after.to) codes.push('METRIC_UNAVAILABLE_AFTER');
  else if (from && from > windows.after.from && from <= windows.after.to)
    codes.push('PARTIAL_MEASUREMENT_PERIOD');
  const cutoversInside = def.definitionCutovers.filter(
    (c) => c > windows.before.from && c <= windows.after.to,
  );
  if (cutoversInside.length > 0) codes.push('MEASUREMENT_DEFINITION_CHANGED');
  const unique = [...new Set(codes)];
  const comparable =
    !unique.includes('MEASUREMENT_DEFINITION_CHANGED') &&
    !unique.includes('METRIC_UNAVAILABLE_BEFORE') &&
    !unique.includes('METRIC_UNAVAILABLE_AFTER') &&
    !unique.includes('PARTIAL_MEASUREMENT_PERIOD');
  if (!comparable) unique.push('INCOMPARABLE_WINDOWS');
  const note = comparable
    ? null
    : cutoversInside.length > 0
      ? `Определение метрики «${def.label}» изменилось ${cutoversInside.map(fmtDate).join(', ')} — окна «до» и «после» считают разное, разница не является эффектом изменения.`
      : from && from > windows.before.from
        ? `Метрика «${def.label}» измеряется с ${fmtDate(from)}: окно «до» покрыто не целиком, сравнивать окна нельзя.`
        : `Метрика «${def.label}» недоступна в одном из окон.`;
  return {
    comparable,
    codes: [...new Set(unique)],
    measuredFrom,
    cutoversInside,
    note,
  };
}

export function fmtDate(iso: IsoDate): string {
  return iso.split('-').reverse().join('.');
}
