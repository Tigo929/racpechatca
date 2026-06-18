import type {
  OrdersResponse,
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
    const { data } = await api.get<OrdersResponse>(`/order-photo?${params}`);
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
};
