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
import { BehaviorMetricsService } from './behavior-metrics.service';
import {
  BEHAVIOR_GOALS_AVAILABLE_FROM,
  DIRECTION_GOALS_AVAILABLE_FROM,
  MIN_SAMPLE_VISITS,
  THRESHOLDS,
} from './behavior-rules';

/**
 * Read-only API поведения (этап 10, раздел 17) под тем же префиксом, что и
 * дашборд этапа 09: те же guards (только ADMIN), тот же флаг
 * ANALYTICS_DASHBOARD_ENABLED (выключен → 404), тот же кэш и разбор
 * периода. Ни одной формулы: контроллер зовёт BehaviorMetricsService.
 * К API Метрики не обращается — только локальные таблицы.
 */
@Controller('analytics/dashboard/behavior')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class BehaviorDashboardController {
  constructor(
    private readonly behavior: BehaviorMetricsService,
    @Inject(DASHBOARD_OPTIONS) private readonly options: DashboardOptions,
    private readonly cache: DashboardCache,
  ) {}

  /** Границы данных и пороги правил — панель показывает их в подсказках. */
  @Get('status')
  status() {
    return {
      enabled: this.options.enabled,
      behaviorGoalsAvailableFrom: BEHAVIOR_GOALS_AVAILABLE_FROM,
      directionGoalsAvailableFrom: DIRECTION_GOALS_AVAILABLE_FROM,
      minSampleVisits: MIN_SAMPLE_VISITS,
      thresholds: THRESHOLDS,
    };
  }

  @Get('summary')
  summary(@Query() q: PeriodQuery) {
    return this.cached('behavior-summary', q, (p) =>
      this.behavior.getSummary(p),
    );
  }

  @Get('funnels')
  funnels(@Query() q: PeriodQuery) {
    return this.cached('behavior-funnels', q, (p) =>
      this.behavior.getFunnels(p),
    );
  }

  @Get('errors')
  errors(@Query() q: PeriodQuery) {
    return this.cached('behavior-errors', q, (p) => this.behavior.getErrors(p));
  }

  @Get('pages')
  pages(@Query() q: PeriodQuery) {
    return this.cached('behavior-pages', q, (p) => this.behavior.getPages(p));
  }

  @Get('devices')
  devices(@Query() q: PeriodQuery) {
    return this.cached('behavior-devices', q, (p) =>
      this.behavior.getDevices(p),
    );
  }

  @Get('paths')
  paths(@Query() q: PeriodQuery) {
    return this.cached('behavior-paths', q, (p) => this.behavior.getPaths(p));
  }

  @Get('issues')
  issues(@Query() q: PeriodQuery) {
    return this.cached('behavior-issues', q, (p) => this.behavior.getIssues(p));
  }

  private cached<T>(
    kind: string,
    q: PeriodQuery,
    compute: (period: ReturnType<typeof periodFromQuery>) => Promise<T>,
  ): Promise<T> {
    if (!this.options.enabled) {
      return Promise.reject(new NotFoundException('Раздел аналитики выключен'));
    }
    const period = periodFromQuery(q);
    return this.cache.getOrCompute(
      `${kind}:${period.from}:${period.to}:${period.kind}`,
      () => compute(period),
    );
  }
}
