/**
 * Период, за который спрашивают.
 *
 * Модель формулирует «за сентябрь», «за последние 30 дней», «вчера» —
 * и если каждый инструмент будет разбирать это по-своему, два ответа
 * на один вопрос разойдутся по датам, а человек этого не заметит.
 * Поэтому разбор один на всех и лежит здесь.
 *
 * Границы включительные по дням: «с 1 по 28 сентября» — это 28 дней,
 * а не 27. Так считает человек, и так должен считать инструмент.
 */

export interface Period {
  /** Начало включительно, ISO-дата. */
  from: string;
  /** Конец включительно, ISO-дата. */
  to: string;
  /** Как это называется словами — уходит в ответ, чтобы период был виден. */
  label: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Сколько дней берём, если период не назвали. */
export const DEFAULT_DAYS = 30;

/** Дальше этого не пускаем: год данных в одном ответе никто не прочитает. */
export const MAX_DAYS = 400;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export class PeriodError extends Error {}

/**
 * Разобрать период. Пусто — последние 30 дней, считая сегодняшний.
 *
 * `now` передаётся параметром, а не берётся из часов: иначе тест на
 * «последние 30 дней» зависел бы от дня запуска и однажды упал бы сам
 * по себе.
 */
export function resolvePeriod(
  input: { from?: string; to?: string } = {},
  now: Date = new Date(),
): Period {
  const rawFrom = input.from?.trim();
  const rawTo = input.to?.trim();

  for (const [name, value] of [
    ['from', rawFrom],
    ['to', rawTo],
  ] as const) {
    if (value && !ISO_DATE.test(value)) {
      throw new PeriodError(
        `Дата ${name}=«${value}» не в формате ГГГГ-ММ-ДД. Пример: 2026-09-01.`,
      );
    }
  }

  const to = rawTo ?? toIsoDate(now);
  const from = rawFrom ?? toIsoDate(shiftDays(new Date(to), -(DEFAULT_DAYS - 1)));

  if (from > to) {
    throw new PeriodError(
      `Начало периода (${from}) позже конца (${to}) — вероятно, даты переставлены местами.`,
    );
  }

  const days =
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
    ) + 1;
  if (days > MAX_DAYS) {
    throw new PeriodError(
      `Период ${days} дней — слишком длинный, потолок ${MAX_DAYS}. Спросите по частям.`,
    );
  }

  return { from, to, label: `${from} … ${to} (${days} дн.)` };
}

/**
 * Границы для SQL: конец — начало следующего дня, чтобы попали заказы,
 * созданные в последний день вечером. Сравнение «< завтра», а не
 * «<= сегодня», — иначе теряется всё после полуночи по времени базы.
 */
export function sqlRange(period: Period): [string, string] {
  const toExclusive = new Date(`${period.to}T00:00:00Z`);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  return [`${period.from}T00:00:00Z`, toExclusive.toISOString()];
}
