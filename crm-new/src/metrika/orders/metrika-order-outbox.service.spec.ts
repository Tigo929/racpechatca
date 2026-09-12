import type { PrismaService } from 'src/prisma/prisma.service';
import { MetrikaOrderOutboxService, type OutboxDb } from './metrika-order-outbox.service';

/**
 * Постановка в очередь (этап 06, разделы 28–31, 59, 61).
 *
 * «Транзакционность» здесь — свойство вызова: enqueueTransition получает
 * клиент транзакции и пишет через него; если запись падает, ошибка уходит
 * вызывающему, и его транзакция откатывается вместе со статусом. Тест
 * держит обе стороны: успешная запись идёт через переданный tx, а не через
 * общий клиент; ошибка (кроме дубля) пробрасывается.
 */
function fakeDb() {
  const rows: Record<string, unknown>[] = [];
  const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (rows.some((r) => r.dedupeKey === data.dedupeKey)) {
      const err = new Error('Unique constraint failed') as Error & { code: string };
      err.code = 'P2002';
      throw err;
    }
    rows.push(data);
    return data;
  });
  return { rows, db: { metrikaOrderOutbox: { create } } as unknown as OutboxDb, create };
}

describe('enqueueTransition', () => {
  const service = new MetrikaOrderOutboxService({} as PrismaService);

  it('LEAD → NEW ставит IN_PROGRESS через переданный tx с ключом history:<id>', async () => {
    const { db, rows } = fakeDb();
    const target = await service.enqueueTransition(db, {
      orderId: 'o1',
      fromStatus: 'LEAD',
      toStatus: 'NEW',
      statusHistoryId: 'h1',
    });
    expect(target).toBe('IN_PROGRESS');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      orderId: 'o1',
      dedupeKey: 'history:h1',
      sourceStatusHistoryId: 'h1',
      targetMetrikaStatus: 'IN_PROGRESS',
      status: 'pending',
    });
  });

  it('внутренний шаг производства — ничего не пишет', async () => {
    const { db, create } = fakeDb();
    const target = await service.enqueueTransition(db, {
      orderId: 'o1',
      fromStatus: 'NEW',
      toStatus: 'IN_PROGRESS',
      statusHistoryId: 'h2',
    });
    expect(target).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('идемпотентность: тот же переход второй раз — дубль молча пропускается, строка одна', async () => {
    const { db, rows } = fakeDb();
    const t = { orderId: 'o1', fromStatus: 'NEW', toStatus: 'PAID', statusHistoryId: 'h3' };
    expect(await service.enqueueTransition(db, t)).toBe('PAID');
    expect(await service.enqueueTransition(db, t)).toBeNull();
    expect(rows).toHaveLength(1);
  });

  it('ошибка базы, кроме дубля, пробрасывается — транзакция статуса откатится вместе с очередью', async () => {
    const db = {
      metrikaOrderOutbox: { create: jest.fn().mockRejectedValue(new Error('connection lost')) },
    } as unknown as OutboxDb;
    await expect(
      service.enqueueTransition(db, {
        orderId: 'o1',
        fromStatus: 'NEW',
        toStatus: 'CANCELLED',
        statusHistoryId: 'h4',
      }),
    ).rejects.toThrow('connection lost');
  });

  it('LEAD → CANCELLED ставится в очередь: право решает воркер по истории, не постановка', async () => {
    const { db, rows } = fakeDb();
    await service.enqueueTransition(db, {
      orderId: 'o1',
      fromStatus: 'LEAD',
      toStatus: 'CANCELLED',
      statusHistoryId: 'h5',
    });
    expect(rows[0]).toMatchObject({ targetMetrikaStatus: 'CANCELLED' });
  });
});

describe('транзакция статуса и очередь живут вместе', () => {
  /**
   * Модель интерактивной транзакции: всё, что записано через tx, попадает в
   * базу только при успешном завершении колбэка; исключение — откат.
   */
  function transactionalDb() {
    const committed: { history: unknown[]; outbox: unknown[] } = { history: [], outbox: [] };
    const $transaction = async (cb: (tx: unknown) => Promise<unknown>) => {
      const staged = { history: [] as unknown[], outbox: [] as unknown[] };
      const tx = {
        statusHistory: {
          create: async ({ data }: { data: unknown }) => {
            staged.history.push(data);
            return { id: 'h-' + staged.history.length, ...(data as object) };
          },
        },
        metrikaOrderOutbox: {
          create: async ({ data }: { data: unknown }) => {
            staged.outbox.push(data);
            return data;
          },
        },
      };
      const result = await cb(tx); // бросит — ничего не фиксируем
      committed.history.push(...staged.history);
      committed.outbox.push(...staged.outbox);
      return result;
    };
    return { committed, $transaction };
  }

  const service = new MetrikaOrderOutboxService({} as PrismaService);

  it('commit: история и строка очереди фиксируются вместе', async () => {
    const { committed, $transaction } = transactionalDb();
    await $transaction(async (tx: any) => {
      const h = await tx.statusHistory.create({ data: { fromStatus: 'LEAD', toStatus: 'NEW' } });
      await service.enqueueTransition(tx, {
        orderId: 'o1',
        fromStatus: 'LEAD',
        toStatus: 'NEW',
        statusHistoryId: h.id,
      });
    });
    expect(committed.history).toHaveLength(1);
    expect(committed.outbox).toHaveLength(1);
    expect(committed.outbox[0]).toMatchObject({ dedupeKey: 'history:h-1' });
  });

  it('rollback: если после постановки транзакция падает, строки очереди тоже нет', async () => {
    const { committed, $transaction } = transactionalDb();
    await expect(
      $transaction(async (tx: any) => {
        const h = await tx.statusHistory.create({ data: { fromStatus: 'NEW', toStatus: 'PAID' } });
        await service.enqueueTransition(tx, {
          orderId: 'o1',
          fromStatus: 'NEW',
          toStatus: 'PAID',
          statusHistoryId: h.id,
        });
        throw new Error('нельзя вернуть заказ: по нему уже была выплата');
      }),
    ).rejects.toThrow('выплата');
    expect(committed.history).toHaveLength(0);
    expect(committed.outbox).toHaveLength(0);
  });
});

describe('ручное закрытие failed-строки (FIX_01 § 5)', () => {
  function prismaWithRows(rows: Record<string, unknown>[]) {
    return {
      metrikaOrderOutbox: {
        updateMany: jest.fn(async ({ where, data }: { where: { id: string; status: { in: string[] } }; data: Record<string, unknown> }) => {
          const hit = rows.filter((r) => r.id === where.id && where.status.in.includes(r.status as string));
          for (const r of hit) Object.assign(r, data);
          return { count: hit.length };
        }),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null),
        findMany: jest.fn(async ({ where }: { where: { orderId: string; status: { in: string[] }; id: { not: string }; OR: { createdAt: Date | { lt: Date }; id?: { lt: string } }[] } }) =>
          rows.filter((r) => {
            if (r.orderId !== where.orderId || r.id === where.id.not) return false;
            if (!where.status.in.includes(r.status as string)) return false;
            const created = r.createdAt as Date;
            return where.OR.some((c) =>
              c.createdAt instanceof Date
                ? created.getTime() === c.createdAt.getTime() && (r.id as string) < c.id!.lt
                : created.getTime() < c.createdAt.lt.getTime(),
            );
          }),
        ),
      },
    } as unknown as PrismaService;
  }

  it('markSkipped закрывает failed или pending строку как skipped/manual; delivered не трогает', async () => {
    const rows = [
      { id: 'a', orderId: 'o1', status: 'failed', createdAt: new Date(1) },
      { id: 'b', orderId: 'o1', status: 'delivered', createdAt: new Date(2) },
    ];
    const service = new MetrikaOrderOutboxService(prismaWithRows(rows));
    expect(await service.markSkipped('a')).toBe(true);
    expect(rows[0]).toMatchObject({ status: 'skipped', skipReason: 'manual' });
    expect(await service.markSkipped('b')).toBe(false);
    expect(rows[1].status).toBe('delivered');
  });

  it('blockingRows — более ранние незакрытые строки того же заказа, delivered/skipped не считаются', async () => {
    const rows = [
      { id: 'a', orderId: 'o1', status: 'failed', createdAt: new Date(1), targetMetrikaStatus: 'IN_PROGRESS' },
      { id: 'b', orderId: 'o1', status: 'delivered', createdAt: new Date(2), targetMetrikaStatus: 'PAID' },
      { id: 'c', orderId: 'o1', status: 'pending', createdAt: new Date(3), targetMetrikaStatus: 'CANCELLED' },
      { id: 'z', orderId: 'o2', status: 'pending', createdAt: new Date(0), targetMetrikaStatus: 'PAID' },
    ];
    const service = new MetrikaOrderOutboxService(prismaWithRows(rows));
    const blocking = await service.blockingRows('c');
    expect(blocking.map((b) => b.id)).toEqual(['a']);
  });
});
