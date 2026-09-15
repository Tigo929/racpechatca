import {
  bootstrapMeanDifference,
  fisherExactTwoSided,
  mdeCountRelative,
  mdeProportion,
  newcombeDifference,
  normalApproximationOk,
  normalCdf,
  poissonRateComparison,
  requiredEventsCount,
  requiredSampleProportion,
  twoProportionZ,
  wilsonInterval,
} from './growth-statistics';

/**
 * Контрольные значения посчитаны независимо (Python, math/comb — формулы
 * записаны отдельно от реализации) и сверены с опубликованными примерами:
 * интервал Ньюкомба 56/70 vs 48/80 (Newcombe 1998, метод 10: 0,0524…0,3339),
 * точный тест Фишера на «чайной» таблице 3/4 vs 1/4 (p = 0,4857), требуемая
 * выборка 10 % → 15 % без поправки на непрерывность (686 на группу).
 */

describe('статистика этапа 11: независимые контрольные значения', () => {
  it('нормальное распределение: Φ(1,959964) = 0,975', () => {
    expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 6);
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(-1.959963984540054)).toBeCloseTo(0.025, 6);
  });

  it('интервал Уилсона 5/100 → (0,02154; 0,11175)', () => {
    const w = wilsonInterval(5, 100);
    expect(w.low).toBeCloseTo(0.0215437, 6);
    expect(w.high).toBeCloseTo(0.1117505, 6);
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1, level: 0.95 });
  });

  it('разность долей по Ньюкомбу: 56/70 → 48/80 даёт (−0,3339; −0,0524) — пример из статьи с обратным знаком', () => {
    const ci = newcombeDifference(56, 70, 48, 80);
    expect(ci.low).toBeCloseTo(-0.3338727, 6);
    expect(ci.high).toBeCloseTo(-0.0524315, 6);
    const up = newcombeDifference(5, 100, 15, 100);
    expect(up.low).toBeCloseTo(0.0160042, 6);
    expect(up.high).toBeCloseTo(0.1875871, 6);
  });

  it('z-тест двух долей 5/100 vs 15/100: z = 2,357, p = 0,0184; вырожденные случаи', () => {
    const r = twoProportionZ(5, 100, 15, 100)!;
    expect(r.z).toBeCloseTo(2.3570226, 6);
    expect(r.pValue).toBeCloseTo(0.0184221, 5);
    expect(twoProportionZ(0, 50, 0, 50)).toEqual({ z: 0, pValue: 1 });
    expect(twoProportionZ(0, 0, 1, 10)).toBeNull();
    expect(normalApproximationOk(5, 100, 15, 100)).toBe(true);
    expect(normalApproximationOk(1, 40, 3, 40)).toBe(false);
  });

  it('точный тест Фишера: чайная таблица 3/4 vs 1/4 → p = 0,4857; 0/30 vs 0/30 → 1', () => {
    expect(fisherExactTwoSided(3, 4, 1, 4)).toBeCloseTo(0.4857143, 6);
    expect(fisherExactTwoSided(0, 30, 0, 30)).toBeCloseTo(1, 9);
    // сильный контраст — маленький p
    expect(fisherExactTwoSided(0, 50, 12, 50)).toBeLessThan(0.001);
  });

  it('пуассоновские счётчики 10 → 20 за 7 и 7 дней: RR 2, p = 0,0987, интервал RR (0,952; 4,200)', () => {
    const r = poissonRateComparison(10, 7, 20, 7);
    expect(r.rateRatio).toBeCloseTo(2, 9);
    expect(r.pValue).toBeCloseTo(0.0987371, 6);
    expect(r.ci!.low).toBeCloseTo(0.9523643, 6);
    expect(r.ci!.high).toBeCloseTo(4.2000733, 6);
    expect(poissonRateComparison(0, 7, 0, 7)).toEqual({
      rateRatio: null,
      ci: null,
      pValue: null,
    });
    // разная длительность окон учитывается через q = t1 / (t1 + t2)
    const uneven = poissonRateComparison(10, 14, 10, 7);
    expect(uneven.rateRatio).toBeCloseTo(2, 9);
  });

  it('MDE доли 5 % при 500 / 500 визитах ≈ 3,86 п.п.; требуемая выборка 10 % → +50 % = 686, 5 % → +20 % = 8158', () => {
    expect(mdeProportion(0.05, 500, 500)).toBeCloseTo(0.0386172, 6);
    expect(mdeProportion(0.05, 0, 500)).toBeNull();
    expect(mdeProportion(0, 500, 500)).toBeNull();
    expect(requiredSampleProportion(0.1, 0.5)).toBe(686);
    expect(requiredSampleProportion(0.05, 0.2)).toBe(8158);
    expect(requiredSampleProportion(0, 0.2)).toBeNull();
  });

  it('счётчики: MDE относительное при 100 событиях за 7 дней ≈ 39,6 %; требуемых событий для +20 % — 432', () => {
    expect(mdeCountRelative(100, 7, 7)).toBeCloseTo(0.396204, 5);
    expect(mdeCountRelative(0, 7, 7)).toBeNull();
    expect(requiredEventsCount(0.2)).toBe(432);
  });

  it('бутстрэп детерминирован: одно зерно — один интервал; сдвиг +1000 ₽ даёт интервал без нуля', () => {
    const a = [1200, 1500, 900, 2100, 1800, 1300, 1700, 1600];
    const b = a.map((v) => v + 1000);
    const r1 = bootstrapMeanDifference(a, b)!;
    const r2 = bootstrapMeanDifference(a, b)!;
    expect(r1).toEqual(r2);
    expect(r1.difference).toBeCloseTo(1000, 9);
    expect(r1.ci.low).toBeGreaterThan(0);
    const same = bootstrapMeanDifference(a, [...a].reverse())!;
    expect(same.difference).toBeCloseTo(0, 9);
    expect(same.ci.low).toBeLessThan(0);
    expect(same.ci.high).toBeGreaterThan(0);
    expect(bootstrapMeanDifference([], a)).toBeNull();
  });
});
