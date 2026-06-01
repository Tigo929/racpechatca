import axios from 'axios';
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
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export const ordersApi = {
  getAll: async (query: OrdersQuery = {}): Promise<OrdersResponse> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.status) params.set('status', query.status);
    if (query.sourceOrder) params.set('sourceOrder', query.sourceOrder);
    const { data } = await api.get<OrdersResponse>(`/order-photo?${params}`);
    return data;
  },

  getById: async (id: string): Promise<OrderPhoto> => {
    const { data } = await api.get<OrderPhoto>(`/order-photo/${id}`);
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
