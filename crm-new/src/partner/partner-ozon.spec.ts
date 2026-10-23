import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PartnerOzonController } from './partner-ozon.controller';
import type { PrismaService } from 'src/prisma/prisma.service';
import type { TechSpecStorageService } from './tech-spec-storage.service';

/**
 * Поиск заказа по номеру отправления Ozon для сборки.
 *
 * Смысл метода — в том, чего он НЕ отдаёт. Раньше сборка узнавала наш
 * заказ через кабинет маркетплейса, а доступ к кабинету — это ключ от
 * магазина: товары, цены, остатки, отгрузки. Ради строчки «какой это
 * заказ» отдавать ключ нельзя.
 *
 * Поэтому здесь закреплены границы: только футболки, только два поля
 * наружу, и понятный отказ вместо поиска по мусору в адресе.
 */
describe('заказ по номеру отправления', () => {
  const ORDER = {
    id: 'order-1',
    numberOrder: '20261023-299',
    techSpecPhotoPath: 'maket.png',
    techSpecPhotoPaths: ['maket.png', 'maket-2.png'],
  };

  function build(order: typeof ORDER | null) {
    const findFirst = jest.fn().mockResolvedValue(order);
    const read = jest
      .fn()
      .mockResolvedValue({ buffer: Buffer.from('файл'), contentType: 'image/png' });
    const controller = new PartnerOzonController(
      { orderPhoto: { findFirst } } as unknown as PrismaService,
      { read } as unknown as TechSpecStorageService,
    );
    return { controller, findFirst, read };
  }

  it('отдаёт наш заказ по номеру отправления', async () => {
    const { controller } = build(ORDER);

    await expect(
      controller.findByPosting('0112649382-0047-1'),
    ).resolves.toEqual({ id: 'order-1', numberOrder: '20261023-299' });
  });

  it('наружу уходят только идентификатор и номер', async () => {
    // Ни сумм, ни покупателя, ни путей к файлам на диске.
    const { controller } = build(ORDER);

    const answer = await controller.findByPosting('0112649382-0047-1');

    expect(Object.keys(answer).sort()).toEqual(['id', 'numberOrder']);
  });

  it('ищет только футболки', async () => {
    // Граница прав ставится явно, а не держится на «и так не получится».
    const { controller, findFirst } = build(ORDER);

    await controller.findByPosting('43479022-0627-1');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          marketplacePostingNumber: '43479022-0627-1',
          productCategory: 'TSHIRT',
        }),
      }),
    );
  });

  it('нет заказа — 404, а не пустой ответ', async () => {
    // Сборка должна отличить «не завели» от «завели без макета».
    const { controller } = build(null);

    await expect(controller.findByPosting('0112649382-0047-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('мусор в адресе отбивается до запроса к базе', async () => {
    const { controller, findFirst } = build(ORDER);

    await expect(controller.findByPosting('../../etc/passwd')).rejects.toThrow(
      BadRequestException,
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('макет отдаётся сразу по номеру отправления', async () => {
    // Один запрос вместо двух на каждый отсканированный стикер.
    const { controller, read } = build(ORDER);
    const res = { setHeader: jest.fn(), end: jest.fn() };

    await controller.techSpecPhoto('0112649382-0047-1', res as never);

    expect(read).toHaveBeenCalledWith('maket.png');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('можно забрать второй файл набора', async () => {
    const { controller, read } = build(ORDER);
    const res = { setHeader: jest.fn(), end: jest.fn() };

    await controller.techSpecPhotoByIndex('0112649382-0047-1', '1', res as never);

    expect(read).toHaveBeenCalledWith('maket-2.png');
  });

  it('заказ без макета — 404, а не пустая картинка', async () => {
    const { controller } = build({
      ...ORDER,
      techSpecPhotoPath: null as unknown as string,
      techSpecPhotoPaths: [],
    });
    const res = { setHeader: jest.fn(), end: jest.fn() };

    await expect(
      controller.techSpecPhoto('0112649382-0047-1', res as never),
    ).rejects.toThrow(NotFoundException);
  });
});
