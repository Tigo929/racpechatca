import { Injectable, Logger } from '@nestjs/common';
import { OzonApiClient, type OzonCredentials } from './ozon-api.client';

/**
 * Живой каталог товаров Ozon: что уже заведено в кабинете, по какой цене,
 * с каким остатком, статусом модерации и спросом.
 *
 * Копии в нашей базе нет намеренно. Товар живёт в Ozon, там же его меняют
 * из кабинета и оттуда же приходит модерация — вторая копия у нас означала
 * бы вечное расхождение и синхронизацию, которую пришлось бы чинить. Читаем
 * по запросу, пишем сразу в Ozon.
 */

/** Сколько товаров Ozon отдаёт за один вызов info/list. */
const INFO_BATCH = 500;
const LIST_PAGE = 1000;

interface RawListItem {
  offer_id?: string;
  product_id?: number;
}

interface RawListResponse {
  result?: { items?: RawListItem[]; last_id?: string; total?: number };
}

/** Атрибут в том виде, в каком Ozon его отдаёт и принимает обратно. */
interface RawAttribute {
  attribute_id?: number;
  attribute_name?: string;
  complex_id?: number;
  values?: { dictionary_value_id?: number; value?: string }[];
}

interface RawAttributesResponse {
  result?: {
    id?: number;
    offer_id?: string;
    description_category_id?: number;
    type_id?: number;
    depth?: number;
    width?: number;
    height?: number;
    dimension_unit?: string;
    weight?: number;
    weight_unit?: string;
    attributes?: RawAttribute[];
  }[];
}

interface RawRatingResponse {
  products?: {
    sku?: number;
    rating?: number;
    groups?: {
      name?: string;
      conditions?: { description?: string; fulfilled?: boolean; cost?: number }[];
    }[];
  }[];
}

interface RawImportInfoResponse {
  result?: {
    items?: {
      status?: string;
      errors?: { code?: string; message?: string }[];
    }[];
  };
}

interface RawDescriptionResponse {
  result?: { description?: string };
}

interface RawInfoItem {
  id?: number;
  offer_id?: string;
  name?: string;
  sku?: number;
  price?: string;
  old_price?: string;
  min_price?: string;
  currency_code?: string;
  is_archived?: boolean;
  primary_image?: string[];
  images?: string[];
  description_category_id?: number;
  type_id?: number;
  model_info?: { model_id?: number; count?: number };
  statuses?: {
    status?: string;
    status_name?: string;
    moderate_status?: string;
    validation_status?: string;
    status_description?: string;
  };
  commissions?: {
    percent?: number;
    sale_schema?: string;
    value?: number;
    delivery_amount?: number;
    return_amount?: number;
  }[];
  stocks?: { present?: number; reserved?: number };
  visibility_details?: { has_price?: boolean; has_stock?: boolean };
  barcodes?: string[];
}

interface RawInfoResponse {
  items?: RawInfoItem[];
}

interface RawStockItem {
  offer_id?: string;
  stocks?: { type?: string; present?: number; reserved?: number }[];
}

interface RawStocksResponse {
  items?: RawStockItem[];
  cursor?: string;
}

interface RawAnalyticsResponse {
  result?: {
    data?: {
      dimensions?: { id?: string; name?: string }[];
      metrics?: number[];
    }[];
  };
}

export interface OzonActionView {
  id: number;
  title: string;
  dateStart: string | null;
  dateEnd: string | null;
  isParticipating: boolean;
  participatingProducts: number;
  potentialProducts: number;
  actionType: string | null;
  discountPercent: number | null;
}

interface RawActionsResponse {
  result?: {
    id?: number;
    title?: string;
    date_start?: string;
    date_end?: string;
    is_participating?: boolean;
    participating_products_count?: number;
    potential_products_count?: number;
    action_type?: string;
    discount_value?: number;
  }[];
}

/** Спрос по товару за период: только эти две метрики отдаёт кабинет. */
export interface OzonDemand {
  orderedUnits: number;
  revenue: number;
}

/** Тарифы площадки по товару — из них складывается юнит-экономика. */
export interface OzonProductTariffs {
  commissionPercent: number;
  acquiring: number;
  firstMileMin: number;
  firstMileMax: number;
  directFlowMin: number;
  directFlowMax: number;
  lastMile: number;
  returnFlow: number;
  /** Маркетинговые механики Ozon с их процентами — они тоже едят маржу. */
  marketingActions: { title: string; percent: number }[];
}

interface RawPricesResponse {
  items?: {
    offer_id?: string;
    acquiring?: number;
    commissions?: {
      sales_percent_fbs?: number;
      fbs_first_mile_min_amount?: number;
      fbs_first_mile_max_amount?: number;
      fbs_direct_flow_trans_min_amount?: number;
      fbs_direct_flow_trans_max_amount?: number;
      fbs_deliv_to_customer_amount?: number;
      fbs_return_flow_amount?: number;
    };
    marketing_actions?: { actions?: { title?: string; value?: number }[] };
  }[];
  cursor?: string;
}

/**
 * Описание в Ozon — не отдельное поле, а атрибут «Аннотация». Номер один
 * на все категории товаров, поэтому вынесен константой.
 */
const DESCRIPTION_ATTRIBUTE_ID = 4191;

/** «Объединить на одной карточке» — по нему Ozon сводит цвета вместе. */
const UNION_ATTRIBUTE_ID = 8292;

/** Сколько SKU просим у рейтинга за один запрос. */
const RATING_BATCH = 100;

/**
 * Подробности карточки, которых нет в списке товаров.
 *
 * Ozon отдаёт их отдельными запросами, поэтому грузим только при открытии
 * карточки: тянуть описание и габариты для всех восьмидесяти шести товаров
 * ради списка — это восемьдесят шесть лишних запросов на каждое открытие
 * раздела.
 */
export interface OzonProductCard {
  offerId: string;
  description: string | null;
  /** Габариты упаковки в единицах Ozon (обычно миллиметры и граммы). */
  depth: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: string | null;
  weight: number | null;
  weightUnit: string | null;
  /** Заполненные атрибуты карточки: цвет, состав, бренд и прочее. */
  attributes: { name: string; values: string[] }[];
}

/** Контент-рейтинг одной карточки и то, чего ей не хватает. */
export interface OzonContentRating {
  /** Оценка Ozon, обычно из 100. */
  rating: number;
  /** Незакрытые условия, самые «дорогие» первыми. */
  missing: { group: string; what: string; points: number }[];
}

export interface OzonCatalogProduct {
  offerId: string;
  productId: number;
  sku: string | null;
  name: string;
  primaryImage: string | null;
  images: string[];
  price: number;
  oldPrice: number;
  minPrice: number;
  archived: boolean;
  /** «Продается», «На модерации» и т.п. — подпись самого Ozon. */
  statusName: string;
  moderateStatus: string | null;
  statusDescription: string | null;
  hasPrice: boolean;
  hasStock: boolean;
  stockPresent: number;
  stockReserved: number;
  /** Комиссия площадки по FBS, % от цены. */
  commissionPercent: number | null;
  /** Заказано штук за последние 30 дней. */
  orderedUnits30d: number;
  /** Выручка за последние 30 дней, ₽. */
  revenue30d: number;
  /**
   * Родовая группа глазами Ozon: товары одной модели объединены в карточке
   * и переключаются покупателем как цвета. До сих пор мы догадывались о ней
   * по написанию артикула — теперь берём то, что площадка считает правдой.
   */
  modelId: number | null;
  /** Сколько товаров в этой модели по данным Ozon. */
  modelCount: number | null;
  /** Штрихкоды: по ним товар принимают на складе. */
  barcodes: string[];
}

@Injectable()
export class OzonProductCatalogService {
  private readonly logger = new Logger(OzonProductCatalogService.name);

  constructor(private readonly api: OzonApiClient) {}

  /** Все товары кабинета с ценой, остатком, статусом и спросом за 30 дней. */
  async listProducts(creds: OzonCredentials): Promise<OzonCatalogProduct[]> {
    const offerIds = await this.allOfferIds(creds);
    if (!offerIds.length) return [];

    const [infos, stocks, demand] = await Promise.all([
      this.infoFor(creds, offerIds),
      this.stocksFor(creds),
      // Аналитика необязательна: у части кабинетов метод закрыт, и это не
      // повод не показать сам каталог.
      this.demandBySku(creds, 30).catch(() => new Map<string, OzonDemand>()),
    ]);

    return infos.map((i) => this.toProduct(i, stocks, demand));
  }

  /** Постраничный обход /v3/product/list — Ozon отдаёт курсором last_id. */
  private async allOfferIds(creds: OzonCredentials): Promise<string[]> {
    const result: string[] = [];
    let lastId = '';
    for (let page = 0; page < 50; page += 1) {
      const res = await this.api.post<RawListResponse>(
        creds,
        '/v3/product/list',
        { filter: { visibility: 'ALL' }, last_id: lastId, limit: LIST_PAGE },
      );
      const items = res.result?.items ?? [];
      for (const it of items) if (it.offer_id) result.push(it.offer_id);
      lastId = res.result?.last_id ?? '';
      if (!lastId || items.length === 0) break;
    }
    return result;
  }

  private async infoFor(
    creds: OzonCredentials,
    offerIds: string[],
  ): Promise<RawInfoItem[]> {
    const items: RawInfoItem[] = [];
    for (let i = 0; i < offerIds.length; i += INFO_BATCH) {
      const res = await this.api.post<RawInfoResponse>(
        creds,
        '/v3/product/info/list',
        {
          offer_id: offerIds.slice(i, i + INFO_BATCH),
          product_id: [],
          sku: [],
        },
      );
      items.push(...(res.items ?? []));
    }
    return items;
  }

  /** Остатки по всем товарам: offer_id → {present, reserved}. */
  private async stocksFor(
    creds: OzonCredentials,
  ): Promise<Map<string, { present: number; reserved: number }>> {
    const map = new Map<string, { present: number; reserved: number }>();
    let cursor = '';
    for (let page = 0; page < 50; page += 1) {
      const res = await this.api.post<RawStocksResponse>(
        creds,
        '/v4/product/info/stocks',
        { filter: { visibility: 'ALL' }, limit: LIST_PAGE, cursor },
      );
      const items = res.items ?? [];
      for (const it of items) {
        if (!it.offer_id) continue;
        const present = (it.stocks ?? []).reduce(
          (s, x) => s + (x.present ?? 0),
          0,
        );
        const reserved = (it.stocks ?? []).reduce(
          (s, x) => s + (x.reserved ?? 0),
          0,
        );
        map.set(it.offer_id, { present, reserved });
      }
      cursor = res.cursor ?? '';
      if (!cursor || items.length === 0) break;
    }
    return map;
  }

  /**
   * Спрос по SKU за период. Кабинету доступны только ordered_units и revenue —
   * просмотры и конверсию Ozon для него не отдаёт, проверено на живых данных.
   */
  async demandBySku(
    creds: OzonCredentials,
    days: number,
  ): Promise<Map<string, OzonDemand>> {
    const day = (n: number) =>
      new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

    const res = await this.api.post<RawAnalyticsResponse>(
      creds,
      '/v1/analytics/data',
      {
        date_from: day(days),
        date_to: day(0),
        metrics: ['ordered_units', 'revenue'],
        dimension: ['sku'],
        limit: 1000,
        offset: 0,
      },
    );

    const map = new Map<string, OzonDemand>();
    for (const row of res.result?.data ?? []) {
      const sku = row.dimensions?.[0]?.id;
      if (!sku) continue;
      map.set(sku, {
        orderedUnits: row.metrics?.[0] ?? 0,
        revenue: row.metrics?.[1] ?? 0,
      });
    }
    return map;
  }

  /**
   * Тарифы по каждому товару: комиссия, эквайринг, логистика в обе стороны.
   * Ozon отдаёт их отдельным методом от карточки — цены и удержания живут в
   * `/v5/product/info/prices`, а не в info/list.
   */
  async tariffsByOfferId(
    creds: OzonCredentials,
  ): Promise<Map<string, OzonProductTariffs>> {
    const map = new Map<string, OzonProductTariffs>();
    let cursor = '';
    for (let page = 0; page < 50; page += 1) {
      const res = await this.api.post<RawPricesResponse>(
        creds,
        '/v5/product/info/prices',
        { filter: { visibility: 'ALL' }, limit: LIST_PAGE, cursor },
      );
      const items = res.items ?? [];
      for (const it of items) {
        if (!it.offer_id) continue;
        const c = it.commissions ?? {};
        map.set(it.offer_id, {
          commissionPercent: c.sales_percent_fbs ?? 0,
          acquiring: it.acquiring ?? 0,
          firstMileMin: c.fbs_first_mile_min_amount ?? 0,
          firstMileMax: c.fbs_first_mile_max_amount ?? 0,
          directFlowMin: c.fbs_direct_flow_trans_min_amount ?? 0,
          directFlowMax: c.fbs_direct_flow_trans_max_amount ?? 0,
          lastMile: c.fbs_deliv_to_customer_amount ?? 0,
          returnFlow: c.fbs_return_flow_amount ?? 0,
          marketingActions: (it.marketing_actions?.actions ?? []).map((a) => ({
            title: a.title ?? '',
            percent: a.value ?? 0,
          })),
        });
      }
      cursor = res.cursor ?? '';
      if (!cursor || items.length === 0) break;
    }
    return map;
  }

  /**
   * Подробности одной карточки: описание и габариты.
   *
   * Два запроса, потому что Ozon держит описание отдельно от остальных
   * атрибутов. Падение любого из них не должно ронять карточку целиком —
   * лучше показать часть полей, чем пустой экран с ошибкой.
   */
  async productCard(
    creds: OzonCredentials,
    offerId: string,
  ): Promise<OzonProductCard> {
    const [attrs, description] = await Promise.all([
      this.api
        .post<RawAttributesResponse>(creds, '/v4/product/info/attributes', {
          filter: { offer_id: [offerId], visibility: 'ALL' },
          limit: 1,
        })
        .catch(() => null),
      this.api
        .post<RawDescriptionResponse>(creds, '/v1/product/info/description', {
          offer_id: offerId,
        })
        .catch(() => null),
    ]);

    const item = attrs?.result?.[0];
    return {
      offerId,
      description: description?.result?.description ?? null,
      depth: item?.depth ?? null,
      width: item?.width ?? null,
      height: item?.height ?? null,
      dimensionUnit: item?.dimension_unit ?? null,
      weight: item?.weight ?? null,
      weightUnit: item?.weight_unit ?? null,
      attributes: (item?.attributes ?? [])
        .map((a) => ({
          name: a.attribute_name ?? String(a.attribute_id ?? ''),
          values: (a.values ?? []).map((v) => v.value ?? '').filter(Boolean),
        }))
        .filter((a) => a.name && a.values.length > 0),
    };
  }

  /**
   * Правка названия и описания у уже опубликованного товара.
   *
   * Ozon обновляет карточку импортом, и импорт заменяет её целиком: всё,
   * чего нет в запросе, стирается. Поэтому сначала читаем карточку как
   * есть, накладываем правки поверх и отправляем полный набор — иначе
   * одна правка названия унесла бы с собой все заполненные характеристики.
   *
   * Описание у Ozon живёт не отдельным полем, а атрибутом 4191
   * («Аннотация»), поэтому меняется среди прочих атрибутов.
   *
   * Возвращаем номер задачи импорта: площадка принимает изменения не
   * мгновенно и может их отклонить, поэтому результат узнаём отдельным
   * запросом, а не по факту «запрос ушёл».
   */
  async updateCardText(
    creds: OzonCredentials,
    offerId: string,
    changes: { name?: string; description?: string },
  ): Promise<{ taskId: number }> {
    const attrs = await this.api.post<RawAttributesResponse>(
      creds,
      '/v4/product/info/attributes',
      { filter: { offer_id: [offerId], visibility: 'ALL' }, limit: 1 },
    );
    const current = attrs.result?.[0];
    if (!current) {
      throw new Error(`Товар ${offerId} не найден в кабинете Ozon`);
    }

    /*
     * Номер атрибута описания у Ozon различается по категориям, поэтому
     * ищем его в самой карточке: сначала по имени («Аннотация», «Описание»),
     * и только если не нашли — берём общий 4191.
     *
     * Раньше номер был захардкожен, и в категории с другим номером описание
     * уходило в несуществующий атрибут: Ozon принимал задачу импорта, но
     * текст не менялся — то есть отчёт «принято» был правдой, а результата
     * не было.
     */
    const descriptionAttr = (current.attributes ?? []).find((a) =>
      /аннотац|описан/i.test(a.attribute_name ?? ''),
    );
    const descriptionAttrId =
      descriptionAttr?.attribute_id ?? DESCRIPTION_ATTRIBUTE_ID;

    const kept = (current.attributes ?? []).filter(
      (a) => a.attribute_id !== descriptionAttrId,
    );
    const description =
      changes.description?.trim() ||
      descriptionAttr?.values?.[0]?.value;

    const item: Record<string, unknown> = {
      offer_id: offerId,
      description_category_id: current.description_category_id,
      type_id: current.type_id,
      attributes: [
        ...kept,
        ...(description
          ? [
              {
                id: descriptionAttrId,
                complex_id: 0,
                values: [{ value: description }],
              },
            ]
          : []),
      ],
    };
    if (changes.name?.trim()) item.name = changes.name.trim();

    const res = await this.api.post<{ result?: { task_id?: number } }>(
      creds,
      '/v3/product/import',
      { items: [item] },
    );
    const taskId = res.result?.task_id;
    if (!taskId) throw new Error('Ozon не вернул номер задачи импорта');
    return { taskId };
  }

  /** Чем закончился импорт: приняли, ещё считают или отклонили с причиной. */
  async importStatus(
    creds: OzonCredentials,
    taskId: number,
  ): Promise<{ status: string; errors: string[] }> {
    const res = await this.api.post<RawImportInfoResponse>(
      creds,
      '/v1/product/import/info',
      { task_id: taskId },
    );
    const item = res.result?.items?.[0];
    return {
      status: item?.status ?? 'unknown',
      errors: (item?.errors ?? [])
        .map((e) => e.message || e.code || '')
        .filter(Boolean),
    };
  }

  /**
   * Контент-рейтинг карточек: чего им не хватает по мнению самого Ozon.
   *
   * Это не наша выдумка про «хорошее описание» — площадка считает рейтинг
   * сама и по нему же ранжирует выдачу. Она возвращает и незакрытые
   * условия, и вес каждого: видно не просто «заполните атрибуты», а какие
   * именно и сколько баллов это добавит.
   *
   * Запрашиваем партиями: Ozon принимает ограниченное число SKU за раз, а
   * товаров в кабинете сотни.
   */
  async contentRating(
    creds: OzonCredentials,
    skus: string[],
  ): Promise<Map<string, OzonContentRating>> {
    const map = new Map<string, OzonContentRating>();
    const numeric = skus.map(Number).filter((n) => Number.isFinite(n) && n > 0);

    for (let i = 0; i < numeric.length; i += RATING_BATCH) {
      const batch = numeric.slice(i, i + RATING_BATCH);
      const res = await this.api
        .post<RawRatingResponse>(creds, '/v1/product/rating-by-sku', {
          skus: batch,
        })
        // Рейтинг — подсказка, а не основа списка: если он не пришёл,
        // товары должны показаться без него, а не пропасть.
        .catch(() => null);

      for (const p of res?.products ?? []) {
        if (!p.sku) continue;
        const missing = (p.groups ?? []).flatMap((g) =>
          (g.conditions ?? [])
            .filter((c) => !c.fulfilled && c.description)
            .map((c) => ({
              group: g.name ?? '',
              what: c.description!,
              points: c.cost ?? 0,
            })),
        );
        map.set(String(p.sku), {
          rating: p.rating ?? 0,
          missing: missing.sort((a, b) => b.points - a.points),
        });
      }
    }
    return map;
  }

  /**
   * Ключ объединения уже опубликованной карточки с этим кодом принта.
   *
   * Ozon сводит товары в одну карточку по атрибуту 8292: значение должно
   * совпадать у всех цветов. Если генерировать его заново при каждой
   * публикации, добавленный цвет уходит отдельной карточкой — так и вышло
   * с белой футболкой JDM-1-1, вставшей рядом с чёрной вместо неё.
   *
   * Поэтому перед публикацией спрашиваем у самой площадки: есть ли уже
   * товар с таким кодом и какой у него ключ. Нашли — используем его,
   * не нашли — принт публикуется впервые, и подойдёт собственный.
   */
  async existingUnionKey(
    creds: OzonCredentials,
    slug: string,
  ): Promise<string | null> {
    const list = await this.api
      .post<{ result?: { items?: { offer_id?: string }[] } }>(
        creds,
        '/v3/product/list',
        { filter: { visibility: 'ALL' }, last_id: '', limit: 1000 },
      )
      .catch(() => null);

    // Ищем любой уже заведённый вариант этого принта: артикул начинается
    // с кода и продолжается цветом или размером.
    const sibling = (list?.result?.items ?? [])
      .map((i) => i.offer_id ?? '')
      .find((id) => id.startsWith(`${slug}-`));
    if (!sibling) return null;

    const attrs = await this.api
      .post<RawAttributesResponse>(creds, '/v4/product/info/attributes', {
        filter: { offer_id: [sibling], visibility: 'ALL' },
        limit: 1,
      })
      .catch(() => null);

    const value = (attrs?.result?.[0]?.attributes ?? []).find(
      (a) => a.attribute_id === UNION_ATTRIBUTE_ID,
    )?.values?.[0]?.value;
    return value?.trim() || null;
  }

  /** Акции площадки: в каких участвуем и сколько товаров подходит. */
  async listActions(creds: OzonCredentials): Promise<OzonActionView[]> {
    const res = await this.api.get<RawActionsResponse>(creds, '/v1/actions');
    return (res.result ?? []).map((a) => ({
      id: a.id ?? 0,
      title: a.title ?? '',
      dateStart: a.date_start ?? null,
      dateEnd: a.date_end ?? null,
      isParticipating: Boolean(a.is_participating),
      participatingProducts: a.participating_products_count ?? 0,
      potentialProducts: a.potential_products_count ?? 0,
      actionType: a.action_type ?? null,
      discountPercent: a.discount_value ?? null,
    }));
  }

  private toProduct(
    i: RawInfoItem,
    stocks: Map<string, { present: number; reserved: number }>,
    demand: Map<string, OzonDemand>,
  ): OzonCatalogProduct {
    const offerId = i.offer_id ?? '';
    const sku = i.sku !== undefined && i.sku !== 0 ? String(i.sku) : null;
    const stock = stocks.get(offerId);
    const d = sku ? demand.get(sku) : undefined;

    // Комиссия по FBS: продавец работает по этой схеме, поэтому из списка
    // комиссий берём её, а не FBO.
    const fbs = (i.commissions ?? []).find((c) =>
      (c.sale_schema ?? '').toLowerCase().includes('fbs'),
    );

    return {
      offerId,
      productId: i.id ?? 0,
      sku,
      name: i.name ?? '',
      primaryImage: i.primary_image?.[0] ?? null,
      images: i.images ?? [],
      price: Number(i.price ?? 0),
      oldPrice: Number(i.old_price ?? 0),
      minPrice: Number(i.min_price ?? 0),
      archived: Boolean(i.is_archived),
      statusName: i.statuses?.status_name ?? '',
      moderateStatus: i.statuses?.moderate_status ?? null,
      statusDescription: i.statuses?.status_description || null,
      modelId: i.model_info?.model_id ?? null,
      modelCount: i.model_info?.count ?? null,
      barcodes: (i.barcodes ?? []).filter(Boolean),
      hasPrice: i.visibility_details?.has_price ?? false,
      hasStock: i.visibility_details?.has_stock ?? false,
      stockPresent: stock?.present ?? i.stocks?.present ?? 0,
      stockReserved: stock?.reserved ?? i.stocks?.reserved ?? 0,
      commissionPercent: fbs?.percent ?? null,
      orderedUnits30d: d?.orderedUnits ?? 0,
      revenue30d: d?.revenue ?? 0,
    };
  }

  /** Обновление цен. Не требует модерации — меняется сразу. */
  async updatePrices(
    creds: OzonCredentials,
    items: {
      offerId: string;
      price: number;
      oldPrice?: number;
      minPrice?: number;
    }[],
  ): Promise<{ offerId: string; updated: boolean; error: string | null }[]> {
    const res = await this.api.post<{
      result?: {
        offer_id?: string;
        updated?: boolean;
        errors?: { message?: string; code?: string }[];
      }[];
    }>(creds, '/v1/product/import/prices', {
      prices: items.map((i) => ({
        offer_id: i.offerId,
        price: String(Math.round(i.price)),
        // Ozon требует old_price либо больше цены, либо нулевым: иначе
        // «зачёркнутая» цена оказывается ниже актуальной и метод отбивает.
        old_price: String(
          Math.round(i.oldPrice && i.oldPrice > i.price ? i.oldPrice : 0),
        ),
        min_price: String(Math.round(i.minPrice ?? 0)),
        currency_code: 'RUB',
        auto_action_enabled: 'UNKNOWN',
      })),
    });

    return (res.result ?? []).map((r) => ({
      offerId: r.offer_id ?? '',
      updated: Boolean(r.updated),
      error: r.errors?.[0]?.message ?? r.errors?.[0]?.code ?? null,
    }));
  }

  /** Остатки на складе FBS. Ozon считает их по складу, поэтому нужен его id. */
  async updateStocks(
    creds: OzonCredentials,
    warehouseId: number,
    items: { offerId: string; stock: number }[],
  ): Promise<{ offerId: string; updated: boolean; error: string | null }[]> {
    const res = await this.api.post<{
      result?: {
        offer_id?: string;
        updated?: boolean;
        errors?: { message?: string; code?: string }[];
      }[];
    }>(creds, '/v2/products/stocks', {
      stocks: items.map((i) => ({
        offer_id: i.offerId,
        stock: Math.max(0, Math.round(i.stock)),
        warehouse_id: warehouseId,
      })),
    });

    return (res.result ?? []).map((r) => ({
      offerId: r.offer_id ?? '',
      updated: Boolean(r.updated),
      error: r.errors?.[0]?.message ?? r.errors?.[0]?.code ?? null,
    }));
  }

  /** Убрать товар из продажи в архив или вернуть обратно. */
  async setArchived(
    creds: OzonCredentials,
    productIds: number[],
    archived: boolean,
  ): Promise<boolean> {
    const path = archived ? '/v1/product/archive' : '/v1/product/unarchive';
    const res = await this.api.post<{ result?: boolean }>(creds, path, {
      product_id: productIds,
    });
    return Boolean(res.result);
  }
}
