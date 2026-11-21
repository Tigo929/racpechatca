import { BadRequestException } from '@nestjs/common';
import { bulkShipBlocker } from './bulk-ship';
import { BulkShipService } from './bulk-ship.service';

/**
 * Пачка «Отправлен».
 *
 * Главное, что сторожим: пачка не становится вторым путём смены статуса.
 * Каждый пропущенный заказ уходит в тот же updateStatusOrder, что и кнопка
 * в карточке, а неподходящий не доходит до него вовсе.
 */
describe('bulkShipBlocker', () => {
  const ok = {
    productCategory: 'PHOTO',
    status: 'SHIPMENT_CREATED',
    executorId: 'u1',
  };

  it('пропускает фотозаказ из «Отгрузка создана» с исполнителем', () => {
    expect(bulkShipBlocker(ok)).toBeNull();
  });

  it('не берёт футболки и холсты', () => {
    expect(bulkShipBlocker({ ...ok, productCategory: 'TSHIRT' })).toMatch(
      /фотопечати/,
    );
    expect(bulkShipBlocker({ ...ok, productCategory: 'CANVAS' })).toMatch(
      /фотопечати/,
    );
  });

  it('не берёт заказ из другого статуса', () => {
    expect(bulkShipBlocker({ ...ok, status: 'READY' })).toMatch(
      /Отгрузка создана/,
    );
    expect(bulkShipBlocker({ ...ok, status: 'SENT' })).toMatch(
      /Отгрузка создана/,
    );
  });

  it('не берёт заказ без исполнителя — зарплата не начислилась бы никому', () => {
    expect(bulkShipBlocker({ ...ok, executorId: null })).toMatch(/исполнитель/);
  });
});

describe('BulkShipService', () => {
  const row = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    numberOrder: `N-${id}`,
    productCategory: 'PHOTO',
    status: 'SHIPMENT_CREATED',
    executorId: 'exec-1',
    ...over,
  });

  function make(
    rows: ReturnType<typeof row>[],
    update = jest.fn().mockResolvedValue({}),
  ) {
    const prisma = {
      orderPhoto: { findMany: jest.fn().mockResolvedValue(rows) },
    };
    const orders = { updateStatusOrder: update };
    const service = new BulkShipService(prisma as never, orders as never);
    return { service, update };
  }

  it('переводит каждый подходящий заказ тем же updateStatusOrder', async () => {
    const { service, update } = make([row('a'), row('b')]);
    const res = await service.ship(['a', 'b'], 'admin-1', 'ADMIN');

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith(
      'a',
      { status: 'SENT' },
      'admin-1',
      'ADMIN',
    );
    expect(update).toHaveBeenCalledWith(
      'b',
      { status: 'SENT' },
      'admin-1',
      'ADMIN',
    );
    expect(res).toMatchObject({ shipped: 2, failed: 0 });
  });

  it('неподходящий и ненайденный заказ до перевода не доходят', async () => {
    const { service, update } = make([
      row('a'),
      row('b', { executorId: null }),
    ]);
    const res = await service.ship(['a', 'b', 'missing'], 'u', 'ADMIN');

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('a', { status: 'SENT' }, 'u', 'ADMIN');
    expect(res.shipped).toBe(1);
    expect(res.failed).toBe(2);
    expect(res.results.find((r) => r.id === 'missing')?.error).toMatch(
      /не найден/,
    );
  });

  it('отказ по одному заказу не останавливает остальные и показывается его словами', async () => {
    const update = jest
      .fn()
      .mockRejectedValueOnce(
        new BadRequestException('Сначала создайте отгрузку'),
      )
      .mockResolvedValue({});
    const { service } = make([row('a'), row('b')], update);
    const res = await service.ship(['a', 'b'], 'u', 'ADMIN');

    expect(res.results).toEqual([
      {
        id: 'a',
        numberOrder: 'N-a',
        ok: false,
        error: 'Сначала создайте отгрузку',
      },
      { id: 'b', numberOrder: 'N-b', ok: true },
    ]);
  });

  it('повтор одного и того же заказа в списке не отмечает его дважды', async () => {
    const { service, update } = make([row('a')]);
    await service.ship(['a', 'a'], 'u', 'ADMIN');
    expect(update).toHaveBeenCalledTimes(1);
  });
});
