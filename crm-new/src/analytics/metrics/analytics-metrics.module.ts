import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReportsModule } from '../../reports/reports.module';
import { ReportsService } from '../../reports/reports.service';
import { AnalyticsMetricsService } from './analytics-metrics.service';

/**
 * Канонические метрики (этап 08). Контроллеров нет: интерфейс появится на
 * этапе 09 и будет читать этот сервис, а не считать формулы заново.
 */
@Module({
  imports: [ReportsModule],
  providers: [
    {
      provide: AnalyticsMetricsService,
      inject: [PrismaService, ReportsService],
      useFactory: (prisma: PrismaService, reports: ReportsService) =>
        new AnalyticsMetricsService(prisma, reports),
    },
  ],
  exports: [AnalyticsMetricsService],
})
export class AnalyticsMetricsModule {}
