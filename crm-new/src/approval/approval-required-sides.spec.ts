import { ApprovalService } from './approval.service';

const date = new Date('2026-10-04T10:00:00Z');

/**
 * Лист согласования должен знать сторону печати из заказа.
 *
 * Тест сторожит именно проводку: правило само проверено в
 * approval-sides.spec.ts, но если согласование перестанет забирать
 * printLocation из заказа, интерфейс снова покажет обе стороны и забытая
 * спина уйдёт в производство — а это брак на готовой футболке.
 */
describe('стороны заказа в виде согласования', () => {
  function service(tshirtItems: { clientItem: boolean; printLocation: string }[]) {
    const row = {
      id: 'approval',
      orderId: 'order',
      version: 1,
      shirtColor: 'Белый',
      shirtSize: 'M',
      sides: {},
      updatedAt: date,
      finalizedAt: null,
      order: { items: [], tshirtItems },
    };
    const prisma = {
      printApproval: { findUnique: jest.fn().mockResolvedValue(row) },
    };
    return new ApprovalService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('печать сзади — наружу уходит только спина', async () => {
    await expect(
      service([{ clientItem: false, printLocation: 'BACK' }]).get('approval'),
    ).resolves.toMatchObject({ requiredSides: ['BACK'], strictSides: true });
  });

  it('двусторонняя — обе стороны, перед первым', async () => {
    await expect(
      service([{ clientItem: false, printLocation: 'FRONT_BACK' }]).get(
        'approval',
      ),
    ).resolves.toMatchObject({
      requiredSides: ['FRONT', 'BACK'],
      strictSides: true,
    });
  });

  it('печать по ТЗ не ограничивает оператора', async () => {
    await expect(
      service([{ clientItem: false, printLocation: 'BY_TZ' }]).get('approval'),
    ).resolves.toMatchObject({ requiredSides: [], strictSides: false });
  });

  it('заказ без футболок (фотопечать) тоже не ограничивает', async () => {
    await expect(service([]).get('approval')).resolves.toMatchObject({
      requiredSides: [],
      strictSides: false,
    });
  });
});
