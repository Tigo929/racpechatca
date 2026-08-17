import { api } from './client';

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
}

export interface OzonOrdersPage {
  orders: OzonOrder[];
  hasNext: boolean;
}

export const ozonOrdersApi = {
  list: async (
    accountId: string,
    params: { sinceDays?: number; limit?: number; offset?: number } = {},
  ): Promise<OzonOrdersPage> => {
    const { data } = await api.get<OzonOrdersPage>(
      `/marketplace/ozon/${accountId}/orders`,
      { params },
    );
    return data;
  },
};
