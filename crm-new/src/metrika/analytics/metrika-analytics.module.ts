import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { YandexMetrikaClient } from '../metrika-api.client';
import { MetrikaModule } from '../metrika.module';
import { metrikaAnalyticsSyncEnabledFromEnv } from '../metrika.config';
import { MetrikaAnalyticsSchedulerService } from './metrika-analytics-scheduler.service';
import { MetrikaAnalyticsSyncService } from './metrika-analytics-sync.service';
import { MetrikaPeriodSnapshotService } from './metrika-period-snapshot.service';
import { InMemoryLock, PgAdvisoryLock } from './metrika-sync-lock';
import { PrismaMetrikaSyncStore } from './metrika-sync-store';
import {
  DirectSpendSync,
  directSpendConfig,
} from '../../analytics/ads/direct-spend-sync';
import { rollingWindow } from './metrika-dates';

/**
 * Метрика → локальная аналитика (этап 07): сервис синхронизации отчётов
 * и его расписание. Наружу ничего не экспортируется: читать таблицы
 * будут следующие этапы (метрики, дашборд) напрямую через Prisma.
 */
@Module({
  imports: [MetrikaModule],
  providers: [
    {
      provide: MetrikaAnalyticsSyncService,
      inject: [PrismaService, YandexMetrikaClient],
      useFactory: (prisma: PrismaService, client: YandexMetrikaClient) => {
        const url = process.env.DATABASE_URL;
        return new MetrikaAnalyticsSyncService(
          new PrismaMetrikaSyncStore(prisma),
          client,
          url ? new PgAdvisoryLock(url) : new InMemoryLock(),
        );
      },
    },
    {
      provide: MetrikaPeriodSnapshotService,
      inject: [PrismaService, YandexMetrikaClient],
      useFactory: (prisma: PrismaService, client: YandexMetrikaClient) =>
        new MetrikaPeriodSnapshotService(prisma, client),
    },
    {
      provide: MetrikaAnalyticsSchedulerService,
      inject: [
        MetrikaAnalyticsSyncService,
        YandexMetrikaClient,
        MetrikaPeriodSnapshotService,
        PrismaService,
      ],
      useFactory: (
        sync: MetrikaAnalyticsSyncService,
        client: YandexMetrikaClient,
        snapshots: MetrikaPeriodSnapshotService,
        prisma: PrismaService,
      ) => {
        const scheduler = new MetrikaAnalyticsSchedulerService(
          sync,
          {
            enabled: metrikaAnalyticsSyncEnabledFromEnv(),
            configured: client.isConfigured(),
          },
          () => new Date(),
          snapshots,
        );
        const directConfig = directSpendConfig();
        if (directConfig && process.env.DATABASE_URL) {
          const direct = new DirectSpendSync(
            prisma,
            client,
            new PgAdvisoryLock(process.env.DATABASE_URL, 700_702),
            directConfig,
          );
          scheduler.registerAfterSync('direct-spend', () =>
            direct.sync(rollingWindow(35, new Date())),
          );
        }
        return scheduler;
      },
    },
  ],
  exports: [MetrikaPeriodSnapshotService, MetrikaAnalyticsSchedulerService],
})
export class MetrikaAnalyticsModule {}
