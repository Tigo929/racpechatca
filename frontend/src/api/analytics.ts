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
import type {
  AnalyticsChangeRecord,
  ChangeInput,
  GrowthEvaluation,
  GrowthEvaluationSummary,
  GrowthStatus,
} from '../types/growth';
import type {
  FeedFilter,
  InsightRecord,
  InsightRunRecord,
  InsightVersionRecord,
  InsightsFeed,
  InsightsQuality,
  InsightsStatus,
} from '../types/insights';
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

/** Рост и изменения (этап 11): реестр и оценки — ADMIN only; окна задаёт изменение, а не пресет периода. */
const GROWTH = '/analytics/dashboard/growth';
export const growthApi = {
  status: async () => (await api.get<GrowthStatus>(`${GROWTH}/status`)).data,
  list: async () => (await api.get<AnalyticsChangeRecord[]>(`${GROWTH}/changes`)).data,
  get: async (id: string) => (await api.get<AnalyticsChangeRecord>(`${GROWTH}/changes/${id}`)).data,
  create: async (input: ChangeInput) => (await api.post<AnalyticsChangeRecord>(`${GROWTH}/changes`, input)).data,
  update: async (id: string, patch: Partial<ChangeInput>) => (await api.patch<AnalyticsChangeRecord>(`${GROWTH}/changes/${id}`, patch)).data,
  evaluate: async (id: string) => (await api.post<GrowthEvaluation>(`${GROWTH}/changes/${id}/evaluate`)).data,
  evaluations: async (id: string) => (await api.get<GrowthEvaluationSummary[]>(`${GROWTH}/changes/${id}/evaluations`)).data,
  latestEvaluation: async (id: string) => (await api.get<GrowthEvaluation>(`${GROWTH}/changes/${id}/evaluations/latest`)).data,
  evaluation: async (id: string, version: number) => (await api.get<GrowthEvaluation>(`${GROWTH}/changes/${id}/evaluations/${version}`)).data,
};

const INSIGHTS = '/analytics/dashboard/insights';
export const insightsApi = {
  status: async () => (await api.get<InsightsStatus>(`${INSIGHTS}/status`)).data,
  feed: async (f: FeedFilter = {}) => (await api.get<InsightsFeed>(`${INSIGHTS}/feed`, { params: f })).data,
  get: async (id: string) => (await api.get<InsightRecord>(`${INSIGHTS}/${id}`)).data,
  versions: async (id: string) => (await api.get<InsightVersionRecord[]>(`${INSIGHTS}/${id}/versions`)).data,
  quality: async () => (await api.get<InsightsQuality>(`${INSIGHTS}/quality`)).data,
  acknowledge: async (id: string) => (await api.post<InsightRecord>(`${INSIGHTS}/${id}/acknowledge`)).data,
  resolve: async (id: string, reason: string) => (await api.post<InsightRecord>(`${INSIGHTS}/${id}/resolve`, { reason })).data,
  run: async () => (await api.post<InsightRunRecord>(`${INSIGHTS}/run`)).data,
};

/** Ключ кэша react-query — тот же, что ключ серверного кэша: вид + период. */
export function periodKey(q: PeriodQuery): string {
  return 'preset' in q ? q.preset : `${q.from}..${q.to}`;
}
