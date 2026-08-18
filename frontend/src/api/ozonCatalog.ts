import { api } from './client';
import type { EnumTshirtSize } from '../types/index';

/**
 * Каталог Ozon: константы категории «Футболка» (шаблон) + принты (карточки
 * товара) с вариантами цвет×размер. Ключ Ozon сюда не попадает — сервер сам
 * подставляет доступы по id кабинета.
 */

export type EnumTshirtGender = 'UNISEX' | 'MALE' | 'FEMALE' | 'KIDS';
export type EnumOzonSyncStatus = 'DRAFT' | 'QUEUED' | 'SENT' | 'OK' | 'ERROR';

export interface SizeDimensions {
  weightG: number;
  widthMm: number;
  heightMm: number;
  lengthMm: number;
}

export interface OzonCatalogTemplate {
  id: string;
  marketplaceAccountId: string;
  descriptionCategoryId: number;
  typeId: number;
  vatRate: string;
  needsMarkingCode: boolean;
  brandLabel: string;
  brandDictionaryValueId: number;
  countryLabel: string | null;
  countryDictionaryValueId: number | null;
  materialLabel: string | null;
  materialDictionaryValueId: number | null;
  materialComposition: string | null;
  styleLabel: string | null;
  styleDictionaryValueId: number | null;
  seasonLabel: string | null;
  seasonDictionaryValueId: number | null;
  careInstructions: string | null;
  sleeveLabel: string | null;
  sleeveDictionaryValueId: number | null;
  necklineLabel: string | null;
  necklineDictionaryValueId: number | null;
  packageTypeLabel: string | null;
  packageTypeDictionaryValueId: number | null;
  tnvedLabel: string | null;
  tnvedDictionaryValueId: number | null;
  sizeDimensions: Record<string, SizeDimensions>;
  /** Общие доп. фото — одинаковые во всех карточках кабинета. */
  sharedPhotoUrls: string[];
}

export type UpdateOzonCatalogTemplateDto = Partial<
  Omit<OzonCatalogTemplate, 'id' | 'marketplaceAccountId' | 'descriptionCategoryId' | 'typeId'>
>;

export interface OzonVariant {
  id: string;
  printId: string;
  colorLabel: string;
  colorDictionaryValueId: number;
  colorCode: string;
  size: EnumTshirtSize;
  offerId: string;
  priceOverride: number | null;
  status: EnumOzonSyncStatus;
  ozonProductId: string | null;
  ozonSku: string | null;
  lastError: string | null;
}

export interface OzonPrint {
  id: string;
  marketplaceAccountId: string;
  slug: string;
  name: string;
  description: string | null;
  hashtags: string | null;
  mainPhotoUrl: string;
  extraPhotoUrls: string[];
  price: number;
  oldPrice: number | null;
  gender: EnumTshirtGender;
  patternTags: string[];
  unionKey: string;
  status: EnumOzonSyncStatus;
  lastError: string | null;
  variants: OzonVariant[];
  createdAt: string;
}

export interface OzonColorGroupInput {
  colorLabel: string;
  colorDictionaryValueId: number;
  /** Латинский код цвета в артикуле: JDM-1-1-black-S. */
  colorCode?: string;
  sizes: EnumTshirtSize[];
}

export interface CreateOzonPrintDto {
  slug?: string;
  name: string;
  description?: string;
  hashtags?: string;
  mainPhotoUrl: string;
  extraPhotoUrls?: string[];
  price: number;
  oldPrice?: number;
  gender?: EnumTshirtGender;
  patternTags?: string[];
  /** «Объединить на одной карточке»; пусто — сервер возьмёт код принта. */
  unionKey?: string;
  colorGroups: OzonColorGroupInput[];
}

export interface OzonAttributeValueOption {
  id: number;
  value: string;
  info: string;
}

export interface PublishResult {
  batches: { batchId: string; taskId: string; count: number }[];
}

export const ozonCatalogApi = {
  /**
   * Загружает фото на наш сервер и возвращает публичные ссылки. Ozon сам
   * приходит за картинкой по такой ссылке, поэтому локальный файл сначала
   * должен оказаться у нас.
   */
  uploadPhotos: async (files: File[]): Promise<string[]> => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    const { data } = await api.post<{ urls: string[] }>(
      '/marketplace/ozon/photos',
      form,
    );
    return data.urls;
  },

  getTemplate: async (accountId: string): Promise<OzonCatalogTemplate> => {
    const { data } = await api.get<OzonCatalogTemplate>(`/marketplace/ozon/${accountId}/template`);
    return data;
  },

  updateTemplate: async (
    accountId: string,
    dto: UpdateOzonCatalogTemplateDto,
  ): Promise<OzonCatalogTemplate> => {
    const { data } = await api.patch<OzonCatalogTemplate>(`/marketplace/ozon/${accountId}/template`, dto);
    return data;
  },

  searchAttributeValue: async (
    accountId: string,
    attributeId: number,
    q: string,
  ): Promise<OzonAttributeValueOption[]> => {
    const { data } = await api.get<OzonAttributeValueOption[]>(
      `/marketplace/ozon/${accountId}/attribute-search`,
      { params: { attributeId, q } },
    );
    return data;
  },

  listPrints: async (accountId: string): Promise<OzonPrint[]> => {
    const { data } = await api.get<OzonPrint[]>(`/marketplace/ozon/${accountId}/prints`);
    return data;
  },

  createPrint: async (accountId: string, dto: CreateOzonPrintDto): Promise<OzonPrint> => {
    const { data } = await api.post<OzonPrint>(`/marketplace/ozon/${accountId}/prints`, dto);
    return data;
  },

  createPrintsBulk: async (accountId: string, prints: CreateOzonPrintDto[]): Promise<OzonPrint[]> => {
    const { data } = await api.post<OzonPrint[]>(`/marketplace/ozon/${accountId}/prints/bulk`, { prints });
    return data;
  },

  publish: async (accountId: string, printIds: string[]): Promise<PublishResult> => {
    const { data } = await api.post<PublishResult>(`/marketplace/ozon/${accountId}/prints/publish`, {
      printIds,
    });
    return data;
  },

  addColorGroup: async (printId: string, group: OzonColorGroupInput): Promise<OzonPrint> => {
    const { data } = await api.post<OzonPrint>(`/marketplace/ozon/prints/${printId}/variants`, group);
    return data;
  },

  removePrint: async (printId: string): Promise<{ ok: true }> => {
    const { data } = await api.delete<{ ok: true }>(`/marketplace/ozon/prints/${printId}`);
    return data;
  },
};
