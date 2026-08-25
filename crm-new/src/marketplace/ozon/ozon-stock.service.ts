import { Injectable, Logger } from '@nestjs/common';
import { OzonApiClient, type OzonCredentials } from './ozon-api.client';
import { OZON_STOCK_CHUNK, type StockPair } from './ozon-bulk-stock-rules';

/**
 * Единственное место, где остатки уходят в Ozon.
 *
 * Раньше запрос собирался внутри каталога товаров, и массовое изменение
 * повторило бы его второй раз. Когда площадка сменит версию метода —
 * а она их меняет, — править нужно ровно этот файл.
 *
 * Метод: POST /v2/products/stocks. За один запрос — не больше ста пар
 * «товар × склад»: один товар на трёх складах это три позиции, а не одна.
 */

export interface StockUpdateResult {
  offerId: string;
  warehouseId: number;
  updated: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

interface RawStocksResponse {
  result?: {
    offer_id?: string;
    product_id?: number;
    updated?: boolean;
    errors?: { code?: string; message?: string }[];
  }[];
}

@Injectable()
export class OzonStockService {
  private readonly logger = new Logger(OzonStockService.name);

  constructor(private readonly api: OzonApiClient) {}

  /**
   * Отправка остатков пачками.
   *
   * Пары группируются по складу, и в одном запросе едет только один склад.
   * Так дороже на один-два запроса, зато ответ однозначен: Ozon отвечает
   * по `offer_id`, и если в запросе смешать склады, то у товара с двумя
   * складами станет непонятно, к какому относится отказ. Ошибиться здесь
   * значит записать в историю неправду про то, где остаток изменился.
   */
  async updateStocks(
    creds: OzonCredentials,
    pairs: StockPair[],
  ): Promise<StockUpdateResult[]> {
    const byWarehouse = new Map<number, StockPair[]>();
    for (const pair of pairs) {
      const list = byWarehouse.get(pair.warehouseId) ?? [];
      list.push(pair);
      byWarehouse.set(pair.warehouseId, list);
    }

    const results: StockUpdateResult[] = [];
    for (const [warehouseId, list] of byWarehouse) {
      for (let i = 0; i < list.length; i += OZON_STOCK_CHUNK) {
        const chunk = list.slice(i, i + OZON_STOCK_CHUNK);
        results.push(...(await this.sendChunk(creds, warehouseId, chunk)));
      }
    }
    return results;
  }

  private async sendChunk(
    creds: OzonCredentials,
    warehouseId: number,
    chunk: StockPair[],
  ): Promise<StockUpdateResult[]> {
    const res = await this.api.post<RawStocksResponse>(
      creds,
      '/v2/products/stocks',
      {
        stocks: chunk.map((pair) => ({
          offer_id: pair.offerId,
          stock: Math.max(0, Math.round(pair.quantity)),
          warehouse_id: warehouseId,
        })),
      },
    );

    const byOffer = new Map<string, StockUpdateResult>();
    for (const row of res.result ?? []) {
      const offerId = row.offer_id ?? '';
      if (!offerId) continue;
      const error = row.errors?.[0];
      byOffer.set(offerId, {
        offerId,
        warehouseId,
        updated: Boolean(row.updated),
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? error?.code ?? null,
      });
    }

    // Товар, о котором площадка промолчала, успешным не считаем: молчание
    // в ответе — не подтверждение. Пусть лучше он попадёт в ошибки и его
    // повторят, чем в истории останется «обновлено», чего не было.
    return chunk.map(
      (pair) =>
        byOffer.get(pair.offerId) ?? {
          offerId: pair.offerId,
          warehouseId,
          updated: false,
          errorCode: 'NO_RESULT',
          errorMessage: 'Ozon не ответил по этому товару.',
        },
    );
  }

}
