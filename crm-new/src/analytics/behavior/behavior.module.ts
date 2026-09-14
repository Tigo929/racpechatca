import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DASHBOARD_OPTIONS,
  dashboardEnabledFromEnv,
} from '../dashboard/analytics-dashboard.controller';
import { DashboardCache } from '../dashboard/dashboard-cache';
import { BehaviorDashboardController } from './behavior-dashboard.controller';
import { BehaviorMetricsService } from './behavior-metrics.service';

/**
 * Поведение и воронки (этап 10): сервис поверх локальных агрегатов Метрики
 * и read-only API под флагом дашборда. Флаг и кэш — свои экземпляры тех же
 * провайдеров, что у дашборда этапа 09 (один процесс, одна переменная окружения).
 */
@Module({
  controllers: [BehaviorDashboardController],
  providers: [
    {
      provide: BehaviorMetricsService,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new BehaviorMetricsService(prisma),
    },
    {
      provide: DASHBOARD_OPTIONS,
      useFactory: () => ({ enabled: dashboardEnabledFromEnv() }),
    },
    { provide: DashboardCache, useFactory: () => new DashboardCache() },
  ],
  exports: [BehaviorMetricsService],
})
export class BehaviorModule {}
