/**
 * Арифметика метрик (этап 08, разделы 18, 20, 41).
 *
 * Любая доля считается из итогов периода, никогда — как среднее дневных
 * долей: день с 1/1 и день с 1/9 дают 2/10 = 20 %, а не 55,56 %. Нулевой
 * знаменатель — это отсутствие ответа (null), а не 0 %, не бесконечность
 * и не NaN. Значения хранятся с полной точностью; округление — только на
 * отображении (проценты и деньги — два знака, счётчики — целые).
 */

/** numerator / denominator; знаменатель 0 или неизвестен → null. */
export function ratio(
  numerator: number | null,
  denominator: number | null,
): number | null {
  if (numerator === null || denominator === null || denominator === 0)
    return null;
  return numerator / denominator;
}

/** Доля в процентах (0..100), с той же семантикой null. */
export function percent(
  numerator: number | null,
  denominator: number | null,
): number | null {
  const r = ratio(numerator, denominator);
  return r === null ? null : r * 100;
}

export type ChangeKind = 'UP' | 'DOWN' | 'FLAT' | 'NEW' | 'GONE' | 'NA';

export interface Comparison {
  current: number | null;
  previous: number | null;
  /** current − previous; null, если одной из сторон нет. */
  delta: number | null;
  /** (current − previous) / previous × 100; previous = 0 → см. changeKind. */
  deltaPct: number | null;
  changeKind: ChangeKind;
}

/**
 * Сравнение с предыдущим периодом. previous = 0 и current = 0 → FLAT, 0 %;
 * previous = 0 и current > 0 → NEW без процента (делить не на что);
 * current = 0 при previous > 0 → GONE, −100 %.
 */
export function compare(
  current: number | null,
  previous: number | null,
): Comparison {
  if (current === null || previous === null) {
    return { current, previous, delta: null, deltaPct: null, changeKind: 'NA' };
  }
  const delta = current - previous;
  if (previous === 0) {
    if (current === 0)
      return { current, previous, delta: 0, deltaPct: 0, changeKind: 'FLAT' };
    return { current, previous, delta, deltaPct: null, changeKind: 'NEW' };
  }
  const deltaPct = (delta / previous) * 100;
  const changeKind: ChangeKind =
    delta === 0 ? 'FLAT' : current === 0 ? 'GONE' : delta > 0 ? 'UP' : 'DOWN';
  return { current, previous, delta, deltaPct, changeKind };
}

/** Округление только для показа: проценты и деньги — 2 знака. */
export function round2(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}
