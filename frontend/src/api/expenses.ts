import type { ExpenseOrder, CreateExpenseDto } from '../types/index';
import { api } from './client';

export const expensesApi = {
  getAll: async (year?: number): Promise<ExpenseOrder[]> => {
    const { data } = await api.get<ExpenseOrder[]>(
      year ? `/expenses?year=${year}` : '/expenses',
    );
    return data;
  },

  create: async (dto: CreateExpenseDto): Promise<ExpenseOrder> => {
    const { data } = await api.post<ExpenseOrder>('/expenses', dto);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/expenses/${id}`);
  },
};
