import { Module } from '@nestjs/common';
import { AnalyticsMetricsModule } from '../metrics/analytics-metrics.module';
import {
  AnalyticsDashboardController,
  DASHBOARD_OPTIONS,
  dashboardEnabledFromEnv,
} from './analytics-dashboard.controller';
import { DashboardCache } from './dashboard-cache';
import { AdPerformanceController } from '../ads/ad-performance.controller';
import { AdPerformanceService } from '../ads/ad-performance.service';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Дашборд руководителя (этап 09): read-only API поверх канонических
 * метрик. Флаг и кэш — явные провайдеры, а не глобальное состояние.
 */
@Module({
  imports: [AnalyticsMetricsModule],
  controllers: [AnalyticsDashboardController, AdPerformanceController],
  providers: [
    {
      provide: DASHBOARD_OPTIONS,
      useFactory: () => ({ enabled: dashboardEnabledFromEnv() }),
    },
    { provide: DashboardCache, useFactory: () => new DashboardCache() },
    {
      provide: AdPerformanceService,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new AdPerformanceService(prisma),
    },
  ],
})
export class AnalyticsDashboardModule {}
