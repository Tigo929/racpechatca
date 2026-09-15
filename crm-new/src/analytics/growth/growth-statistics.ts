import {
  ALPHA,
  BOOTSTRAP_ITERATIONS,
  BOOTSTRAP_SEED,
  POWER,
  TARGET_RELATIVE_EFFECT,
  Z_ALPHA_TWO_SIDED,
  Z_POWER,
} from './growth-rules';

/**
 * Статистика «до / после» (этап 11, раздел 12) — детерминированные формулы без
 * библиотек, с независимыми контрольными значениями в growth-statistics.spec.ts
 * и описанием в GROWTH_STATISTICS.md.
 *
 *  - доли: Wilson-интервалы, разность по Ньюкомбу (метод 10), z-тест с объединённой
 *    долей, при малых ожидаемых частотах — точный тест Фишера;
 *  - счётчики (визиты, заявки за окно): условный биномиальный точный тест для
 *    отношения пуассоновских интенсивностей, интервал через Wilson;
 *  - средние по заказам: бутстрэп разности средних с фиксированным зерном;
 *  - MDE и требуемая выборка — нормальное приближение при alpha 0,05 / мощности 0,8.
 */

export interface Interval {
  low: number;
  high: number;
  level: number;
}

// ---------------------------------------------------------------------------
// Нормальное распределение

/** Функция ошибок — рациональная аппроксимация (Numerical Recipes erfc, |ε| < 1,2e-7). */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Двусторонний p-value для статистики z. */
export function twoSidedP(z: number): number {
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
}

// ---------------------------------------------------------------------------
// Доли

/** Интервал Уилсона для доли x / n. */
export function wilsonInterval(
  x: number,
  n: number,
  z: number = Z_ALPHA_TWO_SIDED,
): Interval {
  if (n <= 0) return { low: 0, high: 1, level: 1 - ALPHA };
  const p = x / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    low: Math.max(0, centre - half),
    high: Math.min(1, centre + half),
    level: 1 - ALPHA,
  };
}

/** Интервал разности долей p2 − p1 по Ньюкомбу (метод 10, на Wilson-интервалах). */
export function newcombeDifference(
  x1: number,
  n1: number,
  x2: number,
  n2: number,
  z: number = Z_ALPHA_TWO_SIDED,
): Interval {
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const w1 = wilsonInterval(x1, n1, z);
  const w2 = wilsonInterval(x2, n2, z);
  // Для d = p2 − p1: нижняя граница «съедает» нижний хвост p2 и верхний хвост p1, верхняя — наоборот
  // (Newcombe 1998, метод 10; контрольный пример 56/70 → 48/80 в спецификации).
  const d = p2 - p1;
  return {
    low: d - Math.sqrt((p2 - w2.low) ** 2 + (w1.high - p1) ** 2),
    high: d + Math.sqrt((w2.high - p2) ** 2 + (p1 - w1.low) ** 2),
    level: 1 - ALPHA,
  };
}

/** z-тест двух долей с объединённой долей; null — вырожденный случай (все 0 или все 1). */
export function twoProportionZ(
  x1: number,
  n1: number,
  x2: number,
  n2: number,
): { z: number; pValue: number } | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const pooled = (x1 + x2) / (n1 + n2);
  if (pooled <= 0 || pooled >= 1) return { z: 0, pValue: 1 };
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = (x2 / n2 - x1 / n1) / se;
  return { z, pValue: twoSidedP(z) };
}

/** Ожидаемые частоты 2×2 при равных долях — все ≥ 5 → нормальное приближение допустимо. */
export function normalApproximationOk(
  x1: number,
  n1: number,
  x2: number,
  n2: number,
): boolean {
  const p = (x1 + x2) / (n1 + n2);
  return [n1 * p, n1 * (1 - p), n2 * p, n2 * (1 - p)].every((e) => e >= 5);
}

// ---------------------------------------------------------------------------
// Точные тесты

const LN_FACT: number[] = [0, 0];
function lnFact(n: number): number {
  for (let i = LN_FACT.length; i <= n; i++)
    LN_FACT.push(LN_FACT[i - 1] + Math.log(i));
  return LN_FACT[n];
}
function lnChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return lnFact(n) - lnFact(k) - lnFact(n - k);
}

/**
 * Точный тест Фишера для таблицы [[x1, n1−x1], [x2, n2−x2]], двусторонний p —
 * сумма вероятностей всех таблиц с теми же маргиналами, не более вероятных, чем наблюдаемая.
 */
export function fisherExactTwoSided(
  x1: number,
  n1: number,
  x2: number,
  n2: number,
): number {
  const k = x1 + x2;
  const n = n1 + n2;
  const logP = (a: number) =>
    lnChoose(n1, a) + lnChoose(n2, k - a) - lnChoose(n, k);
  const observed = logP(x1);
  let p = 0;
  const lo = Math.max(0, k - n2);
  const hi = Math.min(k, n1);
  for (let a = lo; a <= hi; a++) {
    const lp = logP(a);
    if (lp <= observed + 1e-12) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

/**
 * Пуассоновские счётчики за окна длительностью t1 и t2 дней: при условии X1 + X2 = N
 * X1 ~ Binomial(N, t1 / (t1 + t2)); двусторонний точный p — сумма вероятностей исходов
 * не более вероятных, чем наблюдаемый. Возвращает отношение интенсивностей after / before
 * с интервалом (через Wilson для доли x2 / N).
 */
export function poissonRateComparison(
  x1: number,
  t1: number,
  x2: number,
  t2: number,
): { rateRatio: number | null; ci: Interval | null; pValue: number | null } {
  const N = x1 + x2;
  if (N === 0 || t1 <= 0 || t2 <= 0)
    return { rateRatio: null, ci: null, pValue: null };
  const q = t1 / (t1 + t2);
  const logP = (a: number) =>
    lnChoose(N, a) + a * Math.log(q) + (N - a) * Math.log(1 - q);
  const observed = logP(x1);
  let p = 0;
  for (let a = 0; a <= N; a++) {
    const lp = logP(a);
    if (lp <= observed + 1e-12) p += Math.exp(lp);
  }
  const share = wilsonInterval(x2, N);
  const toRatio = (s: number) =>
    s >= 1 ? Infinity : (s / (1 - s)) * (t1 / t2);
  const rateRatio = x1 === 0 ? null : x2 / t2 / (x1 / t1);
  return {
    rateRatio,
    ci: {
      low: toRatio(share.low),
      high: toRatio(share.high),
      level: 1 - ALPHA,
    },
    pValue: Math.min(1, p),
  };
}

// ---------------------------------------------------------------------------
// MDE и требуемая выборка

/**
 * Минимально обнаружимая абсолютная разница долей при базовой доле p1 и объёмах n1, n2:
 * (z_α + z_β) · sqrt(p1 (1 − p1) (1/n1 + 1/n2)) — нормальное приближение с дисперсией базы.
 */
export function mdeProportion(
  p1: number,
  n1: number,
  n2: number,
  zAlpha: number = Z_ALPHA_TWO_SIDED,
  zPower: number = Z_POWER,
): number | null {
  if (n1 <= 0 || n2 <= 0 || p1 <= 0 || p1 >= 1) return null;
  return (zAlpha + zPower) * Math.sqrt(p1 * (1 - p1) * (1 / n1 + 1 / n2));
}

/**
 * Требуемый объём на окно для относительного эффекта r при базовой доле p1
 * (Флейсс без поправки на непрерывность, равные окна):
 * n = ((z_α sqrt(2 p̄ q̄) + z_β sqrt(p1 q1 + p2 q2)) / (p2 − p1))².
 */
export function requiredSampleProportion(
  p1: number,
  relativeEffect: number = TARGET_RELATIVE_EFFECT,
  zAlpha: number = Z_ALPHA_TWO_SIDED,
  zPower: number = Z_POWER,
): number | null {
  if (p1 <= 0 || p1 >= 1 || relativeEffect <= 0) return null;
  const p2 = Math.min(0.999999, p1 * (1 + relativeEffect));
  const pBar = (p1 + p2) / 2;
  const num =
    zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
    zPower * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((num / (p2 - p1)) ** 2);
}

/**
 * Счётчики: минимально обнаружимое относительное изменение интенсивности при базе
 * λ = x1 / t1 и длительностях t1, t2 дней: (z_α + z_β) · sqrt(λ/t1 + λ/t2) / λ.
 */
export function mdeCountRelative(
  x1: number,
  t1: number,
  t2: number,
  zAlpha: number = Z_ALPHA_TWO_SIDED,
  zPower: number = Z_POWER,
): number | null {
  if (x1 <= 0 || t1 <= 0 || t2 <= 0) return null;
  const lambda = x1 / t1;
  return ((zAlpha + zPower) * Math.sqrt(lambda / t1 + lambda / t2)) / lambda;
}

/** Требуемое число событий в базовом окне для относительного эффекта r: (z_α + z_β)² (2 + r) / r². */
export function requiredEventsCount(
  relativeEffect: number = TARGET_RELATIVE_EFFECT,
  zAlpha: number = Z_ALPHA_TWO_SIDED,
  zPower: number = Z_POWER,
): number {
  return Math.ceil(
    ((zAlpha + zPower) ** 2 * (2 + relativeEffect)) / relativeEffect ** 2,
  );
}

// ---------------------------------------------------------------------------
// Бутстрэп средних (детерминированный)

/** mulberry32 — маленький детерминированный генератор для воспроизводимых интервалов. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Перцентильный бутстрэп-интервал разности средних mean(after) − mean(before). */
export function bootstrapMeanDifference(
  before: number[],
  after: number[],
  iterations: number = BOOTSTRAP_ITERATIONS,
  seed: number = BOOTSTRAP_SEED,
): { difference: number; ci: Interval } | null {
  if (before.length === 0 || after.length === 0) return null;
  const rnd = mulberry32(seed);
  const draw = (arr: number[]) => {
    let s = 0;
    for (let i = 0; i < arr.length; i++)
      s += arr[Math.floor(rnd() * arr.length)];
    return s / arr.length;
  };
  const diffs: number[] = new Array<number>(iterations);
  for (let i = 0; i < iterations; i++) diffs[i] = draw(after) - draw(before);
  diffs.sort((a, b) => a - b);
  const at = (q: number) =>
    diffs[Math.min(iterations - 1, Math.max(0, Math.floor(q * iterations)))];
  return {
    difference: (mean(after) as number) - (mean(before) as number),
    ci: { low: at(ALPHA / 2), high: at(1 - ALPHA / 2), level: 1 - ALPHA },
  };
}

export const STAT_ASSUMPTIONS = {
  alpha: ALPHA,
  power: POWER,
  twoSided: true as const,
};
