import { ApprovalService } from './approval.service';

const date = new Date('2026-09-24T10:00:00Z');

describe('customer-owned garment in approvals', () => {
  it.each([
    [{ items: [{ printOnClientItem: true }], tshirtItems: [] }, true],
    [{ items: [], tshirtItems: [{ clientItem: true }] }, true],
    [{ items: [{ printOnClientItem: false }], tshirtItems: [] }, false],
    [{ items: [], tshirtItems: [{ clientItem: false }] }, false],
  ])('uses the order flags for existing and new versions: %j', async (order, expected) => {
    const row = { id: 'approval', orderId: 'order', version: 1, shirtColor: 'Белый', shirtSize: 'M', sides: {}, updatedAt: date, finalizedAt: null, order };
    const prisma = {
      printApproval: { findUnique: jest.fn().mockResolvedValue(row), findMany: jest.fn().mockResolvedValue([row]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(row) },
      orderPhoto: { findUnique: jest.fn().mockResolvedValue({ id: 'order' }) },
    };
    const service = new ApprovalService(prisma as never, {} as never, {} as never, {} as never);
    expect(await service.get('approval')).toMatchObject({ clientItem: expected });
    expect((await service.list('order'))[0]).toMatchObject({ clientItem: expected });
    expect(await service.create({ orderId: 'order', shirtColor: 'Белый', shirtSize: 'M' }, null)).toMatchObject({ clientItem: expected });
    expect(await service.get('approval')).not.toHaveProperty('order');
  });
});
