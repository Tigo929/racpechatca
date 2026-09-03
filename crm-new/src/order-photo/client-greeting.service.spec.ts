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
