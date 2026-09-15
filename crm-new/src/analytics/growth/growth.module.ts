import { Inject, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MetrikaAnalyticsModule } from '../../metrika/analytics/metrika-analytics.module';
import { MetrikaAnalyticsSchedulerService } from '../../metrika/analytics/metrika-analytics-scheduler.service';
import { MetrikaPeriodSnapshotService } from '../../metrika/analytics/metrika-period-snapshot.service';
import { BehaviorMetricsService } from '../behavior/behavior-metrics.service';
import { BehaviorModule } from '../behavior/behavior.module';
import {
  DASHBOARD_OPTIONS,
  type DashboardOptions,
} from '../dashboard/analytics-dashboard.controller';
import { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import { AnalyticsMetricsModule } from '../metrics/analytics-metrics.module';
import { AnalyticsGrowthService } from './analytics-growth.service';
import { GrowthDashboardController } from './growth-dashboard.controller';
import { GROWTH_ENABLED_ENV, growthOptionsFromEnv } from './growth-flags';

/**
 * Рост и изменения (этап 11): реестр изменений, оценки «до / после» и API под
 * двумя флагами — общим флагом дашборда и своим ANALYTICS_GROWTH_ENABLED
 * (growth-flags.ts). Автооценка и точные снимки окон подключаются к расписанию
 * этапа 07 хуком после тика — модуль расписания о росте не знает, цикла нет;
 * при выключенном разделе хук не регистрируется вовсе.
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
      useFactory: () => growthOptionsFromEnv(),
    },
  ],
  exports: [AnalyticsGrowthService],
})
export class GrowthModule implements OnModuleInit {
  private readonly logger = new Logger(GrowthModule.name);

  constructor(
    private readonly scheduler: MetrikaAnalyticsSchedulerService,
    private readonly growth: AnalyticsGrowthService,
    @Inject(DASHBOARD_OPTIONS) private readonly options: DashboardOptions,
  ) {}

  onModuleInit() {
    if (!this.options.enabled) {
      this.logger.log(
        `Раздел «Рост / Изменения» выключен (${GROWTH_ENABLED_ENV}): хук расписания не подключён`,
      );
      return;
    }
    this.scheduler.registerAfterSync('growth:evaluate', () =>
      this.growth.afterSync(),
    );
    this.logger.log(
      'Раздел «Рост / Изменения» включён: хук расписания подключён',
    );
  }
}
