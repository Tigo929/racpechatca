import { ClientReviewService } from './client-review.service';

/**
 * Очередь автоматических просьб об отзыве.
 *
 * Для заказа с площадки это единственная автоматизация, которая вообще
 * возможна: в чат кабинета из фона не напишешь, а в Telegram — можно,
 * если покупатель сам нам написал. Поэтому проверяется именно то, что
 * решает дело: кого очередь берёт, что она отдаёт воркеру и что
 * происходит с заказом после удачи и после отказа.
 */

const delivered = {
  id: 'o1',
  numberOrder: '20261104-001',
  productCategory: 'TSHIRT',
  status: 'SENT',
  deliveryMethod: 'OZON_SELLER',
  sourceOrder: 'OZON',
  sentAt: new Date('2026-11-01T10:00:00Z'),
  clientReviewLeft: false,
  reviewReminderNotifiedAt: null,
  isMarketplacePrint: true,
  marketplaceDeliveredAt: new Date('2026-11-04T10:00:00Z'),
  clientTelegram: '@client_name',
  urlCommunication: '1234-0001-1',
};

function build(rows: Record<string, unknown>[], asked: string[] = []) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const update = jest.fn().mockResolvedValue({
    numberOrder: '20261104-001',
    clientTelegram: '@client_name',
    productCategory: 'TSHIRT',
  });
  const sendToOwner = jest.fn().mockResolvedValue(true);
  // Кому про отзыв уже писали — отдельный сервис: очередь только
  // просеивает своих кандидатов его набором.
  const audience = { askedIdentities: jest.fn().mockResolvedValue(new Set(asked)) };
  const service = new ClientReviewService(
    { orderPhoto: { findMany, update } } as never,
    { sendToOwner } as never,
    audience as never,
  );
  return { service, findMany, update, sendToOwner };
}

describe('просьба об отзыве уходит клиенту сама', () => {
  it('выкупленный заказ с Telegram попадает в очередь с готовым текстом', async () => {
    const { service } = build([delivered]);

    const items = await service.pending(5);

    expect(items).toHaveLength(1);
    expect(items[0]!.username).toBe('client_name');
    // Текст собирает CRM — тот же, что она даёт владельцу для ручной
    // отправки. Воркер ничего не придумывает.
    expect(items[0]!.text).toContain('Как вам футболка');
    expect(items[0]!.text).toContain('ozon.ru/my/orderlist');
  });

  it('повторный заказ клиента, которому уже писали, в очередь не попадает', async () => {
    /*
     * Он заказал второй раз. Отзыв (или просьба) закреплён за человеком,
     * а не за покупкой: отметка стоит на прошлом заказе, узнаём его по
     * нику. Без этого постоянный заказчик получал просьбу после каждой
     * покупки — первый раз вежливость, третий выглядит как рассылка.
     */
    const { service } = build([delivered], ['tg:client_name']);

    expect(await service.pending(5)).toHaveLength(0);
  });

  it('не выкупленный заказ не берём: товара у человека нет', async () => {
    /*
      «Как вам футболка» человеку, который её ещё не получил, — худшее,
      что можно написать. Дату выкупа ставит сверка с площадкой, и до неё
      просить не о чем.
    */
    const { service } = build([{ ...delivered, marketplaceDeliveredAt: null }]);
    expect(await service.pending(5)).toEqual([]);
  });

  it('непригодная запись Telegram не уходит воркеру, а отдаётся человеку', async () => {
    // Пробовать нечего: ника из такой записи не выходит.
    const { service, update } = build([
      { ...delivered, clientTelegram: 'не ник' },
    ]);

    expect(await service.pending(5)).toEqual([]);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewRequestStatus: 'not_found' }),
      }),
    );
  });

  it('удача закрывает вопрос и сообщает владельцу', async () => {
    const { service, update, sendToOwner } = build([]);

    await service.mark('o1', 'sent');

    const data = update.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.reviewRequestStatus).toBe('sent');
    expect(data.reviewRequestSentBy).toBe('auto');
    expect(data.reviewRequestSentAt).toBeInstanceOf(Date);
    // Отметка о напоминании — чтобы владельцу не предложили отправить
    // то же сообщение второй раз.
    expect(data.reviewReminderNotifiedAt).toBeInstanceOf(Date);
    expect(sendToOwner).toHaveBeenCalled();
  });

  it('отказ ничего не закрывает — просьбу отправит человек', async () => {
    const { service, update, sendToOwner } = build([]);

    await service.mark('o1', 'privacy');

    const data = update.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.reviewRequestStatus).toBe('privacy');
    expect(data.reviewRequestSentAt).toBeUndefined();
    expect(data.reviewReminderNotifiedAt).toBeUndefined();
    // Отдельного сообщения об отказе нет: заказ попадёт в обычное
    // напоминание владельцу вместе с причиной.
    expect(sendToOwner).not.toHaveBeenCalled();
  });

  it('очередь спрашивает только заказы с записанным Telegram', async () => {
    // Иначе воркеру достанутся заказы, писать по которым некуда, и
    // очередь встанет колом на них.
    const { service, findMany } = build([]);
    await service.pending(5);
    expect(findMany.mock.calls[0]![0].where).toMatchObject({
      clientTelegram: { not: null },
      clientReviewLeft: false,
      reviewRequestSentAt: null,
    });
  });
});
