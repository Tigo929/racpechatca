import type { TshirtStock, SetStockDto } from '../types/index';
import { api } from './client';

export const stockApi = {
  list: async (): Promise<TshirtStock[]> => {
    const { data } = await api.get<TshirtStock[]>('/stock');
    return data;
  },

  setQuantity: async (dto: SetStockDto): Promise<TshirtStock> => {
    const { data } = await api.patch<TshirtStock>('/stock', dto);
    return data;
  },
};
