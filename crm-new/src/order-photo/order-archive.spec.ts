import {
  buildOrderSnapshot,
  DEFAULT_RETENTION_DAYS,
  daysLeft,
  pickKnownFields,
  purgeAfterFrom,
  restoreBlock,
  restorePayload,
  retentionDays,
  SNAPSHOT_VERSION,
} from './order-archive';

/**
 * Правила корзины удалённых заказов.
 *
 * Удаление теперь обратимо, и именно здесь решается, что именно вернётся.
 * Ошибка в этих функциях либо теряет заказ навсегда, либо возвращает уже
 * выплаченное начисление — поэтому проверяется каждое правило.
 */
describe('корзина удалённых заказов: срок хранения', () => {
  it('по умолчанию 30 дней', () => {
    expect(retentionDays(undefined)).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays('')).toBe(DEFAULT_RETENTION_DAYS);
  });

  it('читает заданное значение', () => {
    expect(retentionDays('7')).toBe(7);
    expect(retentionDays(' 45 ')).toBe(45);
  });

  it('непонятное значение не обнуляет срок', () => {
    // Ноль или мусор означали бы «чистить сразу» — ровно та потеря данных,
    // от которой корзина и защищает.
    expect(retentionDays('ерунда')).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays('0')).toBe(DEFAULT_RETENTION_DAYS);
    expect(retentionDays('-5')).toBe(DEFAULT_RETENTION_DAYS);
  });

  it('обрезает по потолку: опечатка не должна хранить годами', () => {
    expect(retentionDays('3650')).toBe(365);
  });

  it('считает момент очистки от даты удаления', () => {
    const deletedAt = new Date('2026-10-01T10:00:00Z');
    expect(purgeAfterFrom(deletedAt, 30).toISOString()).toBe(
      '2026-10-31T10:00:00.000Z',
    );
  });
});

describe('корзина: сколько дней осталось', () => {
  it('округляет вверх — остаток дня это ещё день', () => {
    const now = new Date('2026-10-20T23:00:00Z');
    // Девять часов в запасе: показать «0 дней» значило бы показать запись
    // просроченной, хотя вернуть заказ ещё можно.
    expect(daysLeft(new Date('2026-10-21T08:00:00Z'), now)).toBe(1);
  });

  it('просроченная запись — ноль, а не отрицательное число', () => {
    const now = new Date('2026-10-20T00:00:00Z');
    expect(daysLeft(new Date('2026-10-01T00:00:00Z'), now)).toBe(0);
  });

  it('без срока — ничего не показываем', () => {
    expect(daysLeft(null, new Date())).toBeNull();
  });
});

describe('корзина: что мешает вернуть заказ', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const fresh = {
    restoredAt: null,
    snapshot: { version: SNAPSHOT_VERSION },
    purgeAfter: new Date('2026-11-01T00:00:00Z'),
    purgedAt: null,
  };

  it('свежая запись со снимком — возврат возможен', () => {
    expect(restoreBlock(fresh, now)).toBeNull();
  });

  it('уже восстановленная — возврат одноразовый', () => {
    expect(restoreBlock({ ...fresh, restoredAt: now }, now)).toBe(
      'already-restored',
    );
  });

  it('вычищенная по сроку', () => {
    expect(restoreBlock({ ...fresh, snapshot: null, purgedAt: now }, now)).toBe(
      'expired',
    );
  });

  it('срок вышел, но воркер ещё не дошёл', () => {
    // Снимок физически ещё на месте, но отдавать его уже нельзя: срок
    // хранения — обещание клиенту, а не расписание воркера.
    expect(
      restoreBlock(
        { ...fresh, purgeAfter: new Date('2026-10-19T00:00:00Z') },
        now,
      ),
    ).toBe('expired');
  });

  it('запись до появления корзины — снимка не было вовсе', () => {
    expect(
      restoreBlock({ ...fresh, snapshot: null, purgeAfter: null }, now),
    ).toBe('no-snapshot');
  });

  it('«уже восстановлен» важнее отсутствующего снимка', () => {
    // После возврата снимок стирается. Без этого порядка проверок человек
    // увидел бы «снимка нет» вместо «заказ уже у вас».
    expect(
      restoreBlock({ ...fresh, restoredAt: now, snapshot: null }, now),
    ).toBe('already-restored');
  });
});

describe('корзина: отбор известных полей', () => {
  it('оставляет null и выбрасывает undefined', () => {
    // null — осмысленное значение колонки («исполнителя нет»), undefined
    // означает «не передавать», и Prisma подставила бы значение по
    // умолчанию вместо снятого.
    const picked = pickKnownFields({ a: null, b: undefined, c: 1 }, [
      'a',
      'b',
      'c',
    ]);
    expect(picked).toEqual({ a: null, c: 1 });
    expect('b' in picked).toBe(false);
  });

  it('выбрасывает всё, чего нет в списке колонок', () => {
    expect(pickKnownFields({ a: 1, lishnee: 2 }, ['a'])).toEqual({ a: 1 });
  });

  it('не падает на пустом входе', () => {
    expect(pickKnownFields(null, ['a'])).toEqual({});
    expect(pickKnownFields('строка', ['a'])).toEqual({});
  });
});

describe('корзина: снимок заказа', () => {
  const order = {
    id: 'order-1',
    numberOrder: '20261020-015',
    status: 'LEAD',
    totalOrder: 7600,
    deadline: new Date('2026-10-23T12:00:00.000Z'),
    // Срок считает сама база, писать в эту колонку нельзя.
    deadlineEffective: new Date('2026-10-23T12:00:00.000Z'),
    // Связи и вычисленные поля в снимок попадать не должны: при возврате
    // Prisma не знает, что с ними делать.
    executor: { id: 'u1', username: 'Петя' },
    items: [{ id: 'i1', orderId: 'order-1', quantity: 10, lishnee: 'x' }],
    tshirtItems: [],
    canvasItems: [],
    statusHistory: [{ id: 'h1', orderId: 'order-1', toStatus: 'LEAD' }],
    assignments: [],
    accruals: [
      { id: 'a1', executorId: 'u1', salaryAmount: 100, paymentLinks: [] },
      {
        id: 'a2',
        executorId: 'u1',
        salaryAmount: 200,
        paymentLinks: [{ id: 'p1' }],
      },
    ],
  };

  it('сохраняет колонки заказа и выбрасывает связи', () => {
    const snapshot = buildOrderSnapshot(order);
    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.order.numberOrder).toBe('20261020-015');
    expect(snapshot.order.totalOrder).toBe(7600);
    expect('executor' in snapshot.order).toBe(false);
    expect('items' in snapshot.order).toBe(false);
  });

  it('колонку, которую считает база, в снимок не кладём', () => {
    // Postgres отказывается принимать значение в generated column, и
    // возврат заказа падал с «cannot insert a non-DEFAULT value».
    // Заданный вручную срок при этом обязан сохраниться: из него база
    // посчитает колонку заново.
    const snapshot = buildOrderSnapshot(order);
    expect('deadlineEffective' in snapshot.order).toBe(false);
    expect(snapshot.order.deadline).toEqual(
      new Date('2026-10-23T12:00:00.000Z'),
    );
  });

  it('сохраняет позиции, историю и чистит лишние поля', () => {
    const snapshot = buildOrderSnapshot(order);
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toEqual(
      expect.objectContaining({ id: 'i1', quantity: 10 }),
    );
    expect('lishnee' in snapshot.items[0]).toBe(false);
    expect(snapshot.statusHistory).toHaveLength(1);
  });

  it('помечает начисления, по которым уже платили', () => {
    const snapshot = buildOrderSnapshot(order);
    expect(snapshot.accruals.map((a) => a.hadPayment)).toEqual([false, true]);
  });

  it('не падает на заказе без связей', () => {
    const snapshot = buildOrderSnapshot({ id: 'order-2' });
    expect(snapshot.items).toEqual([]);
    expect(snapshot.accruals).toEqual([]);
  });
});

describe('корзина: разбор снимка для возврата', () => {
  const snapshot = buildOrderSnapshot({
    id: 'order-1',
    numberOrder: '20261020-015',
    status: 'NEW',
    items: [{ id: 'i1', orderId: 'order-1', quantity: 10 }],
    tshirtItems: [],
    canvasItems: [],
    statusHistory: [],
    assignments: [],
    accruals: [
      { id: 'a1', executorId: 'u1', salaryAmount: 100, paymentLinks: [] },
      {
        id: 'a2',
        executorId: 'u1',
        salaryAmount: 200,
        paymentLinks: [{ id: 'p1' }],
      },
    ],
  });

  it('возвращает заказ, позиции и непривязанный к выплатам расчёт', () => {
    const payload = restorePayload(snapshot);
    expect(payload.order.id).toBe('order-1');
    expect(payload.items).toHaveLength(1);
  });

  it('выплаченное начисление не воссоздаётся', () => {
    // Платёжные связи удалились вместе с заказом, а сами выплаты — нет.
    // Вернуть начисление без связи значило бы показать его невыплаченным
    // и заплатить второй раз.
    const payload = restorePayload(snapshot);
    expect(payload.accruals).toHaveLength(1);
    expect(payload.accruals[0].id).toBe('a1');
    expect(payload.skippedPaidAccruals).toBe(1);
  });

  it('привязывает связанные строки к заказу из снимка', () => {
    const payload = restorePayload(snapshot);
    expect(payload.items[0].orderId).toBe('order-1');
    expect(payload.accruals[0].orderId).toBe('order-1');
  });

  it('служебное поле hadPayment в базу не уходит', () => {
    const payload = restorePayload(snapshot);
    expect('hadPayment' in payload.accruals[0]).toBe(false);
  });

  it('снимок, снятый до этой правки, возвращается без посчитанной колонки', () => {
    // Снимки лежат в базе по тридцать дней, и в уже сделанных
    // `deadlineEffective` записан. Отбор идёт по списку колонок, а не по
    // содержимому снимка, — поэтому старые снимки чинятся тем же списком.
    const old = {
      ...snapshot,
      order: { ...snapshot.order, deadlineEffective: '2026-10-23T12:00:00Z' },
    };
    expect('deadlineEffective' in restorePayload(old).order).toBe(false);
  });

  it('не падает на пустом или битом снимке', () => {
    expect(restorePayload(null).items).toEqual([]);
    expect(restorePayload({ order: 'не объект' }).order).toEqual({});
  });
});
