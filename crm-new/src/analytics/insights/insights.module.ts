import { Inject, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MetrikaAnalyticsModule } from '../../metrika/analytics/metrika-analytics.module';
import { MetrikaAnalyticsSchedulerService } from '../../metrika/analytics/metrika-analytics-scheduler.service';
import { BehaviorMetricsService } from '../behavior/behavior-metrics.service';
import { BehaviorModule } from '../behavior/behavior.module';
import {
  DASHBOARD_OPTIONS,
  type DashboardOptions,
} from '../dashboard/analytics-dashboard.controller';
import { AnalyticsGrowthService } from '../growth/analytics-growth.service';
import { GrowthModule } from '../growth/growth.module';
import { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import { AnalyticsMetricsModule } from '../metrics/analytics-metrics.module';
import { AnalyticsInsightsService } from './analytics-insights.service';
import { InsightsDashboardController } from './insights-dashboard.controller';
import { InsightsEnabledGuard } from './insights-enabled.guard';
import { INSIGHTS_ENABLED_ENV, insightsOptionsFromEnv } from './insights-flags';

/**
 * Инсайты (этап 12): детерминированные сигналы поверх сервисов этапов 08/10/11.
 * Движок запускается хуком после тика расписания этапа 07 (полный запуск при
 * новом полном дне, лёгкий — каждый час); при выключенном флаге хук не
 * регистрируется, а API отвечает 404 (кроме status). Ошибка движка изолирована
 * планировщиком и журналом запусков — синхронизацию, воркер и CRM не ломает.
 */
@Module({
  imports: [
    AnalyticsMetricsModule,
    BehaviorModule,
    GrowthModule,
    MetrikaAnalyticsModule,
  ],
  controllers: [InsightsDashboardController],
  providers: [
    {
      provide: AnalyticsInsightsService,
      inject: [
        PrismaService,
        AnalyticsMetricsService,
        BehaviorMetricsService,
        AnalyticsGrowthService,
      ],
      useFactory: (
        prisma: PrismaService,
        metrics: AnalyticsMetricsService,
        behavior: BehaviorMetricsService,
        growth: AnalyticsGrowthService,
      ) => new AnalyticsInsightsService({ prisma, metrics, behavior, growth }),
    },
    { provide: DASHBOARD_OPTIONS, useFactory: () => insightsOptionsFromEnv() },
    InsightsEnabledGuard,
  ],
  exports: [AnalyticsInsightsService],
})
export class InsightsModule implements OnModuleInit {
  private readonly logger = new Logger(InsightsModule.name);

  constructor(
    private readonly scheduler: MetrikaAnalyticsSchedulerService,
    private readonly insights: AnalyticsInsightsService,
    @Inject(DASHBOARD_OPTIONS) private readonly options: DashboardOptions,
  ) {}

  onModuleInit() {
    if (!this.options.enabled) {
      this.logger.log(
        `Раздел «Инсайты» выключен (${INSIGHTS_ENABLED_ENV}): хук расписания не подключён`,
      );
      return;
    }
    this.scheduler.registerAfterSync('insights:run', async () => {
      await this.insights.afterSync();
    });
    this.logger.log('Раздел «Инсайты» включён: хук расписания подключён');
  }
}
