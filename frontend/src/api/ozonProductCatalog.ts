import { api } from './client';

/**
 * Живой каталог Ozon: товары читаются и правятся прямо в кабинете, копии в
 * нашей базе нет — поэтому список всегда совпадает с тем, что видит Ozon.
 */

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
  statusName: string;
  moderateStatus: string | null;
  statusDescription: string | null;
  hasPrice: boolean;
  hasStock: boolean;
  stockPresent: number;
  stockReserved: number;
  commissionPercent: number | null;
  orderedUnits30d: number;
  revenue30d: number;
  /** Родовая группа глазами Ozon: товары одной модели переключаются в карточке. */
  modelId: number | null;
  modelCount: number | null;
  /** Штрихкоды: по ним товар принимают на складе. */
  barcodes: string[];
}

export interface OzonAction {
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

export interface OzonWarehouse {
  id: number;
  name: string;
  /** Статус словами Ozon: created, disabled… Пусто — площадка не назвала. */
  status: string | null;
  /** Можно ли писать сюда остатки. */
  isEditable: boolean;
  /** Почему нельзя — показываем рядом с выключенным пунктом. */
  disabledReason: string | null;
}

/**
 * Список складов приходит вместе с отметкой времени: он хранится у нас
 * снимком, и человек должен видеть, насколько тот свежий, а не гадать.
 */
export interface OzonWarehouseList {
  warehouses: OzonWarehouse[];
  syncedAt: string | null;
  /** Площадка отказала — показан прежний снимок, и вот почему. */
  syncError: string | null;
}

/** Первый склад, на который разрешено писать остаток. */
export function firstEditableWarehouse(
  list: OzonWarehouseList | undefined,
): OzonWarehouse | undefined {
  return list?.warehouses.find((w) => w.isEditable);
}

export interface EditResult {
  offerId: string;
  updated: boolean;
  error: string | null;
}

export interface UnitEconomicsLine {
  key: string;
  label: string;
  amount: number;
  hint?: string;
}

export interface UnitEconomics {
  price: number;
  marketplaceLines: UnitEconomicsLine[];
  marketplaceTotal: number;
  payout: number;
  sellerLines: UnitEconomicsLine[];
  sellerTotal: number;
  costOfGoods: number;
  profitBeforeTax: number;
  tax: number;
  profit: number;
  marginPercent: number;
  markupPercent: number;
  breakEvenPrice: number;
}

export interface ProductTariffs {
  commissionPercent: number;
  acquiring: number;
  firstMileMin: number;
  firstMileMax: number;
  directFlowMin: number;
  directFlowMax: number;
  lastMile: number;
  returnFlow: number;
  marketingActions: { title: string; percent: number }[];
}

export interface ProductEconomics {
  offerId: string;
  tariffs: ProductTariffs | null;
  economics: UnitEconomics | null;
}

export interface UnitEconomicsSettings {
  blankCost: number;
  printCost: number;
  packagingCost: number;
  otherCost: number;
  returnRatePercent: number;
  advertisingPercent: number;
  taxPercent: number;
  taxBase: 'income' | 'profit';
  logisticsMode: 'min' | 'max';
  commissionOverridePercent: number | null;
}

/** Подробности карточки: грузятся только при её открытии. */
export interface OzonProductCard {
  offerId: string;
  description: string | null;
  depth: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: string | null;
  weight: number | null;
  weightUnit: string | null;
  attributes: { name: string; values: string[] }[];
}

/** Контент-рейтинг карточки и незакрытые условия Ozon. */
export interface OzonContentRating {
  rating: number;
  missing: { group: string; what: string; points: number }[];
}

export const ozonProductCatalogApi = {
  contentRating: async (
    accountId: string,
  ): Promise<Record<string, OzonContentRating>> => {
    const { data } = await api.get<Record<string, OzonContentRating>>(
      `/marketplace/ozon/${accountId}/catalog/content-rating`,
    );
    return data;
  },

  /** Правка названия и описания. Ответ — номер задачи импорта Ozon. */
  updateCardText: async (
    accountId: string,
    payload: { offerId: string; name?: string; description?: string },
  ): Promise<{ taskId: number }> => {
    const { data } = await api.post<{ taskId: number }>(
      `/marketplace/ozon/${accountId}/catalog/card`,
      payload,
    );
    return data;
  },

  importStatus: async (
    accountId: string,
    taskId: number,
  ): Promise<{ status: string; errors: string[] }> => {
    const { data } = await api.get<{ status: string; errors: string[] }>(
      `/marketplace/ozon/${accountId}/catalog/import-status`,
      { params: { taskId } },
    );
    return data;
  },

  card: async (accountId: string, offerId: string): Promise<OzonProductCard> => {
    const { data } = await api.get<OzonProductCard>(
      `/marketplace/ozon/${accountId}/catalog/card`,
      { params: { offerId } },
    );
    return data;
  },

  economics: async (accountId: string): Promise<ProductEconomics[]> => {
    const { data } = await api.get<ProductEconomics[]>(
      `/marketplace/ozon/${accountId}/economics`,
    );
    return data;
  },

  economicsSettings: async (accountId: string): Promise<UnitEconomicsSettings> => {
    const { data } = await api.get<UnitEconomicsSettings>(
      `/marketplace/ozon/${accountId}/economics/settings`,
    );
    return data;
  },

  updateEconomicsSettings: async (
    accountId: string,
    dto: Partial<UnitEconomicsSettings>,
  ): Promise<UnitEconomicsSettings> => {
    const { data } = await api.patch<UnitEconomicsSettings>(
      `/marketplace/ozon/${accountId}/economics/settings`,
      dto,
    );
    return data;
  },

  /** Пересчёт при другой цене — «что если поставлю 2990». */
  economicsPreview: async (
    accountId: string,
    offerId: string,
    price: number,
  ): Promise<ProductEconomics> => {
    const { data } = await api.get<ProductEconomics>(
      `/marketplace/ozon/${accountId}/economics/preview`,
      { params: { offerId, price } },
    );
    return data;
  },

  list: async (accountId: string): Promise<OzonCatalogProduct[]> => {
    const { data } = await api.get<OzonCatalogProduct[]>(
      `/marketplace/ozon/${accountId}/catalog`,
    );
    return data;
  },

  actions: async (accountId: string): Promise<OzonAction[]> => {
    const { data } = await api.get<OzonAction[]>(`/marketplace/ozon/${accountId}/actions`);
    return data;
  },

  warehouses: async (accountId: string): Promise<OzonWarehouseList> => {
    const { data } = await api.get<OzonWarehouseList>(
      `/marketplace/ozon/${accountId}/warehouses`,
    );
    return data;
  },

  /** Обновить список складов принудительно, не дожидаясь устаревания снимка. */
  syncWarehouses: async (accountId: string): Promise<OzonWarehouseList> => {
    const { data } = await api.post<OzonWarehouseList>(
      `/marketplace/ozon/${accountId}/warehouses/sync`,
    );
    return data;
  },

  /** Спрос по SKU за произвольный период: sku → { orderedUnits, revenue }. */
  demand: async (
    accountId: string,
    days: number,
  ): Promise<Record<string, { orderedUnits: number; revenue: number }>> => {
    const { data } = await api.get<Record<string, { orderedUnits: number; revenue: number }>>(
      `/marketplace/ozon/${accountId}/demand`,
      { params: { days } },
    );
    return data;
  },

  updatePrices: async (
    accountId: string,
    items: { offerId: string; price: number; oldPrice?: number; minPrice?: number }[],
  ): Promise<EditResult[]> => {
    const { data } = await api.post<EditResult[]>(
      `/marketplace/ozon/${accountId}/catalog/prices`,
      { items },
    );
    return data;
  },

  updateStocks: async (
    accountId: string,
    warehouseId: number,
    items: { offerId: string; stock: number }[],
  ): Promise<EditResult[]> => {
    const { data } = await api.post<EditResult[]>(
      `/marketplace/ozon/${accountId}/catalog/stocks`,
      { warehouseId, items },
    );
    return data;
  },

  setArchived: async (
    accountId: string,
    productIds: number[],
    archived: boolean,
  ): Promise<{ ok: boolean }> => {
    const { data } = await api.post<{ ok: boolean }>(
      `/marketplace/ozon/${accountId}/catalog/archive`,
      { productIds, archived },
    );
    return data;
  },
};

/**
 * Группа товаров одного принта: артикул без размера в конце.
 * `pantera-1-M` → `pantera-1`, `JDM-1-1-black-S` → `JDM-1-1-black`.
 * Старые товары заведены без цвета, новые — с цветом, поэтому режем именно
 * размер, а не считаем количество сегментов.
 */
const SIZE_SUFFIX = /-(XS|S|M|L|XL|XXL|XXXL)$/i;

export function printCodeOf(offerId: string): string {
  return offerId.replace(SIZE_SUFFIX, '');
}

export function sizeOf(offerId: string): string | null {
  return offerId.match(SIZE_SUFFIX)?.[1]?.toUpperCase() ?? null;
}

/**
 * Известные коды цвета в артикуле. Список, а не «последний сегмент»:
 * у старых товаров цвета в артикуле нет вовсе (kavkaz-1-M), и отрезать
 * там нечего — иначе принт распался бы на выдуманные группы.
 */
const COLOR_CODES = [
  'black', 'white', 'grey', 'gray', 'red', 'blue', 'green',
  'beige', 'pink', 'yellow', 'brown', 'orange', 'purple',
];

const COLOR_SUFFIX = new RegExp(`-(${COLOR_CODES.join('|')})$`, 'i');

/**
 * Родовая группа: артикул без размера и без цвета.
 * JDM-1-1-black-S → JDM-1-1. По ней чёрная и белая футболки с одним
 * принтом собираются в одну карточку, как в кабинете Ozon.
 */
export function baseCodeOf(offerId: string): string {
  return printCodeOf(offerId).replace(COLOR_SUFFIX, '');
}

/** Код цвета из артикула, если он там есть. */
export function colorCodeOf(offerId: string): string | null {
  return printCodeOf(offerId).match(COLOR_SUFFIX)?.[1]?.toLowerCase() ?? null;
}

/**
 * Порядок размеров как на бирке, а не по алфавиту: S раньше XL.
 *
 * Список ровно тот же, что понимает SIZE_SUFFIX выше — иначе размер, которого
 * в нём нет, молча уезжает в конец. Так и было: в карточке принта список
 * обрывался на XL, а XXL и XXXL вставали хвостом в случайном порядке, потому
 * что там перечислялись «2XL/3XL», которых в артикулах не бывает.
 */
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function sizeRank(offerId: string): number {
  const i = SIZE_ORDER.indexOf((sizeOf(offerId) ?? '').toUpperCase());
  return i === -1 ? SIZE_ORDER.length : i;
}

/**
 * Раскладка товаров карточки по цветам, размеры внутри — по бирке.
 * Нужна одинаковой в двух окнах (карточка принта и карточка размера),
 * поэтому живёт рядом с разбором артикула, а не копией в каждом из них.
 */
export function groupByColor<T extends { offerId: string }>(
  items: T[],
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const p of [...items].sort((a, b) => sizeRank(a.offerId) - sizeRank(b.offerId))) {
    const color = colorCodeOf(p.offerId) ?? 'без цвета';
    map.set(color, [...(map.get(color) ?? []), p]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
