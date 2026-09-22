import { BadRequestException } from '@nestjs/common';
import { EnumStatus } from 'src/generated/prisma/enums';
import { calendarDateIn } from 'src/metrika/analytics/metrika-dates';
import { clientPaidAtPatch, parseClientPaidAt } from './paid-at';

/**
 * Первая оплата фиксируется один раз.
 *
 * Сценарии C, D, E из 02_ANALYTICS_DATA_MODEL: первый PAID ставит дату,
 * дальнейшие статусы её не трогают, повторный PAID не перезаписывает.
 *
 * Работа D1 (22.09.2026): к автоматической дате добавилась фактическая —
 * её называет человек, когда знает. Проверяем и её разбор: систему нельзя
 * заставить записать оплату в будущем или раньше самого заказа, а введённый
 * человеком день обязан остаться тем же днём в московском календаре отчётов.
 */
describe('clientPaidAt при смене статуса', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  const first = new Date('2026-09-10T09:30:00Z');

  it('сценарий C: первый переход в PAID ставит дату', () => {
    expect(
      clientPaidAtPatch({ current: null, next: EnumStatus.PAID, now }),
    ).toEqual({
      clientPaidAt: now,
    });
    expect(
      clientPaidAtPatch({ current: undefined, next: EnumStatus.PAID, now }),
    ).toEqual({
      clientPaidAt: now,
    });
  });

  it('сценарий D: последующие статусы дату не трогают', () => {
    for (const next of [
      EnumStatus.READY_FOR_REVIEW,
      EnumStatus.COMPLETED,
      EnumStatus.CANCELLED,
      EnumStatus.IN_PROGRESS,
    ]) {
      expect(clientPaidAtPatch({ current: first, next, now })).toEqual({});
    }
  });

  it('сценарий E: повторный PAID сохраняет первоначальную дату', () => {
    // Заказ вернули в работу и снова оплатили — деньги в первый раз пришли 10-го.
    expect(
      clientPaidAtPatch({ current: first, next: EnumStatus.PAID, now }),
    ).toEqual({});
  });

  it('не-PAID без даты — ничего не ставит', () => {
    for (const next of [
      EnumStatus.NEW,
      EnumStatus.SENT,
      EnumStatus.DONE,
      EnumStatus.COMPLETED,
    ]) {
      expect(clientPaidAtPatch({ current: null, next, now })).toEqual({});
    }
  });

  it('без явного now берёт текущее время', () => {
    const before = Date.now();
    const patch = clientPaidAtPatch({ current: null, next: EnumStatus.PAID });
    expect('clientPaidAt' in patch).toBe(true);
    if ('clientPaidAt' in patch) {
      expect(patch.clientPaidAt.getTime()).toBeGreaterThanOrEqual(before);
    }
  });

  // ── работа D1: фактическая дата ───────────────────────────────────────────

  it('фактическая дата важнее момента подтверждения', () => {
    const actual = new Date('2026-09-12T08:00:00Z');
    expect(
      clientPaidAtPatch({
        current: null,
        next: EnumStatus.PAID,
        explicit: actual,
        now,
      }),
    ).toEqual({ clientPaidAt: actual });
  });

  it('фактическая дата не перезаписывает уже зафиксированную', () => {
    expect(
      clientPaidAtPatch({
        current: first,
        next: EnumStatus.PAID,
        explicit: new Date('2026-09-12T08:00:00Z'),
        now,
      }),
    ).toEqual({});
  });
});

describe('разбор фактической даты оплаты (D1)', () => {
  const createdAt = new Date('2026-09-01T07:00:00Z');
  const now = new Date('2026-09-22T19:00:00Z'); // 22:00 MSK 22.09

  it('полный момент сохраняется как есть', () => {
    const at = parseClientPaidAt('2026-09-20T15:30:00.000Z', {
      createdAt,
      now,
    });
    expect(at.toISOString()).toBe('2026-09-20T15:30:00.000Z');
  });

  it('день без времени — это начало московских суток того же дня', () => {
    const at = parseClientPaidAt('2026-09-20', { createdAt, now });
    // 20.09 00:00 MSK = 19.09 21:00 UTC
    expect(at.toISOString()).toBe('2026-09-19T21:00:00.000Z');
    // и главное: в московском календаре это по-прежнему 20 сентября
    expect(calendarDateIn(at)).toBe('2026-09-20');
  });

  it('граница суток: введённый день не уезжает в соседний', () => {
    for (const day of ['2026-09-15', '2026-09-21', '2026-09-22']) {
      expect(calendarDateIn(parseClientPaidAt(day, { createdAt, now }))).toBe(
        day,
      );
    }
  });

  it('граница месяца: 31 августа остаётся августом, 1 сентября — сентябрём', () => {
    const august = parseClientPaidAt('2026-08-31', {
      createdAt: new Date('2026-08-01T00:00:00Z'),
      now,
    });
    const september = parseClientPaidAt('2026-09-01', {
      createdAt: new Date('2026-08-01T00:00:00Z'),
      now,
    });
    expect(calendarDateIn(august)).toBe('2026-08-31');
    expect(calendarDateIn(september)).toBe('2026-09-01');
    // между ними ровно одни сутки — ни одна дата не «потерялась»
    expect(september.getTime() - august.getTime()).toBe(24 * 3600 * 1000);
  });

  it('дата в будущем не принимается', () => {
    expect(() => parseClientPaidAt('2026-09-23', { createdAt, now })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseClientPaidAt('2026-09-22T23:59:00.000Z', { createdAt, now }),
    ).toThrow(/будущем/);
  });

  it('дата раньше создания заказа не принимается', () => {
    expect(() => parseClientPaidAt('2026-08-30', { createdAt, now })).toThrow(
      /раньше создания заказа/,
    );
  });

  it('день создания заказа принимается (граница включительно не нарушена)', () => {
    // заказ создан 01.09 10:00 MSK — оплата тем же днём возможна только не раньше него
    expect(() => parseClientPaidAt('2026-09-01', { createdAt, now })).toThrow(
      /раньше создания заказа/,
    );
    const at = parseClientPaidAt('2026-09-01T09:00:00.000Z', {
      createdAt,
      now,
    });
    expect(at.toISOString()).toBe('2026-09-01T09:00:00.000Z');
  });

  it('мусор вместо даты — понятная ошибка, а не Invalid Date в базе', () => {
    for (const bad of ['вчера', '21.09.2026', '2026-13-40', '']) {
      expect(() => parseClientPaidAt(bad, { createdAt, now })).toThrow(
        BadRequestException,
      );
    }
  });
});
