/* Prisma doubles model only the operations exercised by these service tests. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { OrderPhotoService } from './order-photo.service';
import { EnumRole, EnumStatus } from 'src/generated/prisma/enums';
import { ROLES_KEY } from 'src/auth/decorators/roles.decorator';
import { OrderPhotoController } from './order-photo.controller';

function setup(over: Record<string, unknown> = {}) {
  const order: any = {
    id: 'order',
    numberOrder: 'test',
    productCategory: 'PHOTO',
    status: 'SHIPMENT_CREATED',
    deliveryMethod: 'YANDEX_PVZ',
    deliveryCost: 300,
    totalOrder: 1300,
    items: [{ pricePosition: 1000 }],
    tshirtItems: [],
    canvasItems: [],
    isUrgent: false,
    urgencyFee: 0,
    designDevelopmentCost: 0,
    executorId: 'executor',
    processedById: null,
    communicationPlatform: 'TELEGRAM',
    urlCommunication: 'https://t.me/client',
    createdAt: new Date(),
    ...over,
  };
  const db: any = {
    $queryRaw: jest.fn(),
    orderPhoto: {
      findUnique: jest.fn(async () => order),
      update: jest.fn(async ({ data }) => ({ ...order, ...data })),
    },
    statusHistory: { create: jest.fn(async () => ({ id: 'history' })) },
    salaryAccrual: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      create: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    salaryPayment: { create: jest.fn(async () => ({ id: 'payment' })) },
    paymentAccrualLink: { create: jest.fn() },
    expenseOrder: { findFirst: jest.fn(async () => null), create: jest.fn() },
  };
  db.$transaction = jest.fn(async (fn) => fn(db));
  const finance: any = {
    assertOrderFinanciallyEditable: jest.fn(),
    recalcPendingAccrual: jest.fn(),
  };
  const partner: any = {
    get: jest.fn(async () => ({ maxLinkTemplate: 'https://max.ru/{phone}' })),
    syncRewardExpense: jest.fn(),
  };
  const outbox: any = { enqueueTransition: jest.fn() };
  const service = new OrderPhotoService(
    db,
    finance,
    {} as never,
    partner,
    {} as never,
    {} as never,
    {} as never,
    outbox,
  );
  return { order, db, finance, service };
}

describe('order editing and payment integrity', () => {
  it.each(['PHOTO', 'CANVAS', 'TSHIRT'])(
    '%s switches shipping to pickup atomically',
    async (productCategory) => {
      const { service, db, finance } = setup({ productCategory });
      const updated = await service.updateOrder(
        'order',
        { deliveryMethod: 'PICKUP', deliveryCost: 300 },
        'manager',
      );
      expect(updated).toMatchObject({
        status: 'READY',
        deliveryCost: 0,
        totalOrder: 1000,
        shipmentRemindersSent: 0,
      });
      expect(db.statusHistory.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order',
          fromStatus: 'SHIPMENT_CREATED',
          toStatus: 'READY',
          changedBy: 'manager',
        },
      });
      expect(finance.recalcPendingAccrual).toHaveBeenCalledWith(
        'order',
        1000,
        0,
        db,
      );
    },
  );
  it('contact/note edits preserve a manually agreed total', async () => {
    const { service, order, finance } = setup({
      status: 'NEW',
      totalOrder: 2000,
    });
    await service.updateOrder('order', { note: 'Changed note' });
    expect(order.totalOrder).toBe(2000);
    expect(finance.recalcPendingAccrual).not.toHaveBeenCalled();
  });
  it('rejects empty contact and incompatible courier category', async () => {
    const { service } = setup();
    await expect(
      service.updateOrder('order', { urlCommunication: '' }),
    ).rejects.toThrow('контакт');
    await expect(
      service.updateOrder('order', { deliveryMethod: 'PRODUCTION_MSK' }),
    ).rejects.toThrow('холстов');
  });
  it('preserves and pays photo salary when SENT becomes PAID', async () => {
    const { service, db } = setup({ status: 'SENT' });
    db.salaryAccrual.findMany.mockResolvedValue([
      {
        id: 'accrual',
        executorId: 'executor',
        salaryAmount: 300,
        paidAmount: 0,
        status: 'PENDING',
      },
    ]);
    await service.updateStatusOrder(
      'order',
      { status: EnumStatus.PAID },
      'admin',
      EnumRole.ADMIN,
    );
    expect(db.salaryAccrual.deleteMany).not.toHaveBeenCalled();
    expect(db.salaryPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 300 }),
      }),
    );
    expect(db.paymentAccrualLink.create).toHaveBeenCalledTimes(1);
  });
  it('rechecks delivery under the row lock', async () => {
    const { service, db, order } = setup({ status: 'READY' });
    db.orderPhoto.findUnique
      .mockResolvedValueOnce({ ...order })
      .mockResolvedValue({ ...order, deliveryMethod: 'PICKUP' });
    await expect(
      service.updateStatusOrder(
        'order',
        { status: EnumStatus.SHIPMENT_CREATED },
        'admin',
        EnumRole.ADMIN,
      ),
    ).rejects.toThrow('самовывоза');
    expect(db.orderPhoto.update).not.toHaveBeenCalled();
  });
  it('does not replay payment or reset timers on an identical status', async () => {
    const { service, db } = setup({ status: 'PAID' });
    await service.updateStatusOrder(
      'order',
      { status: EnumStatus.PAID },
      'admin',
      EnumRole.ADMIN,
    );
    expect(db.salaryPayment.create).not.toHaveBeenCalled();
    expect(db.statusHistory.create).not.toHaveBeenCalled();
  });
  it('restricts deletion to administrators', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        // eslint-disable-next-line @typescript-eslint/unbound-method -- inspect decorator metadata, never invoke detached method
        OrderPhotoController.prototype.deleteOrder,
      ),
    ).toEqual([EnumRole.ADMIN]);
  });
});
