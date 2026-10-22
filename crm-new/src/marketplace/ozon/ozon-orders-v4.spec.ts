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
      has_next: true,
      cursor: 'eyJ0ZXN0Ijp0cnVlfQ==',
    });

    const page = await service.list(CREDS);

    expect(page.orders.map((o) => o.postingNumber)).toEqual(['111-0001']);
    expect(page.hasNext).toBe(true);
    expect(page.nextCursor).toBe('eyJ0ZXN0Ijp0cnVlfQ==');
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

  it('листает курсором: смещение площадка игнорирует', async () => {
    // Запрос с offset=3 отдаёт ту же первую страницу — проверено на бою.
    const { service, post } = serviceWith({ postings: [], has_next: false });

    await service.list(CREDS, { cursor: 'ABC' });

    const body = post.mock.calls[0]![2] as Record<string, unknown>;
    expect(body.cursor).toBe('ABC');
    expect(body).not.toHaveProperty('offset');
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
