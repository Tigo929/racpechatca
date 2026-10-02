import { OzonOrdersService } from './ozon-orders.service';
import type { OzonApiClient } from './ozon-api.client';

/**
 * Фильтр списка отправлений по началу артикула.
 *
 * Проверяем именно скрытие: ошибка здесь не падает, а тихо убирает заказ
 * из списка — человек его не увидит, не напечатает и получит штраф за срыв
 * отгрузки. Поэтому отдельно закреплены случаи, в которых прятать нельзя:
 * пустой список префиксов, сборное отправление и другой регистр букв.
 */

/** Отправление с позициями указанных артикулов. */
function posting(postingNumber: string, ...offerIds: string[]) {
  return {
    posting_number: postingNumber,
    order_number: postingNumber.split('-')[0],
    status: 'awaiting_packaging',
    in_process_at: '2026-10-02T10:00:00Z',
    products: offerIds.map((offer_id) => ({
      offer_id,
      name: offer_id,
      sku: 1,
      quantity: 1,
      price: '1000',
    })),
  };
}

function serviceReturning(postings: unknown[]): OzonOrdersService {
  const api = {
    post: jest.fn().mockResolvedValue({ result: { postings, has_next: false } }),
  } as unknown as OzonApiClient;
  return new OzonOrdersService(api);
}

const CREDS = { clientId: '1', apiKey: 'k' } as never;
const PAPA = ['papa-'];

describe('список отправлений: только нужная линейка', () => {
  it('чужие линейки скрываются, papa остаётся', async () => {
    const service = serviceReturning([
      posting('111-0001', 'papa-black-S'),
      posting('111-0002', 'cat-1-white-M'),
      posting('111-0003', 'papa-2-white-XL'),
      posting('111-0004', 'ai-7-black-L'),
    ]);

    const page = await service.list(CREDS, { articlePrefixes: PAPA });

    expect(page.orders.map((o) => o.postingNumber)).toEqual([
      '111-0001',
      '111-0003',
    ]);
    expect(page.hiddenByCatalog).toBe(2);
  });

  it('регистр букв не прячет заказ', async () => {
    const service = serviceReturning([
      posting('111-0005', 'PAPA-black-S'),
      posting('111-0006', 'Papa-2-white-M'),
    ]);

    const page = await service.list(CREDS, { articlePrefixes: PAPA });

    expect(page.orders).toHaveLength(2);
    expect(page.hiddenByCatalog).toBe(0);
  });

  it('совпадение только с начала: «не-papa» чужой', async () => {
    const service = serviceReturning([
      posting('111-0007', 'nepapa-black-S'),
      posting('111-0008', 'mem-papa-white-M'),
    ]);

    const page = await service.list(CREDS, { articlePrefixes: PAPA });

    expect(page.orders).toHaveLength(0);
    expect(page.hiddenByCatalog).toBe(2);
  });

  it('сборное отправление остаётся: в нём есть наша футболка', async () => {
    const service = serviceReturning([
      posting('111-0009', 'cat-1-white-M', 'papa-black-S'),
    ]);

    const page = await service.list(CREDS, { articlePrefixes: PAPA });

    expect(page.orders).toHaveLength(1);
    expect(page.hiddenByCatalog).toBe(0);
  });

  it('пустой список префиксов ничего не прячет: это режим «показать все»', async () => {
    const service = serviceReturning([
      posting('111-0010', 'papa-black-S'),
      posting('111-0011', 'cat-1-white-M'),
    ]);

    const page = await service.list(CREDS, { articlePrefixes: [] });

    expect(page.orders).toHaveLength(2);
    expect(page.hiddenByCatalog).toBe(0);
  });

  it('без параметра возвращается всё', async () => {
    const service = serviceReturning([
      posting('111-0012', 'papa-black-S'),
      posting('111-0013', 'cat-1-white-M'),
    ]);

    const page = await service.list(CREDS, {});

    expect(page.orders).toHaveLength(2);
    expect(page.hiddenByCatalog).toBe(0);
  });

  it('скрытые считаются даже тогда, когда не осталось ничего', async () => {
    const service = serviceReturning([posting('111-0014', 'cat-1-white-M')]);

    const page = await service.list(CREDS, { articlePrefixes: PAPA });

    expect(page.orders).toHaveLength(0);
    // Ноль заказов и «скрыто 1» — разные сообщения для человека: во втором
    // случае заказы есть, просто они не из нашей линейки.
    expect(page.hiddenByCatalog).toBe(1);
  });
});
