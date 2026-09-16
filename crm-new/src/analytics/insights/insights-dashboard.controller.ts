import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  DASHBOARD_OPTIONS,
  type DashboardOptions,
} from '../dashboard/analytics-dashboard.controller';
import { AnalyticsInsightsService } from './analytics-insights.service';
import { FeedQueryDto, ResolveInsightDto } from './dto/insight-action.dto';
import {
  AllowWhenDisabled,
  InsightsEnabledGuard,
} from './insights-enabled.guard';

/**
 * API «Инсайты» (этап 12, раздел 29): только ADMIN, два флага (дашборда и
 * свой), чтение — из материализованных строк Postgres, действия — acknowledge
 * и ручной resolve с причиной. Флаг проверяется guard'ом до валидации: при
 * выключенном разделе любой маршрут, кроме status, отвечает 404.
 */
@Controller('analytics/dashboard/insights')
@UseGuards(JwtAuthGuard, RolesGuard, InsightsEnabledGuard)
@Roles(EnumRole.ADMIN)
export class InsightsDashboardController {
  constructor(
    private readonly insights: AnalyticsInsightsService,
    @Inject(DASHBOARD_OPTIONS) private readonly options: DashboardOptions,
  ) {}

  @Get('status')
  @AllowWhenDisabled()
  status() {
    return this.insights.status(this.options.enabled);
  }

  @Get('feed')
  feed(@Query() q: FeedQueryDto) {
    return this.insights.feed(q);
  }

  @Get('quality')
  quality() {
    return this.insights.quality();
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.insights.get(id);
  }

  @Get(':id/versions')
  versions(@Param('id') id: string) {
    return this.insights.versions(id);
  }

  @Post(':id/acknowledge')
  @HttpCode(200)
  acknowledge(@Param('id') id: string) {
    return this.insights.acknowledge(id);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  resolve(@Param('id') id: string, @Body() dto: ResolveInsightDto) {
    return this.insights.resolve(id, dto.reason);
  }

  /** Ручной запуск движка (ADMIN) — тот же код, что и хук расписания; для проверки и сверки. */
  @Post('run')
  @HttpCode(200)
  run() {
    return this.insights.run('manual');
  }
}
