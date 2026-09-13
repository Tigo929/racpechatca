import type {
  CrmSlice,
  DashboardStatus,
  DeviceRow,
  LandingRow,
  Overview,
  PeriodQuery,
  ProductRow,
  SalesChannelRow,
  Slice,
  SourceRow,
  Trend,
  UtmRow,
} from '../types/analytics';
import { api } from './client';

/**
 * Дашборд руководителя (этап 09): только чтение готовых метрик с бэкенда.
 * Никаких вычислений здесь нет и быть не должно — контракт один на всех.
 */
function params(q: PeriodQuery): Record<string, string> {
  return 'preset' in q ? { preset: q.preset } : { from: q.from, to: q.to };
}

async function get<T>(path: string, q?: PeriodQuery): Promise<T> {
  const { data } = await api.get<T>(`/analytics/dashboard/${path}`, {
    params: q ? params(q) : undefined,
  });
  return data;
}

export const analyticsApi = {
  status: () => get<DashboardStatus>('status'),
  overview: (q: PeriodQuery) => get<Overview>('overview', q),
  trend: (q: PeriodQuery) => get<Trend>('trend', q),
  sources: (q: PeriodQuery) => get<Slice<SourceRow>>('sources', q),
  utm: (q: PeriodQuery) => get<Slice<UtmRow>>('utm', q),
  landings: (q: PeriodQuery) => get<Slice<LandingRow>>('landings', q),
  devices: (q: PeriodQuery) => get<Slice<DeviceRow>>('devices', q),
  products: (q: PeriodQuery) => get<CrmSlice<ProductRow>>('products', q),
  salesChannels: (q: PeriodQuery) => get<CrmSlice<SalesChannelRow>>('sales-channels', q),
};

/** Ключ кэша react-query — тот же, что ключ серверного кэша: вид + период. */
export function periodKey(q: PeriodQuery): string {
  return 'preset' in q ? q.preset : `${q.from}..${q.to}`;
}
