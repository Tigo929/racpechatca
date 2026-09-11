import { resolveFirstPaidAt } from './paid-at-resolver';

describe('первая оплата из StatusHistory', () => {
  const d = (s: string) => new Date(s);

  it('один переход в PAID — его дата', () => {
    expect(
      resolveFirstPaidAt([
        { toStatus: 'NEW', createdAt: d('2026-07-01T10:00:00Z') },
        { toStatus: 'PAID', createdAt: d('2026-07-03T12:00:00Z') },
        { toStatus: 'COMPLETED', createdAt: d('2026-07-05T09:00:00Z') },
      ]),
    ).toEqual(d('2026-07-03T12:00:00Z'));
  });

  it('несколько переходов в PAID — берётся самый ранний, порядок строк не важен', () => {
    expect(
      resolveFirstPaidAt([
        { toStatus: 'PAID', createdAt: d('2026-08-20T10:00:00Z') },
        { toStatus: 'IN_PROGRESS', createdAt: d('2026-08-18T10:00:00Z') },
        { toStatus: 'PAID', createdAt: d('2026-08-10T10:00:00Z') },
      ]),
    ).toEqual(d('2026-08-10T10:00:00Z'));
  });

  it('нет PAID — null, даже если заказ сейчас закрыт', () => {
    expect(
      resolveFirstPaidAt([
        { toStatus: 'NEW', createdAt: d('2026-07-01T10:00:00Z') },
        { toStatus: 'SENT', createdAt: d('2026-07-02T10:00:00Z') },
        { toStatus: 'COMPLETED', createdAt: d('2026-07-05T09:00:00Z') },
      ]),
    ).toBeNull();
    expect(resolveFirstPaidAt([])).toBeNull();
  });
});
