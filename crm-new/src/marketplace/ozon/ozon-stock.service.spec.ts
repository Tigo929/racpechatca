import { OzonApiClient } from './ozon-api.client';
import { OzonStockService } from './ozon-stock.service';
import type { StockPair } from './ozon-bulk-stock-rules';

/** Настоящие склады кабинета — из шаблона обновления остатков, 25.08.2026. */
const PERVOMAY = 1020005000060325;
const AMIR = 1020005027898150;
const CREDS = { clientId: '1', apiKey: 'k' };

type PostMock = jest.Mock<Promise<unknown>, unknown[]>;

function build(handler: (body: unknown) => unknown) {
  const post: PostMock = jest.fn((_creds, _path, body) =>
    Promise.resolve(handler(body)),
  ) as unknown as PostMock;
  const service = new OzonStockService({ post } as unknown as OzonApiClient);
  return { service, post };
}

/** Ответ площадки, где все перечисленные артикулы приняты. */
function acceptAll(body: unknown) {
  const stocks = (body as { stocks: { offer_id: string }[] }).stocks;
  return { result: stocks.map((s) => ({ offer_id: s.offer_id, updated: true })) };
}

const pair = (offerId: string, warehouseId: number, quantity = 25): StockPair => ({
  offerId,
  warehouseId,
  quantity,
});

describe('отправка остатков', () => {
  it('в одном запросе — один склад', async () => {
    // Ozon отвечает по offer_id и не называет склад. Смешай склады в одном
    // запросе — и у товара с двумя складами станет непонятно, к какому
    // относится отказ.
    const { service, post } = build(acceptAll);

    await service.updateStocks(CREDS, [
      pair('A', PERVOMAY),
      pair('A', AMIR),
      pair('B', PERVOMAY),
    ]);

    expect(post).toHaveBeenCalledTimes(2);
    for (const call of post.mock.calls) {
      const stocks = (call[2] as { stocks: { warehouse_id: number }[] }).stocks;
      const ids = new Set(stocks.map((s) => s.warehouse_id));
      expect(ids.size).toBe(1);
    }
  });

  it('пачка больше сотни режется по лимиту площадки', async () => {
    const { service, post } = build(acceptAll);
    const pairs = Array.from({ length: 150 }, (_, i) => pair(`A-${i}`, PERVOMAY));

    const results = await service.updateStocks(CREDS, pairs);

    expect(post).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(150);
    expect(results.every((r) => r.updated)).toBe(true);
  });

  it('используется метод /v2/products/stocks', async () => {
    const { service, post } = build(acceptAll);
    await service.updateStocks(CREDS, [pair('A', PERVOMAY)]);
    expect(post.mock.calls[0]?.[1]).toBe('/v2/products/stocks');
  });

  it('отрицательное количество не уходит в Ozon', async () => {
    const { service, post } = build(acceptAll);
    await service.updateStocks(CREDS, [pair('A', PERVOMAY, -5)]);
    const stocks = (post.mock.calls[0]?.[2] as { stocks: { stock: number }[] }).stocks;
    expect(stocks[0]?.stock).toBe(0);
  });
});

describe('разбор ответа', () => {
  it('отказ по товару становится ошибкой пары', async () => {
    const { service } = build(() => ({
      result: [
        { offer_id: 'A', updated: false, errors: [{ code: 'NOT_FOUND', message: 'Товар не найден' }] },
      ],
    }));

    const [result] = await service.updateStocks(CREDS, [pair('A', PERVOMAY)]);

    expect(result?.updated).toBe(false);
    expect(result?.errorCode).toBe('NOT_FOUND');
    expect(result?.errorMessage).toBe('Товар не найден');
  });

  it('молчание про товар успехом не считается', async () => {
    // Иначе в историю попадёт «обновлено», чего на самом деле не было.
    const { service } = build(() => ({ result: [] }));

    const [result] = await service.updateStocks(CREDS, [pair('A', PERVOMAY)]);

    expect(result?.updated).toBe(false);
    expect(result?.errorCode).toBe('NO_RESULT');
  });

  it('результат возвращается на каждую отправленную пару', async () => {
    const { service } = build(acceptAll);
    const results = await service.updateStocks(CREDS, [
      pair('A', PERVOMAY),
      pair('A', AMIR),
    ]);

    expect(results.map((r) => `${r.offerId}@${r.warehouseId}`)).toEqual([
      `A@${PERVOMAY}`,
      `A@${AMIR}`,
    ]);
  });
});

describe('чтение остатков по складам', () => {
  it('ключ собирается из sku и склада, остатки не складываются', () => {
    // У одного товара на трёх складах три разных остатка. Список товаров
    // в каталоге показывает их сумму — здесь нужна именно разбивка.
    const { service } = build(() => ({
      result: [
        { sku: 111, warehouse_id: PERVOMAY, present: 7, reserved: 1 },
        { sku: 111, warehouse_id: AMIR, present: 40, reserved: 0 },
      ],
    }));

    return service.stocksByWarehouse(CREDS, ['111']).then((map) => {
      expect(map.get(`111@${PERVOMAY}`)).toBe(7);
      expect(map.get(`111@${AMIR}`)).toBe(40);
      expect(map.size).toBe(2);
    });
  });

  it('строки без sku или склада пропускаются', () => {
    const { service } = build(() => ({
      result: [
        { present: 5, warehouse_id: PERVOMAY },
        { sku: 111, present: 5 },
        { sku: 222, warehouse_id: PERVOMAY, present: 3 },
      ],
    }));

    return service.stocksByWarehouse(CREDS, ['111', '222']).then((map) => {
      expect([...map.keys()]).toEqual([`222@${PERVOMAY}`]);
    });
  });

  it('отсутствие остатка читается как ноль, а не как «неизвестно»', () => {
    const { service } = build(() => ({
      result: [{ sku: 111, warehouse_id: PERVOMAY }],
    }));

    return service.stocksByWarehouse(CREDS, ['111']).then((map) => {
      expect(map.get(`111@${PERVOMAY}`)).toBe(0);
    });
  });

  it('используется метод остатков по складам FBS', () => {
    const { service, post } = build(() => ({ result: [] }));
    return service.stocksByWarehouse(CREDS, ['111']).then(() => {
      expect(post.mock.calls[0]?.[1]).toBe('/v1/product/info/stocks-by-warehouse/fbs');
    });
  });
});
