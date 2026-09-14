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
import type {
  BehaviorIssues,
  BehaviorSummary,
  DevicesBehavior,
  FormErrors,
  Funnel,
  PagesBehavior,
  PathsBehavior,
} from '../types/behavior';
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

/** Поведение и воронки (этап 10): тот же префикс, флаг и правила доступа. */
export const behaviorApi = {
  summary: (q: PeriodQuery) => get<BehaviorSummary>('behavior/summary', q),
  funnels: (q: PeriodQuery) => get<Funnel[]>('behavior/funnels', q),
  errors: (q: PeriodQuery) => get<FormErrors>('behavior/errors', q),
  pages: (q: PeriodQuery) => get<PagesBehavior>('behavior/pages', q),
  devices: (q: PeriodQuery) => get<DevicesBehavior>('behavior/devices', q),
  paths: (q: PeriodQuery) => get<PathsBehavior>('behavior/paths', q),
  issues: (q: PeriodQuery) => get<BehaviorIssues>('behavior/issues', q),
};

/** Ключ кэша react-query — тот же, что ключ серверного кэша: вид + период. */
export function periodKey(q: PeriodQuery): string {
  return 'preset' in q ? q.preset : `${q.from}..${q.to}`;
}
