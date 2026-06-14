import type {
  ExecutorSalaryData,
  CreatePaymentDto,
  CreatePaymentByAccrualsDto,
  PaymentByAccrualsResult,
  RecentPayment,
} from '../types/index';
import { api } from './client';

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
