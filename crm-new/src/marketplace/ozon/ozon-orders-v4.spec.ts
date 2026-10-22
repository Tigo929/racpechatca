import { OzonOrdersService } from './ozon-orders.service';
import type { OzonApiClient } from './ozon-api.client';

/**
 * Разбор ответа Ozon на список отправлений.
 *
 * Ozon выключил третью версию метода: она отвечает
 * `400 {"code":9,"message":"obsolete method cannot be used"}`, и раздел
 * заказов переставал работать целиком.
 *
 * Опасность четвёртой версии другая и тише: поля отправления те же, а
 * конверт ответа другой — отправления лежат в корне, а не в `result`.
 * Прочитать старое поле значит получить пустой список и показать
 * «заказов нет» вместо поломки. Поэтому конверт закреплён тестом.
 */

const CREDS = { clientId: '1', apiKey: 'k' } as never;

function posting(postingNumber: string) {
  return {
    posting_number: postingNumber,
    order_number: postingNumber.split('-')[0],
    status: 'awaiting_deliver',
    in_process_at: '2026-10-02T10:00:00Z',
    shipment_date: '2026-10-03T10:00:00Z',
    products: [
      { offer_id: 'papa-black-S', name: 'Футболка', sku: 1, quantity: 2, price: '1000' },
    ],
    financial_data: { products: [{ payout: 1700 }] },
  };
}

function serviceWith(response: unknown) {
  const post = jest.fn().mockResolvedValue(response);
  const service = new OzonOrdersService({ post } as unknown as OzonApiClient);
  return { service, post };
}

describe('список отправлений Ozon', () => {
  it('запрашивает четвёртую версию метода', async () => {
    // Третью площадка выключила — запрос по ней отбивается целиком.
    const { service, post } = serviceWith({ postings: [], has_next: false });

    await service.list(CREDS);

    expect(post).toHaveBeenCalledWith(
      CREDS,
      '/v4/posting/fbs/list',
      expect.any(Object),
    );
  });

  it('читает отправления из корня ответа, а не из result', async () => {
    const { service } = serviceWith({
      postings: [posting('111-0001')],
      has_next: false,
    });

    const page = await service.list(CREDS);

    expect(page.orders.map((o) => o.postingNumber)).toEqual(['111-0001']);
  });

  it('старый конверт больше не считается ответом', async () => {
    // Если v4 когда-нибудь вернёт `result`, список должен быть пустым
    // честно, а не делать вид, что разобрал отправления.
    const { service } = serviceWith({
      result: { postings: [posting('111-0002')], has_next: true },
    });

    const page = await service.list(CREDS);

    expect(page.orders).toEqual([]);
    expect(page.hasNext).toBe(false);
  });

  it('просит не больше сотни за раз — это потолок v4', async () => {
    /*
      Четвёртая версия отбивает страницу крупнее сотни целиком:
      `400 invalid PostingFbsListRequest.Limit: value must be inside
      range (0, 100]`. Третья разрешала тысячу, и на ней держался
      прежний расчёт — одна большая страница и фильтр линейки у себя.
    */
    const { service, post } = serviceWith({ postings: [], has_next: false });

    await service.list(CREDS, { limit: 1000 });

    const body = post.mock.calls[0]![2] as Record<string, unknown>;
    expect(body.limit).toBe(100);
    expect(body).not.toHaveProperty('offset');
  });

  it('листает курсором, пока площадка говорит «есть ещё»', async () => {
    // Фильтр линейки применяется после выдачи страницы: нужные заказы
    // могут лежать за чужими, и остановка на первой странице их теряет.
    const post = jest
      .fn()
      .mockResolvedValueOnce({
        postings: [posting('111-0001')],
        has_next: true,
        cursor: 'СТРАНИЦА-2',
      })
      .mockResolvedValueOnce({
        postings: [posting('111-0002')],
        has_next: false,
      });
    const service = new OzonOrdersService({ post } as unknown as OzonApiClient);

    const page = await service.list(CREDS, { limit: 1000 });

    expect(page.orders.map((o) => o.postingNumber)).toEqual([
      '111-0001',
      '111-0002',
    ]);
    expect((post.mock.calls[1]![2] as Record<string, unknown>).cursor).toBe(
      'СТРАНИЦА-2',
    );
  });

  it('курсор перестал двигаться — выходим, а не ходим по кругу', async () => {
    // Иначе ошибка на стороне площадки превратилась бы в вечный цикл.
    const post = jest.fn().mockResolvedValue({
      postings: [posting('111-0003')],
      has_next: true,
      cursor: '',
    });
    const service = new OzonOrdersService({ post } as unknown as OzonApiClient);

    await service.list(CREDS, { limit: 1000 });

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('первая страница идёт без курсора', async () => {
    // Пустая строка курсора — не «с начала», а неизвестно что: не шлём.
    const { service, post } = serviceWith({ postings: [], has_next: false });

    await service.list(CREDS);

    expect(post.mock.calls[0]![2]).not.toHaveProperty('cursor');
  });

  it('поля отправления разбираются так же, как раньше', async () => {
    // В v4 они не переименованы — закрепляем, чтобы заметить, если станут.
    const { service } = serviceWith({ postings: [posting('111-0003')] });

    const [order] = (await service.list(CREDS)).orders;

    expect(order).toMatchObject({
      postingNumber: '111-0003',
      orderNumber: '111',
      shipmentDate: '2026-10-03T10:00:00Z',
      createdAt: '2026-10-02T10:00:00Z',
      total: 2000,
      payout: 1700,
    });
  });
});
