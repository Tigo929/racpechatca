import { PrismaService } from 'src/prisma/prisma.service';
import { SalaryService } from './salary.service';

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

interface Stub {
  salaryAccrual: { findMany: AsyncMock };
  salaryPayment: { findMany: AsyncMock };
}

function createStub(): Stub {
  return {
    salaryAccrual: { findMany: jest.fn<Promise<unknown>, unknown[]>() },
    salaryPayment: { findMany: jest.fn<Promise<unknown>, unknown[]>() },
  };
}

describe('SalaryService.getMyBalance', () => {
  let prisma: Stub;
  let service: SalaryService;

  beforeEach(() => {
    prisma = createStub();
    service = new SalaryService(prisma as unknown as PrismaService);
  });

  it('считает долг только по незакрытым начислениям', async () => {
    prisma.salaryAccrual.findMany.mockResolvedValue([
      { salaryAmount: 200, paidAmount: 0, status: 'PENDING' },
      { salaryAmount: 300, paidAmount: 100, status: 'PARTIALLY_PAID' },
      { salaryAmount: 500, paidAmount: 500, status: 'PAID' },
      { salaryAmount: 700, paidAmount: 0, status: 'SETTLED' },
    ]);
    prisma.salaryPayment.findMany.mockResolvedValue([]);

    const result = await service.getMyBalance('ex-1');

    // 200 + (300 - 100) = 400. Закрытые и нулевые начисления в долг не входят.
    expect(result.totalDebt).toBe(400);
    expect(result.pendingOrders).toBe(2);
  });

  it('считает выплаченное по фактическим выплатам, а не по начислениям', async () => {
    prisma.salaryAccrual.findMany.mockResolvedValue([
      { salaryAmount: 1000, paidAmount: 1000, status: 'PAID' },
    ]);
    prisma.salaryPayment.findMany.mockResolvedValue([
      { id: 'p1', createdAt: new Date(), amount: 600, note: null },
      { id: 'p2', createdAt: new Date(), amount: 400, note: 'аванс' },
    ]);

    const result = await service.getMyBalance('ex-1');

    expect(result.totalPaid).toBe(1000);
    expect(result.totalDebt).toBe(0);
    expect(result.payments).toHaveLength(2);
  });

  it('запрашивает начисления и выплаты только по переданному исполнителю', async () => {
    prisma.salaryAccrual.findMany.mockResolvedValue([]);
    prisma.salaryPayment.findMany.mockResolvedValue([]);

    await service.getMyBalance('ex-42');

    const accrualArgs = prisma.salaryAccrual.findMany.mock.calls[0][0] as {
      where: { executorId: string; status: unknown };
    };
    const paymentArgs = prisma.salaryPayment.findMany.mock.calls[0][0] as {
      where: { executorId: string };
    };

    expect(accrualArgs.where.executorId).toBe('ex-42');
    expect(paymentArgs.where.executorId).toBe('ex-42');
    // REVERSED — снятые начисления, в личном балансе им не место.
    expect(accrualArgs.where.status).toEqual({ not: 'REVERSED' });
  });

  it('не раскрывает чеки заказов: в выборке нет полей заказа', async () => {
    prisma.salaryAccrual.findMany.mockResolvedValue([]);
    prisma.salaryPayment.findMany.mockResolvedValue([]);

    await service.getMyBalance('ex-1');

    const accrualArgs = prisma.salaryAccrual.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
      include?: unknown;
    };

    // Зарплата = (чек − доставка) × ставка. Свою ставку исполнитель знает,
    // поэтому любая сумма по конкретному заказу раскрыла бы его чек.
    expect(accrualArgs.include).toBeUndefined();
    expect(Object.keys(accrualArgs.select).sort()).toEqual([
      'paidAmount',
      'salaryAmount',
      'status',
    ]);
  });

  it('на пустом балансе возвращает нули, а не падает', async () => {
    prisma.salaryAccrual.findMany.mockResolvedValue([]);
    prisma.salaryPayment.findMany.mockResolvedValue([]);

    const result = await service.getMyBalance('new-guy');

    expect(result).toEqual({
      totalDebt: 0,
      pendingOrders: 0,
      totalPaid: 0,
      payments: [],
    });
  });
});
