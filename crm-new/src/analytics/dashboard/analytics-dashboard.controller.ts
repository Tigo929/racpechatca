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
import { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import {
  COUNTER_DATA_SINCE,
  CRM_TO_METRIKA_LIVE_SINCE,
  FALSE_BROWSER_PURCHASE_STOPPED_AT,
  LEAD_GOAL_SEMANTICS_CHANGED_AT,
} from '../metrics/analytics-constants';
import { PERIOD_PRESETS } from '../metrics/analytics-period';
import { DashboardCache } from './dashboard-cache';
import { periodFromQuery, type PeriodQuery } from './dashboard-period';

/**
 * Read-only API дашборда руководителя (этап 09, разделы 31–33).
 *
 * Тонкая обёртка над AnalyticsMetricsService: ни одной формулы здесь нет,
 * контракт ответа — тот же metrics-contract. Только чтение, только
 * администратор; раздел целиком выключается флагом
 * ANALYTICS_DASHBOARD_ENABLED — тогда всё, кроме /status, отвечает 404,
 * а панель прячет пункт меню.
 */

export interface DashboardOptions {
  enabled: boolean;
}

/** Токен настроек дашборда для DI (интерфейс сам по себе в рантайме не существует). */
export const DASHBOARD_OPTIONS = 'ANALYTICS_DASHBOARD_OPTIONS';

export function dashboardEnabledFromEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = (env.ANALYTICS_DASHBOARD_ENABLED ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

@Controller('analytics/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class AnalyticsDashboardController {
  constructor(
    private readonly metrics: AnalyticsMetricsService,
    @Inject(DASHBOARD_OPTIONS) private readonly options: DashboardOptions,
    private readonly cache: DashboardCache,
  ) {}

  /** Включён ли раздел и что он умеет — панель читает это первым. */
  @Get('status')
  status() {
    return {
      enabled: this.options.enabled,
      presets: PERIOD_PRESETS,
      timezone: 'Europe/Moscow',
      cutovers: {
        falseBrowserPurchaseStoppedAt: FALSE_BROWSER_PURCHASE_STOPPED_AT,
        leadGoalSemanticsChangedAt: LEAD_GOAL_SEMANTICS_CHANGED_AT,
        crmToMetrikaLiveSince: CRM_TO_METRIKA_LIVE_SINCE,
        counterDataSince: COUNTER_DATA_SINCE,
      },
    };
  }

  @Get('overview')
  overview(@Query() q: PeriodQuery) {
    return this.cached('overview', q, (p) => this.metrics.getOverview(p));
  }

  @Get('trend')
  trend(@Query() q: PeriodQuery) {
    return this.cached('trend', q, (p) => this.metrics.getTrend(p));
  }

  @Get('sources')
  sources(@Query() q: PeriodQuery) {
    return this.cached('sources', q, (p) => this.metrics.getTrafficSources(p));
  }

  @Get('utm')
  utm(@Query() q: PeriodQuery) {
    return this.cached('utm', q, (p) => this.metrics.getUtm(p));
  }

  @Get('landings')
  landings(@Query() q: PeriodQuery) {
    return this.cached('landings', q, (p) => this.metrics.getLandings(p));
  }

  @Get('devices')
  devices(@Query() q: PeriodQuery) {
    return this.cached('devices', q, (p) => this.metrics.getDevices(p));
  }

  @Get('products')
  products(@Query() q: PeriodQuery) {
    return this.cached('products', q, (p) => this.metrics.getProducts(p));
  }

  @Get('sales-channels')
  salesChannels(@Query() q: PeriodQuery) {
    return this.cached('sales-channels', q, (p) =>
      this.metrics.getSalesChannels(p),
    );
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
