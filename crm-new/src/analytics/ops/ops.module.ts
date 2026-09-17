import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OpsDashboardController } from './ops-dashboard.controller';
import { OpsStatusService } from './ops-status.service';

/** Операционная диагностика аналитики (этап 13). Только чтение Postgres. */
@Module({
  controllers: [OpsDashboardController],
  providers: [
    {
      provide: OpsStatusService,
      useFactory: (prisma: PrismaService) => new OpsStatusService(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [OpsStatusService],
})
export class OpsModule {}
