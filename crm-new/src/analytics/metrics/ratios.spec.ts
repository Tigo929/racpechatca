import { compare, percent, ratio, round2 } from './ratios';

/** Доли и сравнения (этап 08, разделы 18, 20, 43). */
describe('ratio / percent', () => {
  it('обычная доля', () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(percent(1, 4)).toBe(25);
  });

  it('знаменатель 0 или неизвестен → null, не 0 %, не Infinity, не NaN', () => {
    expect(ratio(5, 0)).toBeNull();
    expect(percent(0, 0)).toBeNull();
    expect(ratio(null, 3)).toBeNull();
    expect(ratio(3, null)).toBeNull();
  });

  it('взвешенная конверсия: день 1/1 и день 1/9 — период 2/10 = 20 %, а не 55,56 %', () => {
    const days = [
      { leads: 1, visits: 1 },
      { leads: 1, visits: 9 },
    ];
    const leads = days.reduce((s, d) => s + d.leads, 0);
    const visits = days.reduce((s, d) => s + d.visits, 0);
    expect(percent(leads, visits)).toBe(20);
    const avgOfDaily =
      days.reduce((s, d) => s + (percent(d.leads, d.visits) ?? 0), 0) /
      days.length;
    expect(round2(avgOfDaily)).toBe(55.56);
    expect(percent(leads, visits)).not.toBe(avgOfDaily);
  });
});

describe('compare', () => {
  it('рост и падение', () => {
    expect(compare(120, 100)).toEqual({
      current: 120,
      previous: 100,
      delta: 20,
      deltaPct: 20,
      changeKind: 'UP',
    });
    expect(compare(80, 100)).toMatchObject({
      delta: -20,
      deltaPct: -20,
      changeKind: 'DOWN',
    });
    expect(compare(100, 100)).toMatchObject({
      delta: 0,
      deltaPct: 0,
      changeKind: 'FLAT',
    });
  });

  it('previous = 0 и current = 0 → 0 %, FLAT', () => {
    expect(compare(0, 0)).toEqual({
      current: 0,
      previous: 0,
      delta: 0,
      deltaPct: 0,
      changeKind: 'FLAT',
    });
  });

  it('previous = 0 и current > 0 → deltaPct null, NEW', () => {
    expect(compare(5, 0)).toEqual({
      current: 5,
      previous: 0,
      delta: 5,
      deltaPct: null,
      changeKind: 'NEW',
    });
  });

  it('current = 0 при previous > 0 → −100 %, GONE', () => {
    expect(compare(0, 8)).toMatchObject({
      delta: -8,
      deltaPct: -100,
      changeKind: 'GONE',
    });
  });

  it('одной из сторон нет (например, нет снимка) → NA', () => {
    expect(compare(null, 10)).toMatchObject({
      delta: null,
      deltaPct: null,
      changeKind: 'NA',
    });
    expect(compare(10, null)).toMatchObject({ changeKind: 'NA' });
  });

  it('round2 — только для показа', () => {
    expect(round2(15.38461538)).toBe(15.38);
    expect(round2(null)).toBeNull();
  });
});
