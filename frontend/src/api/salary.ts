import type {
  ExecutorSalaryData,
  CreatePaymentDto,
  CreatePaymentByAccrualsDto,
  PaymentByAccrualsResult,
  RecentPayment,
} from '../types/index';
import { api } from './client';

/** Личный баланс исполнителя: только агрегаты, без сумм по заказам. */
export interface MySalaryBalance {
  totalDebt: number;
  pendingOrders: number;
  totalPaid: number;
  payments: {
    id: string;
    createdAt: string;
    amount: number;
    note: string | null;
  }[];
}

export const salaryApi = {
  getMyBalance: async (): Promise<MySalaryBalance> => {
    const { data } = await api.get<MySalaryBalance>('/salary/me');
    return data;
  },

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
