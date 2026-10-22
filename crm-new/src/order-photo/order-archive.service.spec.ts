import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Prisma } from 'src/generated/prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { OrderArchiveService } from './order-archive.service';
import { buildOrderSnapshot } from './order-archive';

/**
 * Корзина удалённых заказов: запись при удалении, возврат и очистка.
 *
 * Эти тесты стерегут две вещи, которые дорого стоят: что снимок заказа
 * действительно складывается в корзину при удалении, и что возврат не
 * воссоздаёт уже выплаченные начисления.
 */

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

interface WhereArg {
  where?: Record<string, unknown>;
}

function asyncMock(): AsyncMock {
  return jest.fn<Promise<unknown>, unknown[]>();
}

function makeStub() {
  const stub = {
    $transaction: asyncMock(),
    $executeRaw: asyncMock(),
    $queryRaw: asyncMock(),
    orderPhoto: {
      findUnique: asyncMock(),
      create: asyncMock(),
    },
    orderDeletion: {
      findUnique: asyncMock(),
      findMany: asyncMock(),
      count: asyncMock(),
      create: asyncMock(),
      update: asyncMock(),
      updateMany: asyncMock(),
    },
    itemPhoto: { createMany: asyncMock() },
    itemTshirt: { createMany: asyncMock() },
    itemCanvas: { createMany: asyncMock() },
    statusHistory: { createMany: asyncMock() },
    orderAssignment: { createMany: asyncMock() },
    salaryAccrual: { create: asyncMock() },
    user: { findUnique: asyncMock() },
  };

  stub.$transaction.mockImplementation(async (input: unknown) => {
    if (Array.isArray(input)) return Promise.all(input);
    if (typeof input === 'function') {
      return (input as (tx: typeof stub) => Promise<unknown>)(stub);
    }
    throw new TypeError('Unsupported transaction input');
  });
  stub.$executeRaw.mockResolvedValue(1);
  stub.$queryRaw.mockResolvedValue([{ max: 14 }]);
  stub.orderPhoto.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) => Promise.resolve(data),
  );
  stub.orderDeletion.update.mockResolvedValue({});
  stub.user.findUnique.mockResolvedValue({ id: 'u1' });

  // Ничего не занято: ни заказ, ни номер, ни ключ заявки.
  stub.orderPhoto.findUnique.mockResolvedValue(null);
  return stub;
}

type Stub = ReturnType<typeof makeStub>;

function makeService(stub: Stub, retention = '30') {
  const config = {
    get: jest.fn().mockReturnValue(retention),
  } as unknown as ConfigService;
  return new OrderArchiveService(stub as unknown as PrismaService, config);
}

const ORDER = {
  id: 'order-1',
  numberOrder: '20261020-015',
  status: 'NEW',
  sourceOrder: 'WEBSITE',
  productCategory: 'PHOTO',
  totalOrder: 7600,
  createdAt: new Date('2026-10-20T10:00:00Z'),
  externalRequestId: 'web-photo-abc',
  executorId: 'u1',
  processedById: null,
  items: [{ id: 'i1', orderId: 'order-1', quantity: 10 }],
  tshirtItems: [],
  canvasItems: [],
  statusHistory: [{ id: 'h1', orderId: 'order-1', toStatus: 'NEW' }],
  assignments: [],
  accruals: [] as unknown[],
};

describe('корзина: запись при удалении', () => {
  it('складывает причину, снимок и срок возврата', async () => {
    const stub = makeStub();
    stub.orderPhoto.findUnique.mockResolvedValue(ORDER);
    const service = makeService(stub);

    await service.capture(stub as never, 'order-1', 'дубль заявки', {
      id: 'admin-1',
      name: 'admin',
    });

    const call = stub.orderDeletion.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).toEqual(
      expect.objectContaining({
        reason: 'дубль заявки',
        orderId: 'order-1',
        numberOrder: '20261020-015',
        deletedById: 'admin-1',
        deletedByName: 'admin',
        // Ключ заявки с сайта: по нему приём заявок узнаёт повторную
        // доставку уже удалённой заявки и не заводит её заново.
        externalRequestId: 'web-photo-abc',
      }),
    );
    expect(call.data.snapshot).toEqual(
      expect.objectContaining({ order: expect.any(Object) as unknown }),
    );
    expect(call.data.purgeAfter).toBeInstanceOf(Date);
  });

  it('срок возврата отсчитывается по настройке', async () => {
    const stub = makeStub();
    stub.orderPhoto.findUnique.mockResolvedValue(ORDER);
    const service = makeService(stub, '7');

    await service.capture(stub as never, 'order-1', 'причина');

    const call = stub.orderDeletion.create.mock.calls[0][0] as {
      data: { deletedAt: Date; purgeAfter: Date };
    };
    const days =
      (call.data.purgeAfter.getTime() - call.data.deletedAt.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(days).toBe(7);
  });

  it('несуществующий заказ — 404, а не пустая запись в корзине', async () => {
    const stub = makeStub();
    stub.orderPhoto.findUnique.mockResolvedValue(null);
    const service = makeService(stub);

    await expect(
      service.capture(stub as never, 'нет-такого', 'причина'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(stub.orderDeletion.create).not.toHaveBeenCalled();
  });
});

describe('корзина: возврат заказа', () => {
  const record = (over: Record<string, unknown> = {}) => ({
    id: 'rec-1',
    restoredAt: null,
    purgedAt: null,
    purgeAfter: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    snapshot: buildOrderSnapshot(ORDER),
    ...over,
  });

  it('возвращает заказ с позициями и историей', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(record());
    const service = makeService(stub);

    const result = await service.restore('rec-1', {
      id: 'admin-1',
      name: 'admin',
    });

    expect(stub.orderPhoto.create).toHaveBeenCalledTimes(1);
    expect(stub.itemPhoto.createMany).toHaveBeenCalledTimes(1);
    expect(stub.statusHistory.createMany).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual([]);
    expect(result.message).toContain('20261020-015');
  });

  it('закрывает запись корзины и стирает снимок', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(record());
    const service = makeService(stub);

    await service.restore('rec-1', { id: 'admin-1', name: 'admin' });

    const call = stub.orderDeletion.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    // Снимок больше не нужен: заказ снова в системе, а держать копию
    // персональных данных клиента без причины нельзя. Именно DbNull —
    // обычный null Prisma для Json-колонки не принимает.
    expect(call.data.restoredAt).toBeInstanceOf(Date);
    expect(call.data.restoredById).toBe('admin-1');
    expect(call.data.snapshot).toBe(Prisma.DbNull);
  });

  it('повторный возврат не проходит', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(
      record({ restoredAt: new Date(), snapshot: null }),
    );
    const service = makeService(stub);

    await expect(service.restore('rec-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(stub.orderPhoto.create).not.toHaveBeenCalled();
  });

  it('просроченная запись не возвращается', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(
      record({ purgeAfter: new Date('2020-01-01T00:00:00Z') }),
    );
    const service = makeService(stub);

    await expect(service.restore('rec-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('запись без снимка (до появления корзины) не возвращается', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(
      record({ snapshot: null, purgeAfter: null }),
    );
    const service = makeService(stub);

    await expect(service.restore('rec-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('несуществующая запись — 404', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(null);
    const service = makeService(stub);

    await expect(service.restore('нет-такой')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('заказ уже существует — конфликт, а не второй экземпляр', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(record());
    stub.orderPhoto.findUnique.mockImplementation(({ where }: WhereArg) =>
      Promise.resolve(
        where?.id === 'order-1'
          ? { id: 'order-1', numberOrder: '20261020-015' }
          : null,
      ),
    );
    const service = makeService(stub);

    await expect(service.restore('rec-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(stub.orderPhoto.create).not.toHaveBeenCalled();
  });

  it('занятый номер не отменяет возврат — выдаётся новый', async () => {
    // После удаления счётчик месяца откатывается на MAX, и следующий новый
    // заказ забирает освободившийся номер. Отказывать из-за номера
    // неправильно: заказ нужнее номера.
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(record());
    stub.orderPhoto.findUnique.mockImplementation(({ where }: WhereArg) =>
      Promise.resolve(
        where?.numberOrder === '20261020-015' ? { id: 'other' } : null,
      ),
    );
    // Счётчик месяца стоит на 20 — следующий свободный номер будет -021,
    // то есть заведомо не тот, что был у удалённого заказа.
    stub.$queryRaw.mockResolvedValue([{ max: 20 }]);
    const service = makeService(stub);

    const result = await service.restore('rec-1');

    const created = stub.orderPhoto.create.mock.calls[0][0] as {
      data: { numberOrder: string };
    };
    expect(created.data.numberOrder).not.toBe('20261020-015');
    expect(created.data.numberOrder).toMatch(/-021$/);
    expect(result.warnings.join(' ')).toContain('уже занят');
    // В сообщении — именно новый номер: по нему заказ и искать.
    expect(result.message).toContain(created.data.numberOrder);
  });

  it('заявка с сайта заведена заново — ключ снимается и предупреждаем', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(record());
    stub.orderPhoto.findUnique.mockImplementation(({ where }: WhereArg) =>
      Promise.resolve(
        where?.externalRequestId === 'web-photo-abc'
          ? { numberOrder: '20261021-003' }
          : null,
      ),
    );
    const service = makeService(stub);

    const result = await service.restore('rec-1');

    const created = stub.orderPhoto.create.mock.calls[0][0] as {
      data: { externalRequestId: string | null };
    };
    expect(created.data.externalRequestId).toBeNull();
    expect(result.warnings.join(' ')).toContain('20261021-003');
  });

  it('уволенный исполнитель не блокирует возврат', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(record());
    stub.user.findUnique.mockResolvedValue(null);
    const service = makeService(stub);

    const result = await service.restore('rec-1');

    const created = stub.orderPhoto.create.mock.calls[0][0] as {
      data: { executorId: string | null };
    };
    expect(created.data.executorId).toBeNull();
    expect(result.warnings.join(' ')).toContain('executorId');
  });

  it('выплаченное начисление не воссоздаётся, но о нём предупреждают', async () => {
    const stub = makeStub();
    stub.orderDeletion.findUnique.mockResolvedValue(
      record({
        snapshot: buildOrderSnapshot({
          ...ORDER,
          accruals: [
            {
              id: 'a1',
              executorId: 'u1',
              salaryAmount: 300,
              paymentLinks: [{ id: 'p1' }],
            },
            {
              id: 'a2',
              executorId: 'u1',
              salaryAmount: 100,
              paymentLinks: [],
            },
          ],
        }),
      }),
    );
    const service = makeService(stub);

    const result = await service.restore('rec-1');

    // Воссоздано только невыплаченное: вернуть выплаченное без платёжной
    // связи значило бы показать его невыплаченным и заплатить второй раз.
    expect(stub.salaryAccrual.create).toHaveBeenCalledTimes(1);
    expect(result.warnings.join(' ')).toContain('Начислений с выплатами: 1');
  });
});

describe('корзина: очистка по сроку', () => {
  it('чистит только то, чему вышел срок и что ещё не чистили', async () => {
    const stub = makeStub();
    stub.orderDeletion.updateMany.mockResolvedValue({ count: 3 });
    const service = makeService(stub);
    const now = new Date('2026-10-20T00:00:00Z');

    const removed = await service.purgeExpired(now);

    expect(removed).toBe(3);
    const call = stub.orderDeletion.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(call.where).toEqual({ purgedAt: null, purgeAfter: { lt: now } });
    expect(call.data.purgedAt).toBe(now);
  });

  it('сама запись о причине остаётся — чистится только снимок', async () => {
    // По причинам удаления видно, почему заявки не доходят до заказа, и
    // эта статистика не должна исчезать вместе со снимком.
    const stub = makeStub();
    stub.orderDeletion.updateMany.mockResolvedValue({ count: 1 });
    const service = makeService(stub);

    await service.purgeExpired(new Date());

    const call = stub.orderDeletion.updateMany.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect('snapshot' in call.data).toBe(true);
    expect(stub.orderDeletion.update).not.toHaveBeenCalled();
  });
});
