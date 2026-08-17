import { api } from './client';

/**
 * Кабинеты маркетплейсов. Ключ на фронт не приходит никогда — только хвост
 * (`apiKeyHint`) и итог последней проверки связи.
 */

export type EnumMarketplace = 'OZON' | 'WB' | 'YANDEX';

/** Сводка, которую вернула площадка при проверке (для Ozon). */
export interface OzonConnectionInfo {
  productTotal: number | null;
  warehouses: { id: number; name: string }[] | null;
  checkedAt: string;
}

export interface MarketplaceAccount {
  id: string;
  marketplace: EnumMarketplace;
  title: string;
  /** Публичный идентификатор кабинета: Client-Id у Ozon. */
  externalId: string;
  apiKeyHint: string;
  isActive: boolean;
  lastCheckAt: string | null;
  lastCheckOk: boolean | null;
  lastCheckError: string | null;
  lastCheckInfo: OzonConnectionInfo | null;
}

export interface CreateAccountDto {
  marketplace: EnumMarketplace;
  title: string;
  externalId: string;
  apiKey: string;
}

export interface UpdateAccountDto {
  title?: string;
  externalId?: string;
  /** Пусто — ключ не меняем. */
  apiKey?: string;
  isActive?: boolean;
}

export const marketplaceApi = {
  list: async (marketplace?: EnumMarketplace): Promise<MarketplaceAccount[]> => {
    const { data } = await api.get<MarketplaceAccount[]>('/marketplace/accounts', {
      params: marketplace ? { marketplace } : undefined,
    });
    return data;
  },

  create: async (dto: CreateAccountDto): Promise<MarketplaceAccount> => {
    const { data } = await api.post<MarketplaceAccount>('/marketplace/accounts', dto);
    return data;
  },

  update: async (id: string, dto: UpdateAccountDto): Promise<MarketplaceAccount> => {
    const { data } = await api.patch<MarketplaceAccount>(
      `/marketplace/accounts/${id}`,
      dto,
    );
    return data;
  },

  remove: async (id: string): Promise<{ ok: true }> => {
    const { data } = await api.delete<{ ok: true }>(`/marketplace/accounts/${id}`);
    return data;
  },

  check: async (id: string): Promise<MarketplaceAccount> => {
    const { data } = await api.post<MarketplaceAccount>(
      `/marketplace/accounts/${id}/check`,
    );
    return data;
  },
};
