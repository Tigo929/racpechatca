import { Module } from '@nestjs/common';
import { AnalyticsMetricsModule } from '../metrics/analytics-metrics.module';
import {
  AnalyticsDashboardController,
  DASHBOARD_OPTIONS,
  dashboardEnabledFromEnv,
} from './analytics-dashboard.controller';
import { DashboardCache } from './dashboard-cache';

/**
 * Дашборд руководителя (этап 09): read-only API поверх канонических
 * метрик. Флаг и кэш — явные провайдеры, а не глобальное состояние.
 */
@Module({
  imports: [AnalyticsMetricsModule],
  controllers: [AnalyticsDashboardController],
  providers: [
    {
      provide: DASHBOARD_OPTIONS,
      useFactory: () => ({ enabled: dashboardEnabledFromEnv() }),
    },
    { provide: DashboardCache, useFactory: () => new DashboardCache() },
  ],
})
export class AnalyticsDashboardModule {}
