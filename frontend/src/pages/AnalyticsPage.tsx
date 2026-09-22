import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { analyticsApi, behaviorApi, periodKey } from '../api/analytics';
import { usePersistentState } from '../hooks/usePersistentState';
import type { Overview, PeriodQuery } from '../types/analytics';
import { getErrorMessage } from '../utils/get-error-message';
import {
  formatAgo,
  formatCount,
  formatPeriod,
  FRESHNESS_LABELS,
  overviewWarnings,
  POLARITY,
  trafficComparisonPartial,
} from '../features/analytics/analytics-view';
import { PeriodSelector } from '../features/analytics/PeriodSelector';
import { TrendChart } from '../features/analytics/TrendChart';
import {
  AttentionCards,
  CrmFunnel,
  DataQualityPanel,
  DevicesTable,
  LandingsTable,
  MoneyDetails,
  ProductsBlock,
  SalesChannelsBlock,
  SiteFunnel,
  SourcesTable,
  UtmTable,
} from '../features/analytics/sections';
import { Card, KpiCard, Notice, StateBlock } from '../features/analytics/ui';
import {
  BehaviorHeadline,
  DevicesBlock,
  DirectionFunnels,
  FormErrorsBlock,
  FunnelCard,
  IssuesBlock,
  PagesBlock,
  PathsBlock,
} from '../features/analytics/behavior-sections';
import { behaviorWarnings } from '../features/analytics/behavior-view';
import { GrowthTab } from '../features/analytics/growth-sections';
import { InsightsTab } from '../features/analytics/insights-sections';
import { ReportsTab } from '../features/analytics/reports-sections';

/**
 * Дашборд руководителя (этап 09). Все числа — из `AnalyticsMetricsService`
 * через `/analytics/dashboard/*`; страница ничего не считает, только
 * показывает, подписывает и предупреждает о неполных данных.
 */

type Tab = 'overview' | 'insights' | 'behavior' | 'growth' | 'sources' | 'products' | 'pages' | 'quality' | 'reports';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Обзор' },
  { key: 'insights', label: 'Инсайты' },
  { key: 'behavior', label: 'Поведение' },
  { key: 'growth', label: 'Рост / Изменения' },
  { key: 'sources', label: 'Источники' },
  { key: 'products', label: 'Товары' },
  { key: 'pages', label: 'Страницы' },
  { key: 'quality', label: 'Качество данных' },
  { key: 'reports', label: 'Отчёты для ИИ' },
];

function KpiRows({ o }: { o: Overview }) {
  const c = o.comparison;
  const cmpPartial = trafficComparisonPartial(o);
  const trafficCmp = (key: 'visits' | 'periodUsers' | 'siteLeads') => (cmpPartial ? null : c?.[key]);
  const r = o.financials.realized;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard metricKey="visits" value={o.traffic.visits} format="count" cmp={trafficCmp('visits')} polarity={POLARITY.visits} />
        <KpiCard
          metricKey="periodUsers"
          value={o.traffic.periodUsers}
          format="count"
          cmp={trafficCmp('periodUsers')}
          polarity={POLARITY.periodUsers}
          note={`сумма по дням: ${formatCount(o.traffic.sumDailyUsers)}`}
          unavailable={o.traffic.periodUsers === null ? 'за этот период не подсчитаны' : undefined}
        />
        <KpiCard metricKey="siteLeads" value={o.siteFunnel.siteLeads} format="count" cmp={trafficCmp('siteLeads')} polarity={POLARITY.siteLeads} />
        <KpiCard metricKey="acceptedOrders" value={o.crmFunnel.events.acceptedOrders} format="count" cmp={c?.acceptedOrders} polarity={POLARITY.acceptedOrders} />
        <KpiCard metricKey="paidOrders" value={o.crmFunnel.events.paidOrders} format="count" cmp={c?.paidOrders} polarity={POLARITY.paidOrders} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard metricKey="realizedRevenue" value={r?.realizedRevenue} format="money" cmp={c?.realizedRevenue} polarity={POLARITY.realizedRevenue} unavailable={r ? undefined : 'отчёт недоступен'} />
        <KpiCard metricKey="cogs" value={r?.cogs} format="money" cmp={null} polarity="neutral" unavailable={r ? undefined : 'отчёт недоступен'} note="по правилам финансового отчёта" />
        <KpiCard metricKey="netProfit" value={r?.netProfit} format="money" cmp={c?.netProfit} polarity={POLARITY.netProfit} unavailable={r ? undefined : 'отчёт недоступен'} />
        <KpiCard metricKey="paidAov" value={o.orders.paidAov} format="money" cmp={c?.paidAov} polarity={POLARITY.paidAov} unavailable={o.orders.paidAov === null ? 'оплат за период нет' : undefined} />
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'overview') as Tab;
  const [period, setPeriod] = usePersistentState<PeriodQuery>('analytics-period', { preset: 'last_7_days' });
  const qc = useQueryClient();
  const key = periodKey(period);

  const status = useQuery({ queryKey: ['analytics', 'status'], queryFn: analyticsApi.status, staleTime: 5 * 60_000 });
  const enabled = status.data?.enabled === true;

  const overview = useQuery({ queryKey: ['analytics', 'overview', key], queryFn: () => analyticsApi.overview(period), enabled, staleTime: 45_000 });
  const trend = useQuery({ queryKey: ['analytics', 'trend', key], queryFn: () => analyticsApi.trend(period), enabled: enabled && tab === 'overview', staleTime: 45_000 });
  const sources = useQuery({ queryKey: ['analytics', 'sources', key], queryFn: () => analyticsApi.sources(period), enabled: enabled && tab === 'sources', staleTime: 45_000 });
  const utm = useQuery({ queryKey: ['analytics', 'utm', key], queryFn: () => analyticsApi.utm(period), enabled: enabled && tab === 'sources', staleTime: 45_000 });
  const products = useQuery({ queryKey: ['analytics', 'products', key], queryFn: () => analyticsApi.products(period), enabled: enabled && tab === 'products', staleTime: 45_000 });
  const channels = useQuery({ queryKey: ['analytics', 'sales-channels', key], queryFn: () => analyticsApi.salesChannels(period), enabled: enabled && tab === 'products', staleTime: 45_000 });
  const landings = useQuery({ queryKey: ['analytics', 'landings', key], queryFn: () => analyticsApi.landings(period), enabled: enabled && tab === 'pages', staleTime: 45_000 });
  const devices = useQuery({ queryKey: ['analytics', 'devices', key], queryFn: () => analyticsApi.devices(period), enabled: enabled && tab === 'pages', staleTime: 45_000 });
  // Поведение (этап 10): сводка первой, остальное — параллельно, страница не блокируется.
  const bTab = enabled && tab === 'behavior';
  const bSummary = useQuery({ queryKey: ['analytics', 'behavior', 'summary', key], queryFn: () => behaviorApi.summary(period), enabled: bTab, staleTime: 45_000 });
  const bFunnels = useQuery({ queryKey: ['analytics', 'behavior', 'funnels', key], queryFn: () => behaviorApi.funnels(period), enabled: bTab, staleTime: 45_000 });
  const bErrors = useQuery({ queryKey: ['analytics', 'behavior', 'errors', key], queryFn: () => behaviorApi.errors(period), enabled: bTab, staleTime: 45_000 });
  const bDevices = useQuery({ queryKey: ['analytics', 'behavior', 'devices', key], queryFn: () => behaviorApi.devices(period), enabled: bTab, staleTime: 45_000 });
  const bPages = useQuery({ queryKey: ['analytics', 'behavior', 'pages', key], queryFn: () => behaviorApi.pages(period), enabled: bTab, staleTime: 45_000 });
  const bPaths = useQuery({ queryKey: ['analytics', 'behavior', 'paths', key], queryFn: () => behaviorApi.paths(period), enabled: bTab, staleTime: 45_000 });
  const bIssues = useQuery({ queryKey: ['analytics', 'behavior', 'issues', key], queryFn: () => behaviorApi.issues(period), enabled: bTab, staleTime: 45_000 });

  const o = overview.data;
  const freshness = o?.dataQuality.freshness;
  const subtitle = o
    ? `${formatPeriod(o.period.from, o.period.to)} · ${FRESHNESS_LABELS[freshness!.status]}: данные обновлены ${formatAgo(freshness!.metrikaDataAgeSeconds)}`
    : status.data && !enabled
      ? 'раздел выключен'
      : undefined;

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === 'overview') next.delete('tab');
    else next.set('tab', t);
    setParams(next, { replace: true });
  };

  return (
    <AppShell title="Аналитика" subtitle={subtitle} onRefresh={() => void qc.invalidateQueries({ queryKey: ['analytics'] })}>
      <div className="space-y-5">
        {status.isLoading ? (
          <StateBlock kind="loading" />
        ) : status.isError ? (
          <StateBlock kind="error" message={getErrorMessage(status.error)} onRetry={() => void status.refetch()} />
        ) : !enabled ? (
          <Card title="Раздел выключен">
            <p className="text-sm text-gray-600">Дашборд аналитики отключён в настройках сервера (ANALYTICS_DASHBOARD_ENABLED). Финансовый отчёт по-прежнему доступен в разделе «Отчёты».</p>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <PeriodSelector value={period} onChange={setPeriod} />
              <nav className="flex gap-1 overflow-x-auto -mx-1 px-1" aria-label="Разделы аналитики">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    aria-current={tab === t.key ? 'page' : undefined}
                    onClick={() => setTab(t.key)}
                    className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-t ${
                      tab === t.key ? 'border-indigo-600 text-indigo-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            {overview.isLoading ? (
              <StateBlock kind="loading" />
            ) : overview.isError || !o ? (
              <StateBlock kind="error" message={getErrorMessage(overview.error)} onRetry={() => void overview.refetch()} />
            ) : (
              <>
                {/* На обзоре о задержке уже говорят предупреждение и карточка «Требует внимания» — не дублируем трижды. */}
                {freshness?.status === 'STALE' && tab !== 'overview' && <Notice warning={{ code: 'stale-header', text: 'Данные могут быть устаревшими' }} />}
                {tab === 'overview' && (
                  <>
                    <KpiRows o={o} />
                    {overviewWarnings(o).length > 0 && (
                      <div className="space-y-1.5">
                        {overviewWarnings(o).map((w) => (
                          <Notice key={w.code} warning={w} />
                        ))}
                      </div>
                    )}
                    <AttentionCards o={o} />
                    <div className="grid lg:grid-cols-2 gap-4 items-start">
                      <SiteFunnel o={o} />
                      <CrmFunnel o={o} />
                    </div>
                    <Card title="Динамика по дням" subtitle="Один показатель за раз — разные шкалы на одной оси не смешиваются">
                      {trend.isLoading ? <StateBlock kind="loading" /> : trend.isError ? <StateBlock kind="error" message={getErrorMessage(trend.error)} onRetry={() => void trend.refetch()} /> : trend.data ? <TrendChart trend={trend.data} /> : null}
                    </Card>
                    <MoneyDetails o={o} />
                  </>
                )}
                {tab === 'behavior' && (
                  <div className="space-y-4">
                    {bSummary.isLoading ? (
                      <StateBlock kind="loading" />
                    ) : bSummary.isError || !bSummary.data ? (
                      <StateBlock kind="error" message={getErrorMessage(bSummary.error)} onRetry={() => void bSummary.refetch()} />
                    ) : (
                      <>
                        <BehaviorHeadline summary={bSummary.data} />
                        {behaviorWarnings(bSummary.data.dataQuality.notes).length > 0 && (
                          <div className="space-y-1.5">
                            {behaviorWarnings(bSummary.data.dataQuality.notes).map((w) => (
                              <Notice key={w.code} warning={w} />
                            ))}
                          </div>
                        )}
                        {bIssues.isError ? <StateBlock kind="error" message={getErrorMessage(bIssues.error)} onRetry={() => void bIssues.refetch()} /> : <IssuesBlock issues={bIssues.data} />}
                        <FunnelCard funnel={bSummary.data.global} />
                        {bFunnels.isError ? <StateBlock kind="error" message={getErrorMessage(bFunnels.error)} onRetry={() => void bFunnels.refetch()} /> : <DirectionFunnels funnels={bFunnels.data} />}
                        {bErrors.isError ? <StateBlock kind="error" message={getErrorMessage(bErrors.error)} onRetry={() => void bErrors.refetch()} /> : <FormErrorsBlock errors={bErrors.data} />}
                        {bDevices.isError ? <StateBlock kind="error" message={getErrorMessage(bDevices.error)} onRetry={() => void bDevices.refetch()} /> : <DevicesBlock devices={bDevices.data} />}
                        {bPages.isError ? <StateBlock kind="error" message={getErrorMessage(bPages.error)} onRetry={() => void bPages.refetch()} /> : <PagesBlock pages={bPages.data} />}
                        {bPaths.isError ? <StateBlock kind="error" message={getErrorMessage(bPaths.error)} onRetry={() => void bPaths.refetch()} /> : <PathsBlock paths={bPaths.data} />}
                      </>
                    )}
                  </div>
                )}
                {tab === 'insights' && <InsightsTab />}
                {tab === 'growth' && <GrowthTab />}
                {tab === 'reports' && <ReportsTab />}
                {tab === 'sources' && (
                  <div className="space-y-4">
                    {sources.isError ? <StateBlock kind="error" message={getErrorMessage(sources.error)} onRetry={() => void sources.refetch()} /> : <SourcesTable slice={sources.data} />}
                    {utm.isError ? <StateBlock kind="error" message={getErrorMessage(utm.error)} onRetry={() => void utm.refetch()} /> : <UtmTable slice={utm.data} />}
                  </div>
                )}
                {tab === 'products' && (
                  <div className="space-y-4">
                    {products.isError ? <StateBlock kind="error" message={getErrorMessage(products.error)} onRetry={() => void products.refetch()} /> : <ProductsBlock slice={products.data} />}
                    {channels.isError ? <StateBlock kind="error" message={getErrorMessage(channels.error)} onRetry={() => void channels.refetch()} /> : <SalesChannelsBlock slice={channels.data} o={o} />}
                  </div>
                )}
                {tab === 'pages' && (
                  <div className="space-y-4">
                    {landings.isError ? <StateBlock kind="error" message={getErrorMessage(landings.error)} onRetry={() => void landings.refetch()} /> : <LandingsTable slice={landings.data} />}
                    {devices.isError ? <StateBlock kind="error" message={getErrorMessage(devices.error)} onRetry={() => void devices.refetch()} /> : <DevicesTable slice={devices.data} />}
                  </div>
                )}
                {tab === 'quality' && (
                  <div className="space-y-4">
                    <DataQualityPanel o={o} />
                    {overviewWarnings(o).map((w) => (
                      <Notice key={w.code} warning={w} tone="gray" />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
