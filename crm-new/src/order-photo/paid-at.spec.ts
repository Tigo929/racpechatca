import { EnumStatus } from 'src/generated/prisma/enums';
import { clientPaidAtPatch } from './paid-at';

/**
 * Первая оплата фиксируется один раз.
 *
 * Сценарии C, D, E из 02_ANALYTICS_DATA_MODEL: первый PAID ставит дату,
 * дальнейшие статусы её не трогают, повторный PAID не перезаписывает.
 */
describe('clientPaidAt при смене статуса', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  const first = new Date('2026-09-10T09:30:00Z');

  it('сценарий C: первый переход в PAID ставит дату', () => {
    expect(clientPaidAtPatch({ current: null, next: EnumStatus.PAID, now })).toEqual({
      clientPaidAt: now,
    });
    expect(clientPaidAtPatch({ current: undefined, next: EnumStatus.PAID, now })).toEqual({
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
    expect(clientPaidAtPatch({ current: first, next: EnumStatus.PAID, now })).toEqual({});
  });

  it('не-PAID без даты — ничего не ставит', () => {
    for (const next of [EnumStatus.NEW, EnumStatus.SENT, EnumStatus.DONE, EnumStatus.COMPLETED]) {
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
});
