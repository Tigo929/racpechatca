import { OzonOrdersService } from './ozon-orders.service';
import type { OzonApiClient } from './ozon-api.client';

/**
 * Фильтр «только наши принты».
 *
 * Проверяем именно скрытие: ошибка здесь не падает, а тихо убирает заказ
 * из списка — человек его не увидит, не напечатает и получит штраф за срыв
 * отгрузки. Поэтому отдельно закреплены два случая, в которых прятать
 * нельзя: пустой каталог и сборное отправление, где наша футболка лежит
 * рядом с чужим товаром.
 */

/** Отправление с одной позицией указанного артикула. */
function posting(postingNumber: string, ...offerIds: string[]) {
  return {
    posting_number: postingNumber,
    order_number: postingNumber.split('-')[0],
    status: 'awaiting_packaging',
    in_process_at: '2026-10-01T10:00:00Z',
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

describe('список отправлений: только наши принты', () => {
  it('чужие товары скрываются, наши остаются', async () => {
    const service = serviceReturning([
      posting('111-0001', 'papa-black-S'),
      posting('111-0002', 'chuzhoy-tovar-42'),
      posting('111-0003', 'JDM-1-1-black-S'),
    ]);

    const page = await service.list(CREDS, {
      knownOfferIds: new Set(['papa-black-S', 'JDM-1-1-black-S']),
    });

    expect(page.orders.map((o) => o.postingNumber)).toEqual([
      '111-0001',
      '111-0003',
    ]);
    expect(page.hiddenByCatalog).toBe(1);
  });

  it('сборное отправление остаётся: в нём есть наша футболка', async () => {
    const service = serviceReturning([
      posting('111-0004', 'chuzhoy-tovar-42', 'papa-black-S'),
    ]);

    const page = await service.list(CREDS, {
      knownOfferIds: new Set(['papa-black-S']),
    });

    expect(page.orders).toHaveLength(1);
    expect(page.hiddenByCatalog).toBe(0);
  });

  it('пустой каталог ничего не прячет: иначе список опустел бы целиком', async () => {
    const service = serviceReturning([
      posting('111-0005', 'papa-black-S'),
      posting('111-0006', 'chuzhoy-tovar-42'),
    ]);

    const page = await service.list(CREDS, { knownOfferIds: new Set() });

    expect(page.orders).toHaveLength(2);
    expect(page.hiddenByCatalog).toBe(0);
  });

  it('без фильтра возвращается всё: это режим «показать все»', async () => {
    const service = serviceReturning([
      posting('111-0007', 'papa-black-S'),
      posting('111-0008', 'chuzhoy-tovar-42'),
    ]);

    const page = await service.list(CREDS, {});

    expect(page.orders).toHaveLength(2);
    expect(page.hiddenByCatalog).toBe(0);
  });

  it('скрытые считаются даже тогда, когда не осталось ничего', async () => {
    const service = serviceReturning([posting('111-0009', 'chuzhoy-tovar-42')]);

    const page = await service.list(CREDS, {
      knownOfferIds: new Set(['papa-black-S']),
    });

    expect(page.orders).toHaveLength(0);
    // Ноль заказов и «скрыто 1» — разные сообщения для человека: во втором
    // случае заказы есть, просто они не наши.
    expect(page.hiddenByCatalog).toBe(1);
  });
});
