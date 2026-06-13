import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EnumRole, EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderFinancialIntegrityService } from 'src/order-photo/order-financial-integrity.service';
import { OrderPhotoService } from 'src/order-photo/order-photo.service';
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
    create: AsyncMock;
    count: AsyncMock;
  };
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
      create: asyncMock(),
      count: asyncMock(),
    },
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
  };
  financialIntegrity.assertOrderFinanciallyEditable.mockResolvedValue();
  return new OrderPhotoService(
    stub as unknown as PrismaService,
    financialIntegrity as unknown as OrderFinancialIntegrityService,
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

  it('blocks hard delete when any accrual history exists with 409', async () => {
    const stub = createPrismaStub();
    stub.orderPhoto.findUnique.mockResolvedValue(makeOrder());
    stub.salaryAccrual.count.mockResolvedValue(1);
    const service = createOrderService(stub);

    await expect(service.deleteOrder('order-1')).rejects.toBeInstanceOf(
      ConflictException,
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
