import { Injectable, Logger } from '@nestjs/common';
import {
  OzonApiClient,
  OzonApiError,
  type OzonCredentials,
} from './ozon-api.client';

/**
 * Прикладные сценарии Ozon поверх низкоуровневого клиента.
 *
 * Пока здесь только проверка подключения — первый шаг интеграции: пока не
 * понятно, что ключи рабочие, обсуждать карточки товаров бессмысленно.
 */

interface OzonProductListResponse {
  result?: {
    items?: { product_id?: number; offer_id?: string }[];
    total?: number;
    last_id?: string;
  };
}

/**
 * Ответ /v2/warehouse/list. Первая версия метода (/v1/warehouse/list) отвечает
 * «obsolete method cannot be used», и список лежит уже не в `result`,
 * а в `warehouses` — проверено на живом кабинете 17.08.2026.
 */
interface OzonWarehouseListResponse {
  warehouses?: {
    warehouse_id?: number;
    name?: string;
    status?: string;
  }[];
}

/** Что показываем на карточке подключения после удачной проверки. */
export interface OzonConnectionInfo {
  /** Сколько товаров видно в кабинете. null — метод не ответил числом. */
  productTotal: number | null;
  /** Склады продавца. null — ключ без доступа к складам (это не ошибка). */
  warehouses: { id: number; name: string }[] | null;
  checkedAt: string;
}

@Injectable()
export class OzonService {
  private readonly logger = new Logger(OzonService.name);

  constructor(private readonly api: OzonApiClient) {}

  /**
   * Проверка связи. Бьём в список товаров: метод есть у любого продавца,
   * доступен на минимальных правах ключа и заодно отвечает на вопрос
   * «сколько у нас вообще товаров» — по нему сразу видно, что подключился
   * нужный кабинет, а не чужой.
   */
  async checkConnection(creds: OzonCredentials): Promise<OzonConnectionInfo> {
    const products = await this.api.post<OzonProductListResponse>(
      creds,
      '/v3/product/list',
      { filter: { visibility: 'ALL' }, last_id: '', limit: 1 },
    );

    return {
      productTotal: products.result?.total ?? null,
      warehouses: await this.tryWarehouses(creds),
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Склады — приятное дополнение, а не критерий подключения: у продавца может
   * не быть схемы FBS, и тогда метод отвечает отказом. Ронять из-за этого
   * проверку ключа нельзя, поэтому ошибку глотаем осознанно.
   */
  private async tryWarehouses(
    creds: OzonCredentials,
  ): Promise<{ id: number; name: string }[] | null> {
    try {
      const res = await this.api.post<OzonWarehouseListResponse>(
        creds,
        '/v2/warehouse/list',
      );
      const list = (res.warehouses ?? [])
        .filter((w) => typeof w.warehouse_id === 'number')
        .map((w) => ({
          id: w.warehouse_id as number,
          name: w.name ?? `Склад ${w.warehouse_id}`,
        }));
      return list;
    } catch (e) {
      if (e instanceof OzonApiError) {
        this.logger.log(`Склады Ozon недоступны (${e.status}) — пропускаем`);
        return null;
      }
      throw e;
    }
  }
}
