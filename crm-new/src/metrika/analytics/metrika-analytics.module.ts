import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { YandexMetrikaClient } from '../metrika-api.client';
import { MetrikaModule } from '../metrika.module';
import { metrikaAnalyticsSyncEnabledFromEnv } from '../metrika.config';
import { MetrikaAnalyticsSchedulerService } from './metrika-analytics-scheduler.service';
import { MetrikaAnalyticsSyncService } from './metrika-analytics-sync.service';
import { InMemoryLock, PgAdvisoryLock } from './metrika-sync-lock';
import { PrismaMetrikaSyncStore } from './metrika-sync-store';

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
      provide: MetrikaAnalyticsSchedulerService,
      inject: [MetrikaAnalyticsSyncService, YandexMetrikaClient],
      useFactory: (
        sync: MetrikaAnalyticsSyncService,
        client: YandexMetrikaClient,
      ) =>
        new MetrikaAnalyticsSchedulerService(sync, {
          enabled: metrikaAnalyticsSyncEnabledFromEnv(),
          configured: client.isConfigured(),
        }),
    },
  ],
})
export class MetrikaAnalyticsModule {}
