import type {
  OrdersResponse,
  OrdersStats,
  OrderPhoto,
  CreateOrderDto,
  UpdateOrderDto,
  UpdateStatusDto,
  UpdateItemDto,
  CreateItemDto,
  OrdersQuery,
  ItemTshirt,
  CreateTshirtItemDto,
  UpdateTshirtItemDto,
} from '../types/index';
import { api } from './client';

export const ordersApi = {
  getAll: async (query: OrdersQuery = {}): Promise<OrdersResponse> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.status) params.set('status', query.status);
    if (query.sourceOrder) params.set('sourceOrder', query.sourceOrder);
    if (query.productCategory) params.set('productCategory', query.productCategory);
    if (query.reviewLeft !== undefined) params.set('reviewLeft', String(query.reviewLeft));
    if (query.search) params.set('search', query.search);
    const { data } = await api.get<OrdersResponse>(`/order-photo?${params}`);
    return data;
  },

  getStats: async (query: OrdersQuery = {}): Promise<OrdersStats> => {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.sourceOrder) params.set('sourceOrder', query.sourceOrder);
    if (query.productCategory) params.set('productCategory', query.productCategory);
    if (query.reviewLeft !== undefined) params.set('reviewLeft', String(query.reviewLeft));
    if (query.search) params.set('search', query.search);
    const qs = params.toString();
    const { data } = await api.get<OrdersStats>(`/order-photo/stats${qs ? `?${qs}` : ''}`);
    return data;
  },

  setReview: async (orderId: string, reviewLeft: boolean): Promise<OrderPhoto> => {
    const { data } = await api.patch<OrderPhoto>(`/order-photo/${orderId}/review`, { reviewLeft });
    return data;
  },

  getById: async (id: string): Promise<OrderPhoto> => {
    const { data } = await api.get<OrderPhoto>(`/order-photo/${id}`);
    return data;
  },

  assignExecutor: async (
    orderId: string,
    executorId: string | null,
    note?: string,
  ): Promise<OrderPhoto> => {
    const { data } = await api.patch<OrderPhoto>(`/order-photo/${orderId}/assign`, {
      executorId: executorId || null,
      note,
    });
    return data;
  },

  create: async (dto: CreateOrderDto): Promise<OrderPhoto> => {
    const { data } = await api.post<OrderPhoto>('/order-photo', dto);
    return data;
  },

  /** PDF-стикер заказа-футболки (58×40 мм). Возвращает blob для печати. */
  getStickerPdf: async (orderId: string): Promise<Blob> => {
    const { data } = await api.get<Blob>(`/order-photo/${orderId}/sticker`, {
      responseType: 'blob',
    });
    return data;
  },

  /** Клиентский PDF-стикер на пакет (58×40 мм). Доступен и исполнителю. */
  getClientStickerPdf: async (orderId: string): Promise<Blob> => {
    const { data } = await api.get<Blob>(
      `/order-photo/${orderId}/client-sticker`,
      { responseType: 'blob' },
    );
    return data;
  },

  /** Прикрепить ТЗ-файлы (согласованный макет + уточнения) к заказу. */
  uploadTechSpecPhotos: async (
    orderId: string,
    files: File[],
  ): Promise<OrderPhoto> => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    const { data } = await api.post<OrderPhoto>(
      `/order-photo/${orderId}/techspec-photo`,
      form,
    );
    return data;
  },

  /** Прикрепить одно ТЗ-фото к заказу. Оставлено для старых вызовов. */
  uploadTechSpecPhoto: async (
    orderId: string,
    file: File,
  ): Promise<OrderPhoto> => {
    return ordersApi.uploadTechSpecPhotos(orderId, [file]);
  },

  /** Просмотр прикреплённого ТЗ-файла (blob для открытия во вкладке). */
  getTechSpecPhoto: async (orderId: string, index = 0): Promise<Blob> => {
    const { data } = await api.get<Blob>(
      index === 0
        ? `/order-photo/${orderId}/techspec-photo`
        : `/order-photo/${orderId}/techspec-photo/${index}`,
      { responseType: 'blob' },
    );
    return data;
  },

  /** Отправить заказ исполнителю-партнёру (требуется прикреплённое ТЗ-фото). */
  sendToPartner: async (orderId: string): Promise<OrderPhoto> => {
    const { data } = await api.post<OrderPhoto>(`/order-photo/${orderId}/send-to-partner`);
    return data;
  },

  /** Повторно отправить футболочное ТЗ исполнителю в Telegram. */
  sendTshirtTelegram: async (orderId: string): Promise<OrderPhoto> => {
    const { data } = await api.post<OrderPhoto>(`/order-photo/${orderId}/send-tshirt-telegram`);
    return data;
  },

  update: async (id: string, dto: UpdateOrderDto): Promise<OrderPhoto> => {
    const { data } = await api.patch<OrderPhoto>(`/order-photo/${id}`, dto);
    return data;
  },

  updateStatus: async (id: string, dto: UpdateStatusDto): Promise<OrderPhoto> => {
    const { data } = await api.patch<OrderPhoto>(`/order-photo/${id}/status`, dto);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/order-photo/${id}`);
  },

  addItem: async (orderId: string, dto: CreateItemDto): Promise<OrderPhoto> => {
    const { data } = await api.post<OrderPhoto>(`/order-photo/${orderId}/items`, dto);
    return data;
  },

  updateItem: async (itemId: string, dto: UpdateItemDto): Promise<OrderPhoto> => {
    const { data } = await api.patch<OrderPhoto>(`/order-photo/items/${itemId}`, dto);
    return data;
  },

  deleteItem: async (itemId: string): Promise<OrderPhoto> => {
    const { data } = await api.delete<OrderPhoto>(`/order-photo/items/${itemId}`);
    return data;
  },

  getTshirtItem: async (itemId: string): Promise<ItemTshirt> => {
    const { data } = await api.get<ItemTshirt>(`/order-photo/tshirt-items/${itemId}`);
    return data;
  },

  addTshirtItem: async (orderId: string, dto: CreateTshirtItemDto): Promise<OrderPhoto> => {
    const { data } = await api.post<OrderPhoto>(`/order-photo/${orderId}/tshirt-items`, dto);
    return data;
  },

  updateTshirtItem: async (itemId: string, dto: UpdateTshirtItemDto): Promise<OrderPhoto> => {
    const { data } = await api.patch<OrderPhoto>(`/order-photo/tshirt-items/${itemId}`, dto);
    return data;
  },

  deleteTshirtItem: async (itemId: string): Promise<OrderPhoto> => {
    const { data } = await api.delete<OrderPhoto>(`/order-photo/tshirt-items/${itemId}`);
    return data;
  },

  /** Ручная сводка по заказам в рабочий чат (утренний контроль / вечерний итог). */
  sendStatusSummary: async (): Promise<{ sent: boolean; message: string }> => {
    const { data } = await api.post<{ sent: boolean; message: string }>(
      '/order-photo/status-summary/run',
    );
    return data;
  },
};
