import { ApprovalService } from './approval.service';

/**
 * Какой позиции заказа принадлежит новый макет.
 *
 * Это и есть ответ на «какой размер заказали»: раньше цвет и размер
 * приходили из браузера, где их брали из первой позиции, и в заказе на три
 * размера все три листа выходили одинаковыми. Печатник этого не видел.
 */

const positions = [
  { id: 'a', color: 'Чёрный', size: 'S' },
  { id: 'b', color: 'Белый', size: 'M' },
  { id: 'c', color: 'Чёрный', size: 'L' },
];

function build(
  options: { covered?: (string | null)[]; source?: unknown } = {},
) {
  const create = jest.fn().mockImplementation((args: { data: unknown }) => ({
    ...(args.data as Record<string, unknown>),
    updatedAt: new Date(),
    finalizedAt: null,
    order: { items: [], tshirtItems: [] },
  }));
  const prisma = {
    orderPhoto: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'o1', tshirtItems: positions }),
    },
    printApproval: {
      findFirst: jest.fn().mockResolvedValue({ version: 2 }),
      findMany: jest
        .fn()
        .mockResolvedValue(
          (options.covered ?? []).map((itemId) => ({ itemId })),
        ),
      findUnique: jest.fn().mockResolvedValue(options.source ?? null),
      create,
    },
  };
  const service = new ApprovalService(
    prisma as never,
    { copyPrint: jest.fn() } as never,
    {} as never,
    // Шаблона мокапа нет — для выбора позиции это неважно, а загрузка
    // принта о нём скажет своими словами.
    { findByColorAndSide: jest.fn().mockResolvedValue(null) } as never,
  );
  return { service, create, prisma };
}

/** Данные, с которыми вызвали мок. Без типа линтер видит `any`. */
function dataOf(create: jest.Mock): Record<string, unknown> {
  return (create.mock.calls[0] as { data: Record<string, unknown> }[])[0].data;
}

describe('позиция нового макета', () => {
  it('без указания берётся первая позиция без макета', async () => {
    const { service, create } = build({ covered: ['a'] });

    await service.create({ orderId: 'o1' }, 'u1');

    expect(dataOf(create)).toMatchObject({
      itemId: 'b',
      shirtColor: 'Белый',
      shirtSize: 'M',
      version: 3,
    });
  });

  it('размер и цвет берутся из позиции, а не из запроса', async () => {
    // Браузер мог прислать что угодно — в том числе прошлое значение из
    // открытой вкладки. Решает заказ.
    const { service, create } = build({ covered: [] });

    await service.create(
      { orderId: 'o1', shirtColor: 'Красный', shirtSize: 'XXXL' },
      'u1',
    );

    expect(dataOf(create)).toMatchObject({
      itemId: 'a',
      shirtColor: 'Чёрный',
      shirtSize: 'S',
    });
  });

  it('названную позицию берём как есть', async () => {
    const { service, create } = build({ covered: [] });

    await service.create({ orderId: 'o1', itemId: 'c' }, 'u1');

    expect(dataOf(create)).toMatchObject({ itemId: 'c', shirtSize: 'L' });
  });

  it('позиция чужого заказа отвергается', async () => {
    const { service } = build();

    await expect(
      service.create({ orderId: 'o1', itemId: 'чужая' }, 'u1'),
    ).rejects.toThrow('не принадлежит этому заказу');
  });

  it('новая версия остаётся про тот же размер', async () => {
    // «Новая версия из v2» — это правки по тому же размеру, а не макет
    // следующей позиции.
    const { service, create } = build({
      covered: ['a', 'b', 'c'],
      source: { orderId: 'o1', itemId: 'b', sides: {} },
    });

    await service.create({ orderId: 'o1', copyFromId: 'v2' }, 'u1');

    expect(dataOf(create)).toMatchObject({ itemId: 'b', shirtSize: 'M' });
  });

  it('макеты есть у всех позиций — берётся первая', async () => {
    // Значит делают ещё одну версию: выбор позиции всё равно за человеком.
    const { service, create } = build({ covered: ['a', 'b', 'c'] });

    await service.create({ orderId: 'o1' }, 'u1');

    expect(dataOf(create)).toMatchObject({ itemId: 'a' });
  });

  it('заказ без позиций футболок просит цвет и размер', async () => {
    // Печать на изделии клиента: позиция свободная, размер знает человек.
    const { service, prisma, create } = build();
    prisma.orderPhoto.findUnique.mockResolvedValue({
      id: 'o1',
      tshirtItems: [],
    });

    await expect(service.create({ orderId: 'o1' }, 'u1')).rejects.toThrow(
      'укажите цвет и размер',
    );

    await service.create(
      { orderId: 'o1', shirtColor: 'Чёрный', shirtSize: 'XL' },
      'u1',
    );
    expect(dataOf(create)).toMatchObject({ itemId: null, shirtSize: 'XL' });
  });
});
