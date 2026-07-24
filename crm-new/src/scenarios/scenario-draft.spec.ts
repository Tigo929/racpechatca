import { BadRequestException, ConflictException } from '@nestjs/common';
import { ScenarioDraftService } from './scenario-draft.service';
import type { PrismaService } from 'src/prisma/prisma.service';

/**
 * Проверяем оформление заказа из черновика: суммы, защиту от повторного
 * оформления и очистку ответов при смене продукта. Прайс тут настоящий —
 * ошибка в этих числах стоит денег.
 */

interface FakeOrder {
  id: string;
  numberOrder: string;
  status: string;
  scenarioKey: string | null;
  scenarioAnswers: unknown;
}

function makeHarness(order: FakeOrder) {
  const photoItems: Record<string, unknown>[] = [];
  const tshirtItems: Record<string, unknown>[] = [];
  const history: Record<string, unknown>[] = [];
  let updated: Record<string, unknown> = {};

  const tx = {
    orderPhoto: {
      findUnique: jest.fn(() => Promise.resolve({ ...order })),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        updated = data;
        return Promise.resolve({ ...order, ...data });
      }),
    },
    itemPhoto: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        photoItems.push(data);
        return Promise.resolve(data);
      }),
    },
    itemTshirt: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        tshirtItems.push(data);
        return Promise.resolve(data);
      }),
    },
    statusHistory: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        history.push(data);
        return Promise.resolve(data);
      }),
    },
  };

  const prisma = {
    orderPhoto: {
      findUnique: jest.fn(() => Promise.resolve({ ...order })),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        Object.assign(order, data);
        return Promise.resolve({ ...order });
      }),
    },
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
  } as unknown as PrismaService;

  return {
    service: new ScenarioDraftService(prisma),
    photoItems,
    tshirtItems,
    history,
    get updated() {
      return updated;
    },
  };
}

const READY_PHOTO = {
  photoFormat: '10×15',
  paperType: 'GLOSS',
  quantity: 40,
  filesReceived: true,
  deliveryMethod: 'YANDEX_PVZ',
  deliveryAddress: 'Москва',
  deliveryCost: 300,
  photoPrice: 1200,
};

const READY_TSHIRT = {
  tshirtModel: 'Хлопок 160',
  color: 'Чёрный',
  size: 'L',
  gender: 'UNISEX',
  quantity: 2,
  printLocation: 'FRONT',
  designReady: true,
  deliveryMethod: 'PICKUP',
  pricePerItem: 1500,
};

describe('оформление заказа из черновика', () => {
  it('фото: итог = договорная сумма + доставка', async () => {
    const h = makeHarness({
      id: 'o1',
      numberOrder: '20260724-001',
      status: 'LEAD',
      scenarioKey: 'PHOTO',
      scenarioAnswers: READY_PHOTO,
    });

    await h.service.convertToOrder('o1', 'manager-1');

    expect(h.updated.totalOrder).toBe(1500);
    expect(h.updated.status).toBe('NEW');
    // Кто оформил — от этого зависит начисление зарплаты менеджеру.
    expect(h.updated.processedById).toBe('manager-1');
    expect(h.photoItems).toHaveLength(1);
    expect(h.photoItems[0]).toMatchObject({ pricePosition: 1200, isFreePrice: true });
  });

  it('футболки: итог = цена за штуку × количество, доставки нет', async () => {
    const h = makeHarness({
      id: 'o2',
      numberOrder: '20260724-002',
      status: 'LEAD',
      scenarioKey: 'TSHIRT',
      scenarioAnswers: READY_TSHIRT,
    });

    await h.service.convertToOrder('o2', 'manager-1');

    expect(h.updated.totalOrder).toBe(3000);
    expect(h.tshirtItems[0]).toMatchObject({ price: 1500, pricePosition: 3000 });
  });

  it('дизайн прибавляется к чеку сверх позиций', async () => {
    const h = makeHarness({
      id: 'o3',
      numberOrder: '20260724-003',
      status: 'LEAD',
      scenarioKey: 'TSHIRT',
      scenarioAnswers: {
        ...READY_TSHIRT,
        designReady: false,
        designNeeded: true,
        designBrief: 'Логотип',
        designDevelopmentCost: 700,
      },
    });

    await h.service.convertToOrder('o3', 'manager-1');

    expect(h.updated.totalOrder).toBe(3700);
    expect(h.updated.designDevelopmentCost).toBe(700);
    // В цену позиции дизайн не подмешивается — иначе партнёр получит долю с него.
    expect(h.tshirtItems[0].pricePosition).toBe(3000);
  });

  it('переход статуса записывается в историю', async () => {
    const h = makeHarness({
      id: 'o4',
      numberOrder: '20260724-004',
      status: 'LEAD',
      scenarioKey: 'PHOTO',
      scenarioAnswers: READY_PHOTO,
    });

    await h.service.convertToOrder('o4', 'manager-7');

    expect(h.history[0]).toMatchObject({
      fromStatus: 'LEAD',
      toStatus: 'NEW',
      changedBy: 'manager-7',
    });
  });

  it('без собранных данных заказ не оформить, и видно чего не хватает', async () => {
    const h = makeHarness({
      id: 'o5',
      numberOrder: '20260724-005',
      status: 'LEAD',
      scenarioKey: 'PHOTO',
      scenarioAnswers: { photoFormat: '10×15' },
    });

    await expect(h.service.convertToOrder('o5', 'm')).rejects.toThrow(
      BadRequestException,
    );
    await expect(h.service.convertToOrder('o5', 'm')).rejects.toThrow(/Бумага/);
  });

  it('без выбранного продукта не оформляем', async () => {
    const h = makeHarness({
      id: 'o6',
      numberOrder: '20260724-006',
      status: 'LEAD',
      scenarioKey: null,
      scenarioAnswers: {},
    });

    await expect(h.service.convertToOrder('o6', 'm')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('повторное оформление того же обращения запрещено', async () => {
    const h = makeHarness({
      id: 'o7',
      numberOrder: '20260724-007',
      status: 'NEW',
      scenarioKey: 'PHOTO',
      scenarioAnswers: READY_PHOTO,
    });

    await expect(h.service.convertToOrder('o7', 'm')).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('черновик', () => {
  it('ответы дописываются, а не затирают собранное', async () => {
    const h = makeHarness({
      id: 'd1',
      numberOrder: '20260724-010',
      status: 'LEAD',
      scenarioKey: 'PHOTO',
      scenarioAnswers: { photoFormat: '10×15', quantity: 40 },
    });

    const state = await h.service.saveDraft('d1', { answers: { paperType: 'MATTE' } });

    expect(state.answers).toMatchObject({
      photoFormat: '10×15',
      quantity: 40,
      paperType: 'MATTE',
    });
  });

  it('смена продукта выбрасывает ответы прежнего сценария', async () => {
    const h = makeHarness({
      id: 'd2',
      numberOrder: '20260724-011',
      status: 'LEAD',
      scenarioKey: 'PHOTO',
      scenarioAnswers: { photoFormat: '10×15', paperType: 'GLOSS', quantity: 40 },
    });

    const state = await h.service.saveDraft('d2', { scenarioKey: 'TSHIRT' });

    expect(state.scenarioKey).toBe('TSHIRT');
    expect(state.answers.photoFormat).toBeUndefined();
    expect(state.answers.paperType).toBeUndefined();
    // Количество есть в обоих сценариях — его сохраняем, переспрашивать незачем.
    expect(state.answers.quantity).toBe(40);
  });

  it('черновик оформленного заказа не правим', async () => {
    const h = makeHarness({
      id: 'd3',
      numberOrder: '20260724-012',
      status: 'NEW',
      scenarioKey: 'PHOTO',
      scenarioAnswers: {},
    });

    await expect(
      h.service.saveDraft('d3', { answers: { quantity: 1 } }),
    ).rejects.toThrow(ConflictException);
  });

  it('прогресс считается вместе с черновиком', async () => {
    const h = makeHarness({
      id: 'd4',
      numberOrder: '20260724-013',
      status: 'LEAD',
      scenarioKey: 'PHOTO',
      scenarioAnswers: READY_PHOTO,
    });

    const state = await h.service.getDraft('d4');
    expect(state.progress?.ready).toBe(true);
  });
});
