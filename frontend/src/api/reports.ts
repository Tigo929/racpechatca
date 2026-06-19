import type { MonthlyReport, FunnelReport } from '../types/index';
import { api } from './client';

export const reportsApi = {
  getMonthly: async (year: number): Promise<MonthlyReport> => {
    const { data } = await api.get<MonthlyReport>(`/reports/monthly?year=${year}`);
    return data;
  },

  getYears: async (): Promise<number[]> => {
    const { data } = await api.get<number[]>('/reports/years');
    return data;
  },

  getFunnel: async (year: number): Promise<FunnelReport> => {
    const { data } = await api.get<FunnelReport>(`/reports/funnel?year=${year}`);
    return data;
  },
};
