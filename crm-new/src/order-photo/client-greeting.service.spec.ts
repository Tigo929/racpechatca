import { EnumCommunication } from 'src/generated/prisma/enums';
import { ClientGreetingService } from './client-greeting.service';

/**
 * Очередь первых сообщений.
 *
 * Проверяем не запрос к базе, а решения сервиса: кого он вообще спрашивает
 * у базы, что делает с нечитаемым никнеймом и что записывает по итогу.
 * Ошибка здесь не видна на экране — она видна клиенту, которому написали
 * второй раз или не написали вовсе.
 */
describe('ClientGreetingService', () => {
  const row = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'ord-1',
    numberOrder: '1043',
    urlCommunication: 'https://t.me/petrov',
    note: '🆕 Заявка с сайта\nИмя: Пётр\nТелефон: +7 900 000-00-00',
    createdAt: new Date('2026-09-02T10:00:00Z'),
    productCategory: 'PHOTO',
    totalOrder: 2790,
    deliveryCost: 300,
    deliveryMethod: 'YANDEX_PVZ',
    items: [{ formatPaper: 'Фото 10×15 с полями', quantity: 10 }],
    tshirtItems: [],
    canvasItems: [],
    ...over,
  });

  function make(rows: ReturnType<typeof row>[]) {
    const update = jest.fn().mockResolvedValue({});
    const findMany = jest.fn().mockResolvedValue(rows);
    const prisma = { orderPhoto: { findMany, update } };
    const service = new ClientGreetingService(prisma as never);
    return { service, findMany, update };
  }

  it('спрашивает только заявки сайта с телеграмом, которым ещё не писали', async () => {
    const { service, findMany } = make([]);
    await service.pending(20);

    const where = findMany.mock.calls[0][0].where;
    expect(where.clientGreetedAt).toBeNull();
    expect(where.communicationPlatform).toBe(EnumCommunication.TELEGRAM);
    expect(where.externalRequestId).toEqual({ startsWith: 'web-photo' });
    // Свежие: у фильтра по дате есть нижняя граница.
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it('отдаёт никнейм и имя, разобранные из заказа', async () => {
    const { service } = make([row()]);
    const [item] = await service.pending(20);

    expect(item.username).toBe('petrov');
    expect(item.name).toBe('Пётр');
    expect(item.numberOrder).toBe('1043');
  });

  it('отдаёт позиции и сумму — без них сообщение читается как рассылка', async () => {
    const { service } = make([row()]);
    const [item] = await service.pending(20);

    expect(item.category).toBe('PHOTO');
    expect(item.items).toEqual([
      { title: 'Фото 10×15 с полями', quantity: 10 },
    ]);
    expect(item.total).toBe(2790);
    expect(item.deliveryCost).toBe(300);
    expect(item.deliveryMethod).toBe('YANDEX_PVZ');
  });

  it('отдаёт ВСЕ позиции, а не первую', async () => {
    // В заказе бывает несколько форматов, и человек должен узнать
    // в сообщении именно то, что заказывал, а не половину.
    const { service } = make([
      row({
        items: [
          { formatPaper: 'Polaroid', quantity: 20 },
          { formatPaper: 'Фото 10×15', quantity: 50 },
        ],
      }),
    ]);
    const [item] = await service.pending(20);

    expect(item.items).toHaveLength(2);
    expect(item.items[1]).toEqual({ title: 'Фото 10×15', quantity: 50 });
  });

  it('заказ без позиций отдаётся с пустым списком, а не пропускается', async () => {
    // Обращение без товара — тоже заявка, здороваться с ним надо.
    const { service } = make([
      row({ items: [], totalOrder: 0, deliveryCost: 0, deliveryMethod: 'PICKUP' }),
    ]);
    const [item] = await service.pending(20);

    expect(item.items).toEqual([]);
    expect(item.total).toBe(0);
    expect(item.deliveryCost).toBe(0);
  });

  it('у холста позиция берётся из своей таблицы', async () => {
    const { service } = make([
      row({
        productCategory: 'CANVAS',
        items: [],
        canvasItems: [{ formatCanvas: 'Холст 30×40', quantity: 1 }],
      }),
    ]);
    const [item] = await service.pending(20);

    expect(item.category).toBe('CANVAS');
    expect(item.items).toEqual([{ title: 'Холст 30×40', quantity: 1 }]);
  });

  it('заявку без имени отдаёт — здороваться можно и без него', async () => {
    const { service } = make([row({ note: '🆕 Заявка с сайта' })]);
    const [item] = await service.pending(20);

    expect(item.name).toBeNull();
    expect(item.username).toBe('petrov');
  });

  it('нечитаемый никнейм закрывает сразу, не отдавая воркеру', async () => {
    // Иначе такой заказ висел бы в очереди вечно и разбирался при каждом
    // опросе — очередь встала бы колом на первом же кривом контакте.
    const { service, update } = make([row({ urlCommunication: '+7 900 000-00-00' })]);
    const items = await service.pending(20);

    expect(items).toHaveLength(0);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-1' },
        data: expect.objectContaining({ clientGreetStatus: 'not_found' }),
      }),
    );
  });

  it('не запрашивает больше пятидесяти за раз', async () => {
    const { service, findMany } = make([]);
    await service.pending(1000);
    expect(findMany.mock.calls[0][0].take).toBe(50);
  });

  it('итог записывает вместе с отметкой времени', async () => {
    const { service, update } = make([]);
    await service.mark('ord-7', 'privacy');

    const data = update.mock.calls[0][0].data;
    expect(data.clientGreetStatus).toBe('privacy');
    expect(data.clientGreetedAt).toBeInstanceOf(Date);
  });
});
