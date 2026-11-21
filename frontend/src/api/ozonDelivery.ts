import { api } from './client';

/** Посылка: вес в граммах, стороны в миллиметрах. */
export interface Parcel {
  weightG: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export type ShipmentStatus =
  | 'CREATED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'AT_PICKUP_POINT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNING'
  | 'RETURNED'
  | 'ERROR';

export interface DeliveryView {
  configured: boolean;
  pickupPoint: { id: string; number: string | null; address: string | null; schedule: string | null } | null;
  recipientName: string | null;
  recipientPhone: string | null;
  /** Почему отправление создать нельзя; null — можно. */
  blocker: string | null;
  defaultParcel: Parcel;
  money: {
    clientPaid: number;
    ozonCost: number | null;
    ozonCostIsEstimate: boolean;
    earned: number | null;
  };
  shipment: null | {
    status: ShipmentStatus;
    ozonStatus: string | null;
    postingNumber: string | null;
    ozonOrderNumber: string | null;
    parcel: Parcel;
    estimatedCost: number | null;
    estimatedInsurance: number | null;
    estimatedDays: number | null;
    actualCost: number | null;
    createdAt: string;
    approvedAt: string | null;
    shippedAt: string | null;
    arrivedAt: string | null;
    deliveredAt: string | null;
    returnedAt: string | null;
    cancelledAt: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
  };
}

export interface Quote {
  parcel: Parcel;
  deliveryCost: number | null;
  insuranceCost: number | null;
  days: number | null;
}

const base = (id: string) => `/order-photo/${id}`;

export const ozonDeliveryApi = {
  view: async (id: string) => (await api.get<DeliveryView>(`${base(id)}/delivery`)).data,
  setDelivery: async (
    id: string,
    patch: { pickupPoint?: string; recipientName?: string; recipientPhone?: string },
  ) => (await api.patch<DeliveryView>(`${base(id)}/delivery`, patch)).data,
  quote: async (id: string, parcel: Partial<Parcel>) =>
    (await api.post<Quote>(`${base(id)}/ozon/quote`, parcel)).data,
  create: async (id: string, parcel: Partial<Parcel>) =>
    (await api.post<DeliveryView>(`${base(id)}/ozon/shipment`, { parcel })).data,
  cancel: async (id: string) => (await api.post<DeliveryView>(`${base(id)}/ozon/cancel`)).data,
  sync: async (id: string) => (await api.post<DeliveryView>(`${base(id)}/ozon/sync`)).data,
  label: async (id: string) =>
    (await api.get<Blob>(`${base(id)}/ozon/label`, { responseType: 'blob' })).data,
  /** Этикетки пачкой одним PDF; failed — по каким заказам не вышло. */
  labels: async (ids: string[]) => {
    const res = await api.post<Blob>('/order-photo/bulk/ozon-labels', { ids }, { responseType: 'blob' });
    const header = res.headers['x-labels-failed'] as string | undefined;
    return { blob: res.data, failed: header ? decodeURIComponent(header).split('\n') : [] };
  },
};

/** Открыть PDF в новой вкладке — оттуда его печатают. */
export function openPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ozon-label.pdf';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
