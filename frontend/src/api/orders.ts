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
  SalarySummary,
  ExecutorSalaryData,
  CreatePaymentDto,
  CreatePaymentByAccrualsDto,
  PaymentByAccrualsResult,
  RecentPayment,
  MonthlyReport,
} from '../types';

const api = axios.create({
  baseURL: '',
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
      window.location.href = '/crm/login';
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
    if (query.productCategory) params.set('productCategory', query.productCategory);
    const { data } = await api.get<OrdersResponse>(`/order-photo?${params}`);
    return data;
  },

  getById: async (id: string): Promise<OrderPhoto> => {
    const { data } = await api.get<OrderPhoto>(`/order-photo/${id}`);
    return data;
  },

  assignExecutor: async (
    orderId: string,
    executorId: string,
    note?: string,
  ): Promise<OrderPhoto> => {
    const { data } = await api.patch<OrderPhoto>(`/order-photo/${orderId}/assign`, {
      executorId,
      note,
    });
    return data;
  },

  // Legacy salary endpoint (backward compat)
  getSalary: async (): Promise<SalarySummary> => {
    const { data } = await api.get<SalarySummary>('/order-photo/salary/summary');
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

export const salaryApi = {
  getSummary: async (): Promise<ExecutorSalaryData[]> => {
    const { data } = await api.get<ExecutorSalaryData[]>('/salary/summary');
    return data;
  },

  getAccruals: async (executorId: string) => {
    const { data } = await api.get(`/salary/accruals/${executorId}`);
    return data;
  },

  getPayments: async (executorId: string): Promise<RecentPayment[]> => {
    const { data } = await api.get<RecentPayment[]>(`/salary/payments/${executorId}`);
    return data;
  },

  createPayment: async (dto: CreatePaymentDto): Promise<RecentPayment> => {
    const { data } = await api.post<RecentPayment>('/salary/payments', dto);
    return data;
  },

  createPaymentByAccruals: async (
    dto: CreatePaymentByAccrualsDto,
  ): Promise<PaymentByAccrualsResult> => {
    const { data } = await api.post<PaymentByAccrualsResult>(
      '/salary/payments/by-accruals',
      dto,
    );
    return data;
  },
};

export const reportsApi = {
  getMonthly: async (year: number): Promise<MonthlyReport> => {
    const { data } = await api.get<MonthlyReport>(`/reports/monthly?year=${year}`);
    return data;
  },

  getYears: async (): Promise<number[]> => {
    const { data } = await api.get<number[]>('/reports/years');
    return data;
  },
};
