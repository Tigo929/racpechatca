import { AnalyticsMetricsService } from './analytics-metrics.service';
import { customPeriod } from './analytics-period';
import { costSettingsFrom } from '../../reports/order-cogs';

it('overview reads actual advertising expenses for both comparison periods', async () => {
  const reports = { costSettings: jest.fn().mockResolvedValue(costSettingsFrom(null)) };
  const service = new AnalyticsMetricsService({} as any, reports as any);
  jest.spyOn(service, 'loadOrders').mockResolvedValue([]);
  jest.spyOn(service, 'lastMetrikaSyncAt').mockResolvedValue(new Date());
  jest.spyOn(service, 'loadPeriod').mockResolvedValue({ metrika: { traffic: [], goals: [], pagesPageviews: 0, snapshot: null }, pnl: null });
  const spend = jest.spyOn(service, 'adSpendFor').mockResolvedValue([{
    date: '2026-09-26', source: 'yandex_direct', campaignId: '1', campaignName: '',
    spend: 811.5766, clicks: 42, impressions: 400, vatBasis: 'EXCLUDED',
  }]);
  const overview = await service.getOverview(customPeriod('2026-09-26', '2026-09-26'));
  expect(spend).toHaveBeenCalledTimes(2);
  expect(overview.financials.spend).toMatchObject({ spend: 811.5766, clicks: 42, status: 'ATTRIBUTION_NOT_ESTABLISHED', roas: null });
});
