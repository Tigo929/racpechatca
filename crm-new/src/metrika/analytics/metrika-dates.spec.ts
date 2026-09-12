import {
  addDays,
  assertRange,
  calendarDateIn,
  daysBetween,
  eachDay,
  isIsoDate,
  isoToUtcDate,
  rollingWindow,
  utcDateToIso,
} from './metrika-dates';

/**
 * Границы суток Метрики (этап 07, раздел 17): счётчик живёт в
 * Europe/Moscow, и 21:00 UTC — это уже следующий календарный день.
 */
describe('calendarDateIn (Europe/Moscow)', () => {
  it('21:00:00 UTC — уже следующий день по Москве', () => {
    expect(calendarDateIn(new Date('2026-09-12T21:00:00.000Z'))).toBe(
      '2026-09-13',
    );
  });

  it('20:59:59 UTC — ещё тот же день', () => {
    expect(calendarDateIn(new Date('2026-09-12T20:59:59.999Z'))).toBe(
      '2026-09-12',
    );
  });

  it('полночь UTC — тот же день (03:00 по Москве)', () => {
    expect(calendarDateIn(new Date('2026-09-12T00:00:00.000Z'))).toBe(
      '2026-09-12',
    );
  });

  it('переход года: 31.12 21:00 UTC — 1 января по Москве', () => {
    expect(calendarDateIn(new Date('2026-12-31T21:00:00.000Z'))).toBe(
      '2027-01-01',
    );
  });
});

describe('даты DATE ↔ строка', () => {
  it('строка → полночь UTC → та же строка, независимо от пояса машины', () => {
    const d = isoToUtcDate('2026-09-12');
    expect(d.toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(utcDateToIso(d)).toBe('2026-09-12');
  });

  it('isIsoDate принимает только настоящие даты', () => {
    expect(isIsoDate('2026-09-12')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('12.09.2026')).toBe(false);
    expect(isIsoDate('2026-9-1')).toBe(false);
  });

  it('addDays переходит через месяц и год', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('daysBetween и eachDay включают обе границы', () => {
    expect(daysBetween('2026-09-06', '2026-09-12')).toBe(7);
    expect(eachDay('2026-09-11', '2026-09-13')).toEqual([
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
  });
});

describe('rollingWindow', () => {
  it('3 дня в 21:30 UTC — окно заканчивается завтрашним по UTC числом (сегодня по Москве)', () => {
    expect(rollingWindow(3, new Date('2026-09-12T21:30:00.000Z'))).toEqual({
      from: '2026-09-11',
      to: '2026-09-13',
    });
  });

  it('21 день', () => {
    expect(rollingWindow(21, new Date('2026-09-12T10:00:00.000Z'))).toEqual({
      from: '2026-08-23',
      to: '2026-09-12',
    });
  });
});

describe('assertRange', () => {
  it('отвергает перевёрнутый и неверный период', () => {
    expect(() => assertRange({ from: '2026-09-13', to: '2026-09-12' })).toThrow(
      'позже конца',
    );
    expect(() => assertRange({ from: '2026-09-1', to: '2026-09-12' })).toThrow(
      'YYYY-MM-DD',
    );
    expect(() =>
      assertRange({ from: '2026-09-12', to: '2026-09-12' }),
    ).not.toThrow();
  });
});
