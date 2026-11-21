import { api } from './client';

/** Контакт клиента — остаётся, даже когда заказ удалён. Только админ. */
export interface ClientContact {
  id: string;
  name: string | null;
  phone: string | null;
  telegram: string | null;
  maxContact: string | null;
  email: string | null;
  contactUrl: string | null;
  channel: string | null;
  lastSource: string | null;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  marketingConsentSource: string | null;
  unsubscribedAt: string | null;
  ownerNote: string | null;
  canSendPromo: boolean;
  stats: {
    ordersCount: number;
    purchasesCount: number;
    purchasedTotal: number;
    categories: string[];
    deletedCount: number;
  };
  orders: {
    orderId: string;
    numberOrder: string;
    status: string;
    productCategory: string;
    totalOrder: number;
    orderCreatedAt: string;
    deleted: boolean;
  }[];
}

export interface ClientContactsResponse {
  total: number;
  page: number;
  limit: number;
  /** Скольким можно слать акции. */
  promoCount: number;
  items: ClientContact[];
}

export interface ClientContactPatch {
  marketingConsent?: boolean;
  marketingConsentSource?: string;
  unsubscribed?: boolean;
  ownerNote?: string;
  name?: string;
}

export const clientContactsApi = {
  list: async (q: { page?: number; search?: string; promoOnly?: boolean }) =>
    (
      await api.get<ClientContactsResponse>('/client-contacts', {
        params: {
          page: q.page,
          limit: 50,
          search: q.search || undefined,
          promoOnly: q.promoOnly || undefined,
        },
      })
    ).data,

  update: async (id: string, patch: ClientContactPatch) =>
    (await api.patch<ClientContact>(`/client-contacts/${id}`, patch)).data,

  /** CSV для рассылки: по умолчанию только согласившиеся. */
  exportCsv: async (all: boolean) =>
    (
      await api.get<Blob>('/client-contacts/export', {
        params: all ? { all: true } : {},
        responseType: 'blob',
      })
    ).data,
};
