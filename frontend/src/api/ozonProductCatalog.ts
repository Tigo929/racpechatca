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

export const ozonProductCatalogApi = {
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

  warehouses: async (accountId: string): Promise<OzonWarehouse[]> => {
    const { data } = await api.get<OzonWarehouse[]>(
      `/marketplace/ozon/${accountId}/warehouses`,
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
