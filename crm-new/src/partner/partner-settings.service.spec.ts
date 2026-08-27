import { PrismaService } from 'src/prisma/prisma.service';
import { PartnerSettingsService } from './partner-settings.service';

type AnyMock = jest.Mock<Promise<unknown>, unknown[]>;

function createTx() {
  const tx = {
    partnerSettings: {
      findUnique: jest.fn() as AnyMock,
      create: jest.fn() as AnyMock,
    },
    expenseOrder: {
      findFirst: jest.fn() as AnyMock,
      create: jest.fn() as AnyMock,
      update: jest.fn() as AnyMock,
      delete: jest.fn() as AnyMock,
    },
    user: { findFirst: jest.fn() as AnyMock },
  };
  tx.partnerSettings.findUnique.mockResolvedValue({
    id: 'default',
    partnerName: 'Партнёр',
    partnerRateBasisPoints: 3000,
  });
  tx.expenseOrder.findFirst.mockResolvedValue(null);
  tx.expenseOrder.create.mockResolvedValue({ id: 'expense-1' });
  tx.expenseOrder.update.mockResolvedValue({ id: 'expense-1' });
  tx.user.findFirst.mockResolvedValue({ id: 'admin-1' });
  return tx;
}

// Футболка 1500 ₽ без дизайна: (1500 − 260 − 70) × 30% + 330 = 681 ₽.
const items = [
  {
    pricePosition: 1500,
    designCost: 0,
    quantity: 1,
    thermalCost: 70,
    blankCost: 260,
    clientItem: false,
  },
];

/** Заказ июльский, оплачен в августе — типичная ситуация. */
const JULY = new Date('2026-07-24T10:00:00Z');

describe('авто-расход «Вознаграждение партнёру»', () => {
  const service = new PartnerSettingsService({} as unknown as PrismaService);

  function call(tx: ReturnType<typeof createTx>) {
    return service.syncRewardExpense(
      tx as never,
      {
        orderId: 'order-1',
        orderNumber: '20260724-097',
        order: { tshirtItems: items },
        isPaid: true,
        actingUserId: 'admin-1',
        revenueDate: JULY,
      },
    );
  }

  it('сумма считается по формуле владельца: 351 + 70 + 260 = 681', async () => {
    const tx = createTx();
    await call(tx);

    const data = (tx.expenseOrder.create.mock.calls[0]?.[0] as {
      data: { amount: number; note: string };
    }).data;
    expect(data.amount).toBe(681);
    expect(data.note).toContain('заработок партнёра 351 ₽');
  });

  // Иначе июль показывает выручку без затрат, а август — затраты без выручки.
  it('расход датируется периодом заказа, а не моментом оплаты', async () => {
    const tx = createTx();
    await call(tx);

    const data = (tx.expenseOrder.create.mock.calls[0]?.[0] as {
      data: { createdAt: Date };
    }).data;
    expect(data.createdAt).toEqual(JULY);
  });

  it('при пересчёте существующего расхода дата тоже выравнивается', async () => {
    const tx = createTx();
    tx.expenseOrder.findFirst.mockResolvedValue({ id: 'expense-1' });

    await call(tx);

    expect(tx.expenseOrder.create).not.toHaveBeenCalled();
    const data = (tx.expenseOrder.update.mock.calls[0]?.[0] as {
      data: { amount: number; createdAt: Date };
    }).data;
    expect(data.amount).toBe(681);
    expect(data.createdAt).toEqual(JULY);
  });

  it('уход из «Оплачен» снимает расход — выплаты, которой нет, в отчётах не будет', async () => {
    const tx = createTx();
    tx.expenseOrder.findFirst.mockResolvedValue({ id: 'expense-1' });

    await service.syncRewardExpense(tx as never, {
      orderId: 'order-1',
      orderNumber: '20260724-097',
      order: { tshirtItems: items },
      isPaid: false,
      actingUserId: 'admin-1',
      revenueDate: JULY,
    });

    expect(tx.expenseOrder.delete).toHaveBeenCalledWith({
      where: { id: 'expense-1' },
    });
  });

  it('давальческая футболка: возвращаем только плёнку', async () => {
    const tx = createTx();
    await service.syncRewardExpense(tx as never, {
      orderId: 'order-1',
      orderNumber: '20260724-098',
      order: { tshirtItems: [{ ...items[0]!, clientItem: true }] },
      isPaid: true,
      actingUserId: 'admin-1',
      revenueDate: JULY,
    });

    // маржа = 1500 − 70 = 1430; 1430 × 30% = 429; + 70 = 499
    const data = (tx.expenseOrder.create.mock.calls[0]?.[0] as {
      data: { amount: number };
    }).data;
    expect(data.amount).toBe(499);
  });
});
