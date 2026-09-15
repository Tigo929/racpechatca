import { Module, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MetrikaAnalyticsModule } from '../../metrika/analytics/metrika-analytics.module';
import { MetrikaAnalyticsSchedulerService } from '../../metrika/analytics/metrika-analytics-scheduler.service';
import { MetrikaPeriodSnapshotService } from '../../metrika/analytics/metrika-period-snapshot.service';
import { BehaviorMetricsService } from '../behavior/behavior-metrics.service';
import { BehaviorModule } from '../behavior/behavior.module';
import {
  DASHBOARD_OPTIONS,
  dashboardEnabledFromEnv,
} from '../dashboard/analytics-dashboard.controller';
import { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import { AnalyticsMetricsModule } from '../metrics/analytics-metrics.module';
import { AnalyticsGrowthService } from './analytics-growth.service';
import { GrowthDashboardController } from './growth-dashboard.controller';

/**
 * Рост и изменения (этап 11): реестр изменений, оценки «до / после» и API под
 * флагом дашборда. Автооценка и точные снимки окон подключаются к расписанию
 * этапа 07 хуком после тика — модуль расписания о росте не знает, цикла нет.
 */
@Module({
  imports: [AnalyticsMetricsModule, BehaviorModule, MetrikaAnalyticsModule],
  controllers: [GrowthDashboardController],
  providers: [
    {
      provide: AnalyticsGrowthService,
      inject: [
        PrismaService,
        AnalyticsMetricsService,
        BehaviorMetricsService,
        MetrikaPeriodSnapshotService,
      ],
      useFactory: (
        prisma: PrismaService,
        metrics: AnalyticsMetricsService,
        behavior: BehaviorMetricsService,
        snapshots: MetrikaPeriodSnapshotService,
      ) => new AnalyticsGrowthService({ prisma, metrics, behavior, snapshots }),
    },
    {
      provide: DASHBOARD_OPTIONS,
      useFactory: () => ({ enabled: dashboardEnabledFromEnv() }),
    },
  ],
  exports: [AnalyticsGrowthService],
})
export class GrowthModule implements OnModuleInit {
  constructor(
    private readonly scheduler: MetrikaAnalyticsSchedulerService,
    private readonly growth: AnalyticsGrowthService,
  ) {}

  onModuleInit() {
    this.scheduler.registerAfterSync('growth:evaluate', () =>
      this.growth.afterSync(),
    );
  }
}
