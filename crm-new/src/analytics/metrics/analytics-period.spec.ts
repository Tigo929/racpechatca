import {
  calendarMonth,
  customPeriod,
  inPeriod,
  periodBoundsUtc,
  periodDays,
  periodFromPreset,
  previousPeriod,
} from './analytics-period';

/**
 * Периоды (этап 08, разделы 5, 9, 19, 45): границы по Москве, пресеты,
 * предыдущий период той же длины или предыдущий календарный месяц.
 */
describe('пресеты периода (сейчас — 12.09.2026 21:30 UTC = 13.09 00:30 по Москве)', () => {
  const now = new Date('2026-09-12T21:30:00.000Z');

  it.each([
    ['today', '2026-09-13', '2026-09-13'],
    ['yesterday', '2026-09-12', '2026-09-12'],
    ['last_7_days', '2026-09-07', '2026-09-13'],
    ['previous_7_days', '2026-08-31', '2026-09-06'],
    ['last_30_days', '2026-08-15', '2026-09-13'],
    ['previous_30_days', '2026-07-16', '2026-08-14'],
    ['current_month', '2026-09-01', '2026-09-30'],
    ['previous_month', '2026-08-01', '2026-08-31'],
  ] as const)('%s → %s..%s', (preset, from, to) => {
    const p = periodFromPreset(preset, now);
    expect(p.from).toBe(from);
    expect(p.to).toBe(to);
    expect(p.preset).toBe(preset);
    expect(p.kind).toBe(preset.endsWith('month') ? 'month' : 'days');
  });

  it('previous_month в январе — декабрь прошлого года', () => {
    const p = periodFromPreset(
      'previous_month',
      new Date('2027-01-10T10:00:00.000Z'),
    );
    expect(p).toMatchObject({
      from: '2026-12-01',
      to: '2026-12-31',
      kind: 'month',
    });
  });
});

describe('предыдущий период', () => {
  it('для 7 дней — 7 дней сразу перед началом', () => {
    const prev = previousPeriod(customPeriod('2026-09-06', '2026-09-12'));
    expect(prev).toMatchObject({
      from: '2026-08-30',
      to: '2026-09-05',
      kind: 'days',
      preset: null,
    });
    expect(periodDays(prev)).toBe(7);
  });

  it('для одного дня — предыдущий день', () => {
    expect(
      previousPeriod(customPeriod('2026-09-12', '2026-09-12')),
    ).toMatchObject({ from: '2026-09-11', to: '2026-09-11' });
  });

  it('для календарного месяца — предыдущий календарный месяц, а не 31 день назад', () => {
    expect(
      previousPeriod(customPeriod('2026-08-01', '2026-08-31')),
    ).toMatchObject({ from: '2026-07-01', to: '2026-07-31', kind: 'month' });
    expect(
      previousPeriod(customPeriod('2026-03-01', '2026-03-31')),
    ).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(
      previousPeriod(customPeriod('2026-01-01', '2026-01-31')),
    ).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('произвольные даты, случайно совпавшие с месяцем, считаются месяцем', () => {
    expect(customPeriod('2026-08-01', '2026-08-31').kind).toBe('month');
    expect(customPeriod('2026-08-01', '2026-08-30').kind).toBe('days');
  });

  it('calendarMonth знает длину месяцев', () => {
    expect(calendarMonth(2026, 2)).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(calendarMonth(2028, 2)).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });
});

describe('границы периода по Москве', () => {
  it('полуинтервал — московские полуночи в UTC', () => {
    const b = periodBoundsUtc({ from: '2026-09-12', to: '2026-09-12' });
    expect(b.start.toISOString()).toBe('2026-09-11T21:00:00.000Z');
    expect(b.endExclusive.toISOString()).toBe('2026-09-12T21:00:00.000Z');
  });

  it('20:59:59 UTC и 21:00:00 UTC попадают в разные московские дни', () => {
    const day12 = customPeriod('2026-09-12', '2026-09-12');
    const day13 = customPeriod('2026-09-13', '2026-09-13');
    const before = new Date('2026-09-12T20:59:59.999Z');
    const after = new Date('2026-09-12T21:00:00.000Z');
    expect(inPeriod(before, day12)).toBe(true);
    expect(inPeriod(before, day13)).toBe(false);
    expect(inPeriod(after, day12)).toBe(false);
    expect(inPeriod(after, day13)).toBe(true);
    expect(inPeriod(null, day12)).toBe(false);
  });
});
