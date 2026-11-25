import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  DASHBOARD_OPTIONS,
  type DashboardOptions,
} from '../dashboard/analytics-dashboard.controller';
import { DashboardCache } from '../dashboard/dashboard-cache';
import {
  periodFromQuery,
  type PeriodQuery,
} from '../dashboard/dashboard-period';
import { AdPerformanceService } from './ad-performance.service';

/** Экран «Реклама»: только чтение, только администратор, тот же флаг и кэш, что у дашборда. */
@Controller('analytics/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class AdPerformanceController {
  constructor(
    private readonly service: AdPerformanceService,
    @Inject(DASHBOARD_OPTIONS) private readonly options: DashboardOptions,
    private readonly cache: DashboardCache,
  ) {}

  @Get('ads')
  ads(@Query() q: PeriodQuery) {
    if (!this.options.enabled) {
      throw new NotFoundException('Раздел аналитики выключен');
    }
    const p = periodFromQuery(q);
    return this.cache.getOrCompute(`ads:${p.from}:${p.to}`, () =>
      this.service.get(p),
    );
  }
}
