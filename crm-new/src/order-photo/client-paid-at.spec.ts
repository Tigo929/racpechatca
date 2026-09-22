import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { ROLES_KEY } from 'src/auth/decorators/roles.decorator';
import { PATH_METADATA } from '@nestjs/common/constants';
import { recognitionDate } from 'src/reports/reports.service';
import { calendarDateIn } from 'src/metrika/analytics/metrika-dates';
import { OrderPhotoController } from './order-photo.controller';
import { OrderPhotoService } from './order-photo.service';
import { SalaryService } from 'src/salary/salary.service';

/**
 * Работа D1 — фактическая дата оплаты.
 *
 * Аудит 22.09.2026 показал: в PAID ведут два пути, и они означают разное.
 * Ручной перевод делает человек, узнав про деньги, — там момент действия
 * годится. Автоперевод при выплате зарплаты закрывает недельную пачку
 * заказов одной секундой (16.09 — 40 заказов за две секунды), и датой оплаты
 * клиентом он не является. Эти тесты стерегут именно это различие: система
 * не должна «помочь» и подставить дату там, где её никто не знает.
 */

const NOW = new Date('2026-09-22T19:00:00Z'); // 22:00 MSK 22.09.2026

describe('OrderPhotoService.setClientPaidAt', () => {
  const order = (over: Record<string, unknown> = {}) => ({
    id: 'ord-1',
    numberOrder: '20260909-091',
    status: 'PAID',
    createdAt: new Date('2026-09-09T11:25:00Z'),
    clientPaidAt: null,
    ...over,
  });

  function make(row: ReturnType<typeof order> | null) {
    const findUnique = jest.fn().mockResolvedValue(row);
    const update = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        ...row,
        ...data,
      }));
    const prisma = { orderPhoto: { findUnique, update } };
    const service = new OrderPhotoService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, update, findUnique };
  }

  it('оплаченный заказ без даты — дата сохраняется, и только она', async () => {
    const { service, update } = make(order());
    await service.setClientPaidAt('ord-1', '2026-09-16');

    expect(update).toHaveBeenCalledTimes(1);
    const calls = update.mock.calls as [{ data: { clientPaidAt: Date } }][];
    const call = calls[0][0];
    expect(Object.keys(call.data)).toEqual(['clientPaidAt']);
    // введённый день остаётся тем же днём в московском календаре отчётов
    expect(calendarDateIn(call.data.clientPaidAt)).toBe('2026-09-16');
  });

  it('дата уже зафиксирована — отказ, старое значение неприкосновенно', async () => {
    const { service, update } = make(
      order({ clientPaidAt: new Date('2026-09-12T08:00:00Z') }),
    );
    await expect(
      service.setClientPaidAt('ord-1', '2026-09-16'),
    ).rejects.toThrow(/уже зафиксирована/);
    expect(update).not.toHaveBeenCalled();
  });

  it('заказ не оплачен — указывать дату оплаты нечему', async () => {
    const { service, update } = make(order({ status: 'SENT' }));
    await expect(
      service.setClientPaidAt('ord-1', '2026-09-16'),
    ).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('заказа нет — 404', async () => {
    const { service } = make(null);
    await expect(
      service.setClientPaidAt('нет-такого', '2026-09-16'),
    ).rejects.toThrow(NotFoundException);
  });

  it('дата в будущем и дата раньше заказа — отказ', async () => {
    const { service, update } = make(order());
    await expect(
      service.setClientPaidAt('ord-1', '2027-01-01'),
    ).rejects.toThrow(/будущем/);
    await expect(
      service.setClientPaidAt('ord-1', '2026-09-01'),
    ).rejects.toThrow(/раньше создания заказа/);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('маршрут «указать дату оплаты» — только администратор', () => {
  it('на обработчике стоит ADMIN и отдельный узкий путь', () => {
    // берём дескриптор, а не ссылку на метод: сам метод здесь не вызывается,
    // нас интересуют только метаданные маршрута
    const handler = Object.getOwnPropertyDescriptor(
      OrderPhotoController.prototype,
      'setClientPaidAt',
    )?.value as object;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([EnumRole.ADMIN]);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      ':idOrder/paid-at',
    );
  });
});

describe('SalaryService: расчёт с исполнителем — не дата оплаты клиентом', () => {
  function make() {
    const orderUpdates: Record<string, unknown>[] = [];
    const accrual = (id: string, orderId: string, numberOrder: string) => ({
      id,
      orderId,
      salaryAmount: 500,
      paidAmount: 0,
      kind: 'ORDER',
      note: null,
      salaryBase: 1000,
      rateBasisPoints: 5000,
      createdAt: new Date('2026-09-10T10:00:00Z'),
      order: {
        numberOrder,
        totalOrder: 1000,
        deliveryCost: 0,
        createdAt: new Date('2026-09-09T10:00:00Z'),
        status: 'SENT',
        urlCommunication: null,
        communicationPlatform: 'TELEGRAM',
      },
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      salaryAccrual: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            accrual('acc-1', 'ord-1', '20260909-091'),
            accrual('acc-2', 'ord-2', '20260909-092'),
          ]),
        update: jest.fn().mockResolvedValue({}),
      },
      salaryPayment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1', createdAt: NOW }),
      },
      paymentAccrualLink: { create: jest.fn().mockResolvedValue({}) },
      orderPhoto: {
        update: jest
          .fn()
          .mockImplementation((args: { data: Record<string, unknown> }) => {
            orderUpdates.push(args.data);
            return {};
          }),
      },
      statusHistory: { create: jest.fn().mockResolvedValue({ id: 'hist-1' }) },
    };
    const prisma = {
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    };
    const outbox = { enqueueTransition: jest.fn().mockResolvedValue({}) };
    const service = new SalaryService(prisma as never, outbox as never);
    return { service, tx, orderUpdates };
  }

  it('переводит заказы в PAID, но даты оплаты не выдумывает', async () => {
    const { service, orderUpdates } = make();
    const result = await service.createPaymentByAccruals(
      { executorId: 'ex-1', accrualIds: ['acc-1', 'acc-2'] },
      'admin-1',
    );

    // в заказы ушёл только статус — ни clientPaidAt, ни даты выплаты
    expect(orderUpdates).toEqual([{ status: 'PAID' }, { status: 'PAID' }]);
    for (const data of orderUpdates) {
      expect('clientPaidAt' in data).toBe(false);
    }
    // и пакет не создаёт одинаковых искусственных дат: их вообще нет
    expect(
      (result as { ordersWithoutPaidDate: unknown[] }).ordersWithoutPaidDate,
    ).toEqual([
      { id: 'ord-1', numberOrder: '20260909-091' },
      { id: 'ord-2', numberOrder: '20260909-092' },
    ]);
  });

  it('выплата не блокируется отсутствием даты оплаты', async () => {
    const { service } = make();
    const result = (await service.createPaymentByAccruals(
      { executorId: 'ex-1', accrualIds: ['acc-1', 'acc-2'] },
      'admin-1',
    )) as { paymentId: string; totalAmount: number };
    expect(result.paymentId).toBe('pay-1');
    expect(result.totalAmount).toBe(1000);
  });
});

describe('аналитика не меняется: правило признания выручки то же', () => {
  const base = {
    completedAt: null,
    statusChangedAt: new Date('2026-09-16T16:18:00Z'),
    sentAt: new Date('2026-09-13T20:31:00Z'),
    createdAt: new Date('2026-09-09T11:25:00Z'),
  };

  it('есть clientPaidAt — берётся он', () => {
    const at = recognitionDate({
      ...base,
      clientPaidAt: new Date('2026-09-14T09:00:00Z'),
    });
    expect(at.toISOString()).toBe('2026-09-14T09:00:00.000Z');
  });

  it('нет clientPaidAt — прежняя цепочка запасных полей', () => {
    const at = recognitionDate({ ...base, clientPaidAt: null });
    expect(at.toISOString()).toBe(base.statusChangedAt.toISOString());
  });

  it('D1 не меняет алгоритм: появление даты лишь переносит заказ на свой день', () => {
    const withoutDate = recognitionDate({ ...base, clientPaidAt: null });
    const withDate = recognitionDate({
      ...base,
      clientPaidAt: new Date('2026-09-14T09:00:00Z'),
    });
    expect(calendarDateIn(withoutDate)).toBe('2026-09-16');
    expect(calendarDateIn(withDate)).toBe('2026-09-14');
  });
});

describe('ручной перевод в PAID с фактической датой', () => {
  const orderRow = (over: Record<string, unknown> = {}) => ({
    id: 'ord-1',
    numberOrder: '20260909-091',
    status: 'SENT',
    productCategory: 'PHOTO',
    deliveryMethod: 'PICKUP',
    executorId: 'ex-1',
    createdAt: new Date('2026-09-09T11:25:00Z'),
    clientPaidAt: null,
    sentAt: new Date('2026-09-13T20:31:00Z'),
    items: [{ id: 'i-1' }],
    tshirtItems: [],
    canvasItems: [],
    accruals: [],
    executor: { id: 'ex-1', username: 'печатник' },
    ...over,
  });

  function make(row: ReturnType<typeof orderRow>) {
    const findUnique = jest.fn().mockResolvedValue(row);
    // до транзакции дело дойти не должно: все отказы — раньше неё
    const $transaction = jest.fn().mockImplementation(() => {
      throw new Error('транзакция не должна была начаться');
    });
    const prisma = { orderPhoto: { findUnique }, $transaction };
    const service = new OrderPhotoService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, $transaction };
  }

  it('дата вместе с не-PAID статусом — отказ', async () => {
    const { service, $transaction } = make(orderRow());
    await expect(
      service.updateStatusOrder(
        'ord-1',
        { status: 'READY', clientPaidAt: '2026-09-16' } as never,
        'admin-1',
        'ADMIN',
      ),
    ).rejects.toThrow(/только при переводе заказа/);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('дата у заказа, где она уже зафиксирована, — отказ', async () => {
    const { service, $transaction } = make(
      orderRow({
        status: 'PAID',
        clientPaidAt: new Date('2026-09-12T08:00:00Z'),
      }),
    );
    await expect(
      service.updateStatusOrder(
        'ord-1',
        { status: 'PAID', clientPaidAt: '2026-09-16' } as never,
        'admin-1',
        'ADMIN',
      ),
    ).rejects.toThrow(/уже зафиксирована/);
    expect($transaction).not.toHaveBeenCalled();
  });

  it('недопустимая дата отклоняется до записи', async () => {
    const { service, $transaction } = make(orderRow());
    await expect(
      service.updateStatusOrder(
        'ord-1',
        { status: 'PAID', clientPaidAt: '2027-01-01' } as never,
        'admin-1',
        'ADMIN',
      ),
    ).rejects.toThrow(/будущем/);
    await expect(
      service.updateStatusOrder(
        'ord-1',
        { status: 'PAID', clientPaidAt: '2026-09-01' } as never,
        'admin-1',
        'ADMIN',
      ),
    ).rejects.toThrow(/раньше создания заказа/);
    expect($transaction).not.toHaveBeenCalled();
  });
});

describe('поле пишется только в трёх разрешённых местах', () => {
  const source = readFileSync(
    join(__dirname, 'order-photo.service.ts'),
    'utf8',
  );

  it('в сервисе заказов нет других мест записи clientPaidAt', () => {
    const writes = source
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(
        (l) =>
          !l.startsWith('//') &&
          !l.startsWith('*') &&
          /clientPaidAt/.test(l) &&
          !/current:|order\.clientPaidAt|lockedOrder\.clientPaidAt|dto\.clientPaidAt|clientPaidAt: true|parseClientPaidAt|clientPaidAtPatch/.test(
            l,
          ),
      );
    // ровно три места: заведение уже оплаченного заказа, узкое действие
    // «указать дату оплаты» и запись о нём в журнал — больше ничего
    expect(writes).toEqual([
      '...(createdPaidAt ? { clientPaidAt: createdPaidAt } : {}),',
      '`Заказ ${order.numberOrder}: указана фактическая дата оплаты ${clientPaidAt.toISOString()}`,',
      'data: { clientPaidAt },',
    ]);
  });

  it('обычное редактирование заказа поле не принимает', () => {
    const dto = readFileSync(
      join(__dirname, 'dto', 'update-order.dto.ts'),
      'utf8',
    );
    expect(dto).not.toMatch(/clientPaidAt/);
  });
});
