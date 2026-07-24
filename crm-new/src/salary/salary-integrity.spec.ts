import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EnumRole, EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderFinancialIntegrityService } from 'src/order-photo/order-financial-integrity.service';
import { OrderPhotoService } from 'src/order-photo/order-photo.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { PartnerSettingsService } from 'src/partner/partner-settings.service';
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
  const telegram = {
    sendToGroup: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true),
  };
  const partnerSettings = {
    syncRewardExpense: jest
      .fn<Promise<void>, unknown[]>()
      .mockResolvedValue(),
  };
  return new OrderPhotoService(
    stub as unknown as PrismaService,
    financialIntegrity as unknown as OrderFinancialIntegrityService,
    telegram as unknown as TelegramService,
    partnerSettings as unknown as PartnerSettingsService,
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

  it('blocks moving a photo order to SENT without an executor', async () => {
    const stub = createPrismaStub();
    // Фото-заказ без исполнителя: переводить в «Отправлен» нельзя —
    // начислять зарплату некому, исполнитель просто забыт.
    stub.orderPhoto.findUnique.mockResolvedValue({
      ...makeOrder('PHOTO'),
      executorId: null,
      executor: null,
    });
    const service = createOrderService(stub);

    await expect(
      service.updateStatusOrder(
        'order-1',
        { status: EnumStatus.SENT },
        'admin-1',
        EnumRole.ADMIN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a tshirt order to reach SENT without an executor (partner-run)', async () => {
    const { stub, service } = setupCompletion('TSHIRT');
    stub.orderPhoto.findUnique.mockResolvedValue({
      ...makeOrder('TSHIRT'),
      executorId: null,
      executor: null,
    });

    await expect(
      service.updateStatusOrder(
        'order-1',
        { status: EnumStatus.SENT },
        'admin-1',
        EnumRole.ADMIN,
      ),
    ).resolves.toBeDefined();
  });

  it('forbids an executor from opening a tshirt order even when assigned', async () => {
    const stub = createPrismaStub();
    // executorId совпадает с запрашивающим — доступ всё равно закрыт:
    // футболки ведёт партнёр через администратора.
    stub.orderPhoto.findUnique.mockResolvedValue(makeOrder('TSHIRT'));
    const service = createOrderService(stub);

    await expect(
      service.getOrderById('order-1', 'executor-1', EnumRole.EXECUTOR),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('pins executor lists to photo even when tshirt is requested', async () => {
    const stub = createPrismaStub();
    stub.orderPhoto.findMany.mockResolvedValue([]);
    stub.orderPhoto.count.mockResolvedValue(0);
    const service = createOrderService(stub);

    await service.getAllOrders(
      { productCategory: 'TSHIRT' },
      'executor-1',
      EnumRole.EXECUTOR,
    );
    const call = stub.orderPhoto.findMany.mock.calls.at(-1)?.[0] as {
      where: Record<string, unknown>;
    };

    // Параметр запроса перекрыт: ?productCategory=TSHIRT не открывает футболки.
    expect(call.where.productCategory).toBe('PHOTO');
    expect(call.where.executorId).toBe('executor-1');
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
