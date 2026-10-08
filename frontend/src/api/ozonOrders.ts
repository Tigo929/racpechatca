import { api } from './client';
import type { EnumApprovalStatus, EnumStatus } from '../types/index';

/** Заказы Ozon (FBS-отправления) в нормализованном виде — сырьё приводит бэкенд. */

export type OzonOrderGroup =
  | 'to_ship'
  | 'in_transit'
  | 'delivered'
  | 'problem'
  | 'cancelled';

export interface OzonOrderItem {
  offerId: string;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
}

export interface OzonOrder {
  postingNumber: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  group: OzonOrderGroup;
  createdAt: string | null;
  shipmentDate: string | null;
  shipmentOverdue: boolean;
  deliveringDate: string | null;
  trackingNumber: string | null;
  deliveryMethod: string | null;
  warehouse: string | null;
  cancelReason: string | null;
  items: OzonOrderItem[];
  total: number;
  payout: number;
  /**
   * Заказ CRM, заведённый по этому отправлению; null — ещё не заводили.
   * По нему в списке показывается наш этап, а не статус площадки.
   */
  crm?: {
    id: string;
    numberOrder: string;
    status: EnumStatus;
    approvalStatus: EnumApprovalStatus | null;
  } | null;
}

export interface OzonOrdersPage {
  orders: OzonOrder[];
  hasNext: boolean;
  /** Сколько отправлений скрыто фильтром «только наши принты». */
  hiddenByCatalog: number;
}

/** Заказ CRM, заведённый по отправлению; null — ещё не заводили. */
export interface OzonCrmOrderLink {
  id: string;
  numberOrder: string;
  marketplaceOrderNumber: string | null;
}

export const ozonOrdersApi = {
  list: async (
    accountId: string,
    params: {
      sinceDays?: number;
      limit?: number;
      offset?: number;
      /** 1 — показать и чужие товары кабинета, не только наши принты. */
      all?: 1;
    } = {},
  ): Promise<OzonOrdersPage> => {
    const { data } = await api.get<OzonOrdersPage>(
      `/marketplace/ozon/${accountId}/orders`,
      { params },
    );
    return data;
  },

  /** Есть ли уже заказ CRM по отправлению. */
  crmOrder: async (
    accountId: string,
    postingNumber: string,
  ): Promise<OzonCrmOrderLink | null> => {
    const { data } = await api.get<{ order: OzonCrmOrderLink | null }>(
      `/marketplace/ozon/${accountId}/orders/${encodeURIComponent(postingNumber)}/crm-order`,
    );
    return data.order;
  },

  /**
   * Завести отправление в CRM. Повторный вызов открывает тот же заказ:
   * отправление связано с заказом уникальной колонкой на сервере.
   */
  createCrmOrder: async (
    accountId: string,
    postingNumber: string,
    chatUrl?: string,
  ): Promise<{ orderId: string; created: boolean }> => {
    const { data } = await api.post<{ orderId: string; created: boolean }>(
      `/marketplace/ozon/${accountId}/orders/${encodeURIComponent(postingNumber)}/crm-order`,
      { chatUrl: chatUrl?.trim() || undefined },
    );
    return data;
  },

  /**
   * Ярлык отправления (стикер) в PDF — тот, который клеят на посылку.
   * Печатаем ярлык площадки, а не свой: по нему посылку принимает Ozon.
   */
  label: async (accountId: string, postingNumber: string): Promise<Blob> => {
    const response = await api.get(
      `/marketplace/ozon/${accountId}/orders/${encodeURIComponent(postingNumber)}/label`,
      { responseType: 'blob' },
    );
    return response.data as Blob;
  },
};
