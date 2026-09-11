import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { YandexMetrikaClient } from '../metrika-api.client';
import { MetrikaModule } from '../metrika.module';
import { metrikaOrdersSyncEnabledFromEnv } from '../metrika.config';
import { MetrikaOrderOutboxService } from './metrika-order-outbox.service';
import { MetrikaOrderOutboxProcessorService } from './metrika-order-outbox-processor.service';

/**
 * Заказы CRM → Метрика (этап 06): очередь и её воркер.
 *
 * `MetrikaOrderOutboxService` экспортируется — его вызывают сервисы,
 * меняющие статус заказа, изнутри своих транзакций. Воркер наружу не
 * нужен: он живёт по расписанию и включается рубильником из окружения.
 */
@Module({
  imports: [MetrikaModule],
  providers: [
    MetrikaOrderOutboxService,
    {
      provide: MetrikaOrderOutboxProcessorService,
      inject: [PrismaService, YandexMetrikaClient],
      useFactory: (prisma: PrismaService, client: YandexMetrikaClient) =>
        new MetrikaOrderOutboxProcessorService(prisma, client, {
          syncEnabled: metrikaOrdersSyncEnabledFromEnv(),
        }),
    },
  ],
  exports: [MetrikaOrderOutboxService],
})
export class MetrikaOrdersModule {}
