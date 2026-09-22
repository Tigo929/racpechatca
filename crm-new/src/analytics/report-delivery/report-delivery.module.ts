import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReportsModule } from '../../reports/reports.module';
import { ReportsService } from '../../reports/reports.service';
import { AnalyticsMetricsModule } from '../metrics/analytics-metrics.module';
import { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import { AnalyticsReportController } from './analytics-report.controller';
import { AnalyticsReportService } from './analytics-report.service';
import { AnalyticsReportWorker } from './analytics-report.worker';

/**
 * Выдача аналитических отчётов (этап 16). Своей аналитики нет: сервис ведёт
 * очередь заказов, воркер зовёт генератор этапа 15, контроллер отдаёт файлы.
 */
@Module({
  imports: [ReportsModule, AnalyticsMetricsModule],
  controllers: [AnalyticsReportController],
  providers: [
    {
      provide: AnalyticsReportService,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new AnalyticsReportService(prisma),
    },
    {
      provide: AnalyticsReportWorker,
      inject: [
        PrismaService,
        AnalyticsReportService,
        AnalyticsMetricsService,
        ReportsService,
      ],
      useFactory: (
        prisma: PrismaService,
        reports: AnalyticsReportService,
        metrics: AnalyticsMetricsService,
        pnl: ReportsService,
      ) => new AnalyticsReportWorker(prisma, reports, metrics, pnl),
    },
  ],
  exports: [AnalyticsReportService],
})
export class ReportDeliveryModule {}
