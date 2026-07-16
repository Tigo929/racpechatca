import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EnumRole, EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderFinancialIntegrityService } from 'src/order-photo/order-financial-integrity.service';
import { OrderPhotoService } from 'src/order-photo/order-photo.service';
import { StockService } from 'src/stock/stock.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { CoolabcService } from 'src/integrations/coolabc.service';
import { SalaryService } from './salary.service';
import { calculateSalarySnapshot } from './salary-calculation';

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

interface PrismaStub {
  $transaction: AsyncMock;
  $queryRaw: AsyncMock;
  orderPhoto: {
    findUnique: AsyncMock;
    findMany: AsyncMock;
    count: AsyncMock;
    update: AsyncMock;
    delete: AsyncMock;
  };
  user: { findUnique: AsyncMock };
  salaryAccrual: {
    findFirst: AsyncMock;
    findMany: AsyncMock;
    create: AsyncMock;
    count: AsyncMock;
    deleteMany: AsyncMock;
  };
  paymentAccrualLink: { deleteMany: AsyncMock };
  statusHistory: { create: AsyncMock };
  orderAssignment: { create: AsyncMock };
}

function asyncMock(): AsyncMock {
  return jest.fn<Promise<unknown>, unknown[]>();
}

function createPrismaStub(): PrismaStub {
  const stub: PrismaStub = {
    $transaction: asyncMock(),
    $queryRaw: asyncMock(),
    orderPhoto: {
      findUnique: asyncMock(),
      findMany: asyncMock(),
      count: asyncMock(),
      update: asyncMock(),
      delete: asyncMock(),
    },
    user: { findUnique: asyncMock() },
    salaryAccrual: {
      findFirst: asyncMock(),
      findMany: asyncMock(),
      create: asyncMock(),
      count: asyncMock(),
      deleteMany: asyncMock(),
    },
    paymentAccrualLink: { deleteMany: asyncMock() },
    statusHistory: { create: asyncMock() },
    orderAssignment: { create: asyncMock() },
  };

  stub.$transaction.mockImplementation(async (input: unknown) => {
    if (Array.isArray(input)) return Promise.all(input);
    if (typeof input === 'function') {
      const callback = input as (tx: PrismaStub) => Promise<unknown>;
      return callback(stub);
    }
    throw new TypeError('Unsupported transaction input');
  });
  stub.$queryRaw.mockResolvedValue([{ id: 'order-1' }]);
  return stub;
}

function makeOrder(productCategory: 'PHOTO' | 'TSHIRT' = 'PHOTO') {
  return {
    id: 'order-1',
    createdAt: new Date('2026-06-13T00:00:00Z'),
    updatedAt: new Date('2026-06-13T00:00:00Z'),
    numberOrder: '202606-001',
    sourceOrder: 'LOCAL',
    communicationPlatform: 'TELEGRAM',
    urlCommunication: 'https://t.me/client',
    deliveryMethod: 'PICKUP',
    deliveryCost: 500,
    totalOrder: 5000,
    note: null,
    status: EnumStatus.READY_FOR_REVIEW,
    productCategory,
    deadline: null,
    isUrgent: false,
    executorId: 'executor-1',
    executor: { id: 'executor-1', username: 'Иван' },
    completedAt: null,
    clientPaidAt: null,
    items: [],
    tshirtItems: [],
    accruals: [],
  };
}

function createOrderService(stub: PrismaStub) {
  const financialIntegrity = {
    assertOrderFinanciallyEditable: jest.fn<Promise<void>, [string]>(),
    recalcPendingAccrual: jest.fn<Promise<void>, unknown[]>(),
  };
  financialIntegrity.assertOrderFinanciallyEditable.mockResolvedValue();
  financialIntegrity.recalcPendingAccrual.mockResolvedValue();
  const stock = {
    consumeForOrder: jest.fn<Promise<void>, unknown[]>().mockResolvedValue(),
    returnForOrder: jest.fn<Promise<void>, unknown[]>().mockResolvedValue(),
  };
  const telegram = {
    sendToGroup: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true),
  };
  const coolabc = {
    sendOrder: jest.fn<Promise<unknown>, [string]>().mockResolvedValue({}),
  };
  return new OrderPhotoService(
    stub as unknown as PrismaService,
    financialIntegrity as unknown as OrderFinancialIntegrityService,
    stock as unknown as StockService,
    telegram as unknown as TelegramService,
    coolabc as unknown as CoolabcService,
  );
}

function setupCompletion(productCategory: 'PHOTO' | 'TSHIRT' = 'PHOTO') {
  const stub = createPrismaStub();
  const order = makeOrder(productCategory);
  stub.orderPhoto.findUnique.mockResolvedValue(order);
  stub.user.findUnique.mockResolvedValue({
    id: 'executor-1',
    rateBasisPoints: 3000,
  });
  stub.salaryAccrual.findFirst.mockResolvedValue(null);
  stub.salaryAccrual.create.mockResolvedValue({ id: 'accrual-1' });
  stub.statusHistory.create.mockResolvedValue({ id: 'history-1' });
  stub.orderPhoto.update.mockResolvedValue({
    ...order,
    status: EnumStatus.SENT,
  });
  return { stub, service: createOrderService(stub) };
}

describe('salary accrual integrity', () => {
  it('calculates 5000 - 500 at 30% as 1350', () => {
    expect(calculateSalarySnapshot(5000, 500, 3000)).toEqual({
      salaryBase: 4500,
      rateBasisPoints: 3000,
      salaryAmount: 1350,
      status: 'PENDING',
    });
  });

  it('rejects delivery cost greater than the order total with 400', () => {
    expect(() => calculateSalarySnapshot(500, 501, 3000)).toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing salary rate with 400', () => {
    expect(() => calculateSalarySnapshot(5000, 500, null)).toThrow(
      BadRequestException,
    );
  });

  it('settles a zero salary immediately', () => {
    expect(calculateSalarySnapshot(5000, 500, 0).status).toBe('SETTLED');
  });

  it('does not create a second active accrual on repeat send', async () => {
    const { stub, service } = setupCompletion();
    stub.salaryAccrual.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'accrual-1', status: 'PENDING' });

    await service.updateStatusOrder(
      'order-1',
      { status: EnumStatus.SENT },
      'admin-1',
      EnumRole.ADMIN,
    );
    await service.updateStatusOrder(
      'order-1',
      { status: EnumStatus.SENT },
      'admin-1',
      EnumRole.ADMIN,
    );

    expect(stub.salaryAccrual.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the original rate snapshot after the employee rate changes', async () => {
    const { stub, service } = setupCompletion();
    stub.salaryAccrual.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'accrual-1', status: 'PENDING' });
    stub.user.findUnique
      .mockResolvedValueOnce({ id: 'executor-1', rateBasisPoints: 3000 })
      .mockResolvedValueOnce({ id: 'executor-1', rateBasisPoints: 5000 });

    await service.updateStatusOrder(
      'order-1',
      { status: EnumStatus.SENT },
      'admin-1',
      EnumRole.ADMIN,
    );
    await service.updateStatusOrder(
      'order-1',
      { status: EnumStatus.SENT },
      'admin-1',
      EnumRole.ADMIN,
    );

    const createArg = stub.salaryAccrual.create.mock.calls[0]?.[0] as {
      data: { rateBasisPoints: number; salaryAmount: number };
    };
    expect(createArg.data.rateBasisPoints).toBe(3000);
    expect(createArg.data.salaryAmount).toBe(1350);
    expect(stub.salaryAccrual.create).toHaveBeenCalledTimes(1);
  });

  it.each(['PHOTO', 'TSHIRT'] as const)(
    'creates salary for a %s order on send',
    async (productCategory) => {
      const { stub, service } = setupCompletion(productCategory);

      await service.updateStatusOrder(
        'order-1',
        { status: EnumStatus.SENT },
        'admin-1',
        EnumRole.ADMIN,
      );

      const createArg = stub.salaryAccrual.create.mock.calls[0]?.[0] as {
        data: { salaryAmount: number };
      };
      expect(createArg.data.salaryAmount).toBe(1350);
    },
  );

  it('lets an assigned executor send an order and still creates salary', async () => {
    const { stub, service } = setupCompletion();

    await service.updateStatusOrder(
      'order-1',
      { status: EnumStatus.SENT },
      'executor-1',
      EnumRole.EXECUTOR,
    );

    expect(stub.salaryAccrual.create).toHaveBeenCalledTimes(1);
    const createArg = stub.salaryAccrual.create.mock.calls[0]?.[0] as {
      data: { executorId: string; salaryAmount: number };
    };
    expect(createArg.data.executorId).toBe('executor-1');
    expect(createArg.data.salaryAmount).toBe(1350);
  });

  it('forbids an executor from opening another executor order', async () => {
    const stub = createPrismaStub();
    stub.orderPhoto.findUnique.mockResolvedValue(makeOrder());
    const service = createOrderService(stub);

    await expect(
      service.getOrderById('order-1', 'executor-2', EnumRole.EXECUTOR),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filters executor lists but leaves admin lists unrestricted', async () => {
    const stub = createPrismaStub();
    stub.orderPhoto.findMany.mockResolvedValue([]);
    stub.orderPhoto.count.mockResolvedValue(0);
    const service = createOrderService(stub);

    await service.getAllOrders({}, 'executor-1', EnumRole.EXECUTOR);
    const executorCall = stub.orderPhoto.findMany.mock.calls.at(-1)?.[0] as {
      where: Record<string, unknown>;
    };
    expect(executorCall.where.executorId).toBe('executor-1');

    await service.getAllOrders({}, 'admin-1', EnumRole.ADMIN);
    const adminCall = stub.orderPhoto.findMany.mock.calls.at(-1)?.[0] as {
      where: Record<string, unknown>;
    };
    expect(adminCall.where).not.toHaveProperty('executorId');
  });

  it('blocks financial editing after an active accrual with 409', async () => {
    const stub = createPrismaStub();
    stub.salaryAccrual.findFirst.mockResolvedValue({ id: 'accrual-1' });
    const guard = new OrderFinancialIntegrityService(
      stub as unknown as PrismaService,
    );

    await expect(
      guard.assertOrderFinanciallyEditable('order-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cascade-deletes accruals and their payment links when deleting an order', async () => {
    const stub = createPrismaStub();
    stub.orderPhoto.findUnique.mockResolvedValue(makeOrder());
    stub.salaryAccrual.findMany.mockResolvedValue([
      { id: 'accrual-1' },
      { id: 'accrual-2' },
    ]);
    stub.paymentAccrualLink.deleteMany.mockResolvedValue({ count: 2 });
    stub.salaryAccrual.deleteMany.mockResolvedValue({ count: 2 });
    stub.orderPhoto.delete.mockResolvedValue({
      ...makeOrder(),
      items: [],
      tshirtItems: [],
    });
    const service = createOrderService(stub);

    const result = await service.deleteOrder('order-1');

    // Платёжные связи удаляются раньше начислений (FK-целостность)
    expect(stub.paymentAccrualLink.deleteMany).toHaveBeenCalledWith({
      where: { accrualId: { in: ['accrual-1', 'accrual-2'] } },
    });
    expect(stub.salaryAccrual.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['accrual-1', 'accrual-2'] } },
    });
    expect(stub.orderPhoto.delete).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({ message: 'Заказ удалён успешно' }),
    );
  });
});

interface HarnessAccrual {
  id: string;
  createdAt: Date;
  executorId: string;
  salaryAmount: number;
  paidAmount: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID';
}

interface UpdateAccrualArgs {
  where: { id: string };
  data: {
    paidAmount: number;
    status: 'PARTIALLY_PAID' | 'PAID';
  };
}

interface CreatePaymentArgs {
  data: {
    executorId: string;
    paidById: string;
    amount: number;
    note?: string;
  };
}

class PaymentPrismaHarness {
  private tail: Promise<void> = Promise.resolve();
  private paymentSequence = 0;
  readonly payments: CreatePaymentArgs['data'][] = [];

  constructor(readonly accruals: HarnessAccrual[]) {}

  readonly user = {
    findUnique: jest.fn(() => Promise.resolve({ id: 'executor-1' })),
  };

  readonly $queryRaw = jest.fn(() =>
    Promise.resolve(
      this.accruals
        .filter(
          (accrual) =>
            accrual.status === 'PENDING' || accrual.status === 'PARTIALLY_PAID',
        )
        .map(({ id }) => ({ id })),
    ),
  );

  readonly salaryAccrual = {
    findMany: jest.fn(() =>
      Promise.resolve(
        this.accruals
          .filter(
            (accrual) =>
              accrual.status === 'PENDING' ||
              accrual.status === 'PARTIALLY_PAID',
          )
          .sort(
            (left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime() ||
              left.id.localeCompare(right.id),
          ),
      ),
    ),
    update: jest.fn(({ where, data }: UpdateAccrualArgs) => {
      const accrual = this.accruals.find(({ id }) => id === where.id);
      if (!accrual) return Promise.reject(new Error('Accrual not found'));
      accrual.paidAmount = data.paidAmount;
      accrual.status = data.status;
      return Promise.resolve(accrual);
    }),
  };

  readonly salaryPayment = {
    create: jest.fn(({ data }: CreatePaymentArgs) => {
      this.payments.push(data);
      this.paymentSequence += 1;
      return Promise.resolve({
        id: `payment-${this.paymentSequence}`,
        ...data,
      });
    }),
    findUnique: jest.fn(() =>
      Promise.resolve({ id: `payment-${this.paymentSequence}` }),
    ),
  };

  readonly paymentAccrualLink = {
    create: jest.fn(() => Promise.resolve({ id: 'link-1' })),
  };

  $transaction<T>(
    callback: (transaction: PaymentPrismaHarness) => Promise<T>,
  ): Promise<T> {
    const result = this.tail.then(() => callback(this));
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function makeAccrual(
  id: string,
  salaryAmount: number,
  createdAt: string,
): HarnessAccrual {
  return {
    id,
    createdAt: new Date(createdAt),
    executorId: 'executor-1',
    salaryAmount,
    paidAmount: 0,
    status: 'PENDING',
  };
}

describe('salary payment integrity', () => {
  it('prevents two parallel payments from exceeding the locked debt', async () => {
    const harness = new PaymentPrismaHarness([
      makeAccrual('accrual-1', 100, '2026-06-01T00:00:00Z'),
    ]);
    const service = new SalaryService(harness as unknown as PrismaService);

    const results = await Promise.allSettled([
      service.createPayment(
        { executorId: 'executor-1', amount: 100 },
        'admin-1',
      ),
      service.createPayment(
        { executorId: 'executor-1', amount: 100 },
        'admin-1',
      ),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    expect(harness.accruals[0].paidAmount).toBe(100);
    expect(harness.payments).toHaveLength(1);
    expect(harness.$queryRaw).toHaveBeenCalledTimes(2);
    expect(harness.payments[0].paidById).toBe('admin-1');
  });

  it('applies partial payments FIFO and leaves the correct remainder', async () => {
    const harness = new PaymentPrismaHarness([
      makeAccrual('accrual-1', 100, '2026-06-01T00:00:00Z'),
      makeAccrual('accrual-2', 100, '2026-06-02T00:00:00Z'),
    ]);
    const service = new SalaryService(harness as unknown as PrismaService);

    await service.createPayment(
      { executorId: 'executor-1', amount: 120 },
      'admin-1',
    );

    expect(harness.accruals[0]).toEqual(
      expect.objectContaining({ paidAmount: 100, status: 'PAID' }),
    );
    expect(harness.accruals[1]).toEqual(
      expect.objectContaining({ paidAmount: 20, status: 'PARTIALLY_PAID' }),
    );
    expect(
      harness.accruals.reduce(
        (debt, accrual) => debt + accrual.salaryAmount - accrual.paidAmount,
        0,
      ),
    ).toBe(80);
  });
});

// ── Склад футболок ──────────────────────────────────────────────────────────

interface StockRow {
  id: string;
  size: string;
  color: string;
  quantity: number;
}
interface Movement {
  orderId: string;
  size: string;
  color: string;
  quantity: number;
}

function makeStockHarness(
  stock: StockRow[],
  items: { size: string; color: string; quantity: number }[],
  movements: Movement[] = [],
) {
  return {
    stock,
    movements,
    $queryRaw: jest.fn(() => Promise.resolve([])),
    itemTshirt: {
      findMany: jest.fn(() => Promise.resolve(items)),
    },
    stockMovement: {
      count: jest.fn(({ where }: { where: { orderId: string } }) =>
        Promise.resolve(
          movements.filter((m) => m.orderId === where.orderId).length,
        ),
      ),
      findMany: jest.fn(({ where }: { where: { orderId: string } }) =>
        Promise.resolve(movements.filter((m) => m.orderId === where.orderId)),
      ),
      create: jest.fn(({ data }: { data: Movement }) => {
        movements.push(data);
        return Promise.resolve(data);
      }),
      deleteMany: jest.fn(({ where }: { where: { orderId: string } }) => {
        for (let i = movements.length - 1; i >= 0; i--) {
          if (movements[i].orderId === where.orderId) movements.splice(i, 1);
        }
        return Promise.resolve({ count: 0 });
      }),
    },
    tshirtStock: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { size_color: { size: string; color: string } };
        }) =>
          Promise.resolve(
            stock.find(
              (s) =>
                s.size === where.size_color.size &&
                s.color === where.size_color.color,
            ) ?? null,
          ),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { quantity: number };
        }) => {
          const row = stock.find((s) => s.id === where.id);
          if (row) row.quantity = data.quantity;
          return Promise.resolve(row);
        },
      ),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { size: string; color: string };
          data: { quantity: { increment: number } };
        }) => {
          const row = stock.find(
            (s) => s.size === where.size && s.color === where.color,
          );
          if (row) row.quantity += data.quantity.increment;
          return Promise.resolve({ count: row ? 1 : 0 });
        },
      ),
    },
  };
}

describe('tshirt stock', () => {
  function service(h: ReturnType<typeof makeStockHarness>) {
    return new StockService(h as unknown as PrismaService);
  }

  it('blocks sending when stock is insufficient (409)', async () => {
    const h = makeStockHarness(
      [{ id: 's1', size: 'S', color: 'Белый', quantity: 3 }],
      [{ size: 'S', color: 'Белый', quantity: 5 }],
    );
    await expect(
      service(h).consumeForOrder('order-1', h as never),
    ).rejects.toBeInstanceOf(ConflictException);
    // остаток не тронут при блокировке
    expect(h.stock[0].quantity).toBe(3);
    expect(h.movements).toHaveLength(0);
  });

  it('decrements stock and records a movement on consume', async () => {
    const h = makeStockHarness(
      [{ id: 's1', size: 'S', color: 'Белый', quantity: 5 }],
      [{ size: 'S', color: 'Белый', quantity: 5 }],
    );
    await service(h).consumeForOrder('order-1', h as never);
    expect(h.stock[0].quantity).toBe(0);
    expect(h.movements).toEqual([
      { orderId: 'order-1', size: 'S', color: 'Белый', quantity: 5 },
    ]);
  });

  it('is idempotent — does not double-consume', async () => {
    const h = makeStockHarness(
      [{ id: 's1', size: 'S', color: 'Белый', quantity: 5 }],
      [{ size: 'S', color: 'Белый', quantity: 2 }],
      [{ orderId: 'order-1', size: 'S', color: 'Белый', quantity: 2 }],
    );
    await service(h).consumeForOrder('order-1', h as never);
    expect(h.stock[0].quantity).toBe(5); // не списали повторно
  });

  it('returns exactly what was consumed on return', async () => {
    const h = makeStockHarness(
      [{ id: 's1', size: 'S', color: 'Белый', quantity: 0 }],
      [],
      [{ orderId: 'order-1', size: 'S', color: 'Белый', quantity: 5 }],
    );
    await service(h).returnForOrder('order-1', h as never);
    expect(h.stock[0].quantity).toBe(5);
    expect(h.movements).toHaveLength(0);
  });

  it('aggregates multiple items of the same size/color', async () => {
    const h = makeStockHarness(
      [{ id: 's1', size: 'M', color: 'Чёрный', quantity: 10 }],
      [
        { size: 'M', color: 'Чёрный', quantity: 3 },
        { size: 'M', color: 'Чёрный', quantity: 4 },
      ],
    );
    await service(h).consumeForOrder('order-1', h as never);
    expect(h.stock[0].quantity).toBe(3); // 10 - (3+4)
    expect(h.movements).toEqual([
      { orderId: 'order-1', size: 'M', color: 'Чёрный', quantity: 7 },
    ]);
  });

  it('skips untracked size/color (no stock row)', async () => {
    const h = makeStockHarness(
      [{ id: 's1', size: 'S', color: 'Белый', quantity: 5 }],
      [{ size: 'XS', color: 'Красный', quantity: 100 }],
    );
    await service(h).consumeForOrder('order-1', h as never);
    expect(h.stock[0].quantity).toBe(5); // не тронут
    expect(h.movements).toHaveLength(0); // нет движения для неотслеживаемого
  });

  it('lists XS before S in sorted output', async () => {
    const stock = new StockService({
      tshirtStock: {
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              id: 's1',
              size: 'S',
              color: 'Белый',
              quantity: 5,
              updatedAt: new Date(),
            },
            {
              id: 'xs1',
              size: 'XS',
              color: 'Белый',
              quantity: 2,
              updatedAt: new Date(),
            },
            {
              id: 'm1',
              size: 'M',
              color: 'Белый',
              quantity: 3,
              updatedAt: new Date(),
            },
          ]),
        ),
      },
    } as unknown as PrismaService);
    const result = (await stock.list()) as { size: string }[];
    expect(result[0].size).toBe('XS');
    expect(result[1].size).toBe('S');
    expect(result[2].size).toBe('M');
  });
});

// ── createPaymentByAccruals — аудит-трейл ──────────────────────────────────

interface AccrualByIdRow {
  id: string;
  orderId: string;
  executorId: string;
  salaryBase: number;
  rateBasisPoints: number;
  salaryAmount: number;
  paidAmount: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID';
  createdAt: Date;
  order: {
    numberOrder: string;
    totalOrder: number;
    deliveryCost: number;
    createdAt: Date;
    status: string;
    urlCommunication: string;
    communicationPlatform: string;
  };
}

type PaymentByAccrualsHarness = {
  _orders: Record<string, string>;
  _accruals: AccrualByIdRow[];
  statusHistoryCreated: unknown[];
  salaryAccrual: {
    findMany: jest.Mock<Promise<AccrualByIdRow[]>, []>;
    update: jest.Mock<
      Promise<AccrualByIdRow | undefined>,
      [
        {
          where: { id: string };
          data: { paidAmount: number; status: string };
        },
      ]
    >;
  };
  salaryPayment: {
    create: jest.Mock<
      Promise<{ id: string; createdAt: Date } & Record<string, unknown>>,
      [{ data: Record<string, unknown> }]
    >;
  };
  paymentAccrualLink: {
    create: jest.Mock<Promise<{ id: string }>, [unknown]>;
  };
  orderPhoto: {
    update: jest.Mock<
      Promise<{ id: string; status: string }>,
      [{ where: { id: string }; data: { status: string } }]
    >;
  };
  statusHistory: {
    create: jest.Mock<Promise<{ id: string }>, [{ data: unknown }]>;
  };
  $queryRaw: jest.Mock<Promise<unknown>, unknown[]>;
  $transaction<T>(cb: (tx: PaymentByAccrualsHarness) => Promise<T>): Promise<T>;
};

function makePaymentByAccrualsHarness(
  accruals: AccrualByIdRow[],
): PaymentByAccrualsHarness {
  const orders: Record<string, string> = {};
  for (const a of accruals) {
    orders[a.orderId] = a.order.status;
  }

  const statusHistoryCreated: unknown[] = [];

  const harness: PaymentByAccrualsHarness = {
    _orders: orders,
    _accruals: accruals,
    statusHistoryCreated,

    salaryAccrual: {
      findMany: jest.fn(() => Promise.resolve(accruals)),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { paidAmount: number; status: string };
        }) => {
          const a = accruals.find((x) => x.id === where.id);
          if (a) {
            a.paidAmount = data.paidAmount;
            a.status = data.status as 'PAID';
          }
          return Promise.resolve(a);
        },
      ),
    },

    salaryPayment: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'payment-1', createdAt: new Date(), ...data }),
      ),
    },

    paymentAccrualLink: {
      create: jest.fn(() => Promise.resolve({ id: 'link-1' })),
    },

    orderPhoto: {
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { status: string };
        }) => {
          orders[where.id] = data.status;
          return Promise.resolve({ id: where.id, status: data.status });
        },
      ),
    },

    statusHistory: {
      create: jest.fn((args: { data: unknown }) => {
        statusHistoryCreated.push(args.data);
        return Promise.resolve({ id: 'hist-1' });
      }),
    },

    // Блокировка FOR UPDATE перед чтением начислений
    $queryRaw: jest.fn(() =>
      Promise.resolve(accruals.map((a) => ({ id: a.id }))),
    ),

    $transaction<T>(cb: (tx: typeof harness) => Promise<T>): Promise<T> {
      return cb(harness);
    },
  };
  return harness;
}

describe('createPaymentByAccruals — StatusHistory audit trail', () => {
  function svc(h: PaymentByAccrualsHarness) {
    return new SalaryService(h as unknown as PrismaService);
  }

  it('creates a StatusHistory entry when setting order to PAID', async () => {
    const harness = makePaymentByAccrualsHarness([
      {
        id: 'accrual-1',
        orderId: 'order-1',
        executorId: 'executor-1',
        salaryBase: 900,
        rateBasisPoints: 3000,
        salaryAmount: 270,
        paidAmount: 0,
        status: 'PENDING',
        createdAt: new Date('2026-06-01'),
        order: {
          numberOrder: '202606-001',
          totalOrder: 1000,
          deliveryCost: 100,
          createdAt: new Date('2026-06-01'),
          status: 'SENT',
          urlCommunication: 'https://t.me/client',
          communicationPlatform: 'TELEGRAM',
        },
      },
    ]);
    await svc(harness).createPaymentByAccruals(
      { executorId: 'executor-1', accrualIds: ['accrual-1'] },
      'admin-1',
    );

    expect(harness.orderPhoto.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PAID' } }),
    );
    expect(harness.statusHistory.create).toHaveBeenCalledTimes(1);
    expect(harness.statusHistoryCreated[0]).toMatchObject({
      orderId: 'order-1',
      fromStatus: 'SENT',
      toStatus: 'PAID',
      changedBy: 'admin-1',
    });
  });

  it('skips orderPhoto.update and statusHistory.create if order is already PAID', async () => {
    const harness = makePaymentByAccrualsHarness([
      {
        id: 'accrual-2',
        orderId: 'order-2',
        executorId: 'executor-1',
        salaryBase: 500,
        rateBasisPoints: 3000,
        salaryAmount: 150,
        paidAmount: 0,
        status: 'PENDING',
        createdAt: new Date('2026-06-02'),
        order: {
          numberOrder: '202606-002',
          totalOrder: 600,
          deliveryCost: 100,
          createdAt: new Date('2026-06-02'),
          status: 'PAID',
          urlCommunication: 'https://t.me/client2',
          communicationPlatform: 'TELEGRAM',
        },
      },
    ]);
    await svc(harness).createPaymentByAccruals(
      { executorId: 'executor-1', accrualIds: ['accrual-2'] },
      'admin-1',
    );

    expect(harness.orderPhoto.update).not.toHaveBeenCalled();
    expect(harness.statusHistory.create).not.toHaveBeenCalled();
  });
});
