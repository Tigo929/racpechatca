import { Controller, Get, UseGuards } from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { OpsStatus } from './ops-contract';
import { OpsStatusService } from './ops-status.service';

/**
 * Операционная диагностика аналитики (этап 13, раздел 6): состояния подсистем,
 * условия для оператора, возраст данных, зависшие запуски, очередь заказов.
 * Только ADMIN; не зависит от флагов разделов — диагностика нужна как раз
 * тогда, когда что-то выключено или сломано. Без секретов, без PII, без
 * обращений к Метрике.
 */
@Controller('analytics/ops')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class OpsDashboardController {
  constructor(private readonly ops: OpsStatusService) {}

  @Get('status')
  status(): Promise<OpsStatus> {
    return this.ops.status();
  }
}
