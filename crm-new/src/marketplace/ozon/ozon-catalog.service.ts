import { Injectable } from '@nestjs/common';
import { OzonApiClient, type OzonCredentials } from './ozon-api.client';
import type { OzonImportItem } from './ozon-attributes';

/**
 * Ozon-специфичная часть каталога: поиск значений словарных атрибутов и
 * импорт товаров. Как и ozon.service.ts — не знает про базу, не знает про
 * наши модели; принты/шаблоны собирает вызывающая сторона (ozon-print.service,
 * ozon-import.service).
 */

export interface OzonAttributeValueOption {
  id: number;
  value: string;
  info: string;
}

interface OzonAttributeValuesSearchResponse {
  result?: { id: number; value: string; info?: string }[];
}

interface OzonImportResponse {
  result?: { task_id?: number };
}

export interface OzonImportInfoItem {
  offer_id: string;
  product_id?: number;
  status?: { state?: string; moderate_status?: string };
  errors?: {
    code?: string;
    state?: string;
    level?: string;
    description?: string;
    texts?: { message_plural?: string };
  }[];
}

interface OzonImportInfoResponse {
  result?: { items?: OzonImportInfoItem[]; total?: number };
}

@Injectable()
export class OzonCatalogService {
  constructor(private readonly api: OzonApiClient) {}

  /**
   * Живой поиск по словарю атрибута (цвет, тематика рисунка и т.п.) —
   * словари вроде «Цвет товара» насчитывают сотни значений, тянуть их
   * целиком незачем: подсказка в форме ищет по введённому тексту.
   */
  async searchAttributeValue(
    creds: OzonCredentials,
    params: {
      descriptionCategoryId: number;
      typeId: number;
      attributeId: number;
      query: string;
    },
  ): Promise<OzonAttributeValueOption[]> {
    const res = await this.api.post<OzonAttributeValuesSearchResponse>(
      creds,
      '/v1/description-category/attribute/values/search',
      {
        description_category_id: params.descriptionCategoryId,
        type_id: params.typeId,
        attribute_id: params.attributeId,
        value: params.query,
        limit: 15,
      },
    );
    return (res.result ?? []).map((v) => ({
      id: v.id,
      value: v.value,
      info: v.info ?? '',
    }));
  }

  /** До 100 товаров за вызов (ограничение Ozon) — резать на пачки обязана вызывающая сторона. */
  async importProducts(
    creds: OzonCredentials,
    items: OzonImportItem[],
  ): Promise<string> {
    const res = await this.api.post<OzonImportResponse>(
      creds,
      '/v3/product/import',
      { items },
    );
    const taskId = res.result?.task_id;
    if (taskId === undefined) {
      throw new Error('Ozon не вернул task_id по загрузке товаров');
    }
    return String(taskId);
  }

  /** Статус асинхронной загрузки по task_id — импорт применяется не мгновенно. */
  async importInfo(
    creds: OzonCredentials,
    taskId: string,
  ): Promise<OzonImportInfoItem[]> {
    const res = await this.api.post<OzonImportInfoResponse>(
      creds,
      '/v1/product/import/info',
      { task_id: Number(taskId) },
    );
    return res.result?.items ?? [];
  }
}
