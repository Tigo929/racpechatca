import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
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
import { AnalyticsGrowthService } from './analytics-growth.service';
import { CreateChangeDto, UpdateChangeDto } from './dto/change.dto';

/**
 * API «Рост и изменения» (этап 11, раздел 20) под префиксом дашборда: те же
 * guards (только ADMIN) и тот же флаг ANALYTICS_DASHBOARD_ENABLED (выключен →
 * 404 на всё, кроме /status). Чтение и запись реестра — только ADMIN; публичных
 * маршрутов нет. Оценка — по явному POST или из хука расписания; при чтении к
 * API Метрики никто не обращается. Списки не кэшируются: реестр маленький, а
 * после правки администратор должен видеть её сразу.
 */
@Controller('analytics/dashboard/growth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class GrowthDashboardController {
  constructor(
    private readonly growth: AnalyticsGrowthService,
    @Inject(DASHBOARD_OPTIONS) private readonly options: DashboardOptions,
  ) {}

  @Get('status')
  status() {
    return this.growth.status(this.options.enabled);
  }

  @Get('changes')
  list() {
    this.assertEnabled();
    return this.growth.listChanges();
  }

  @Get('changes/:id')
  one(@Param('id') id: string) {
    this.assertEnabled();
    return this.growth.getChange(id);
  }

  @Post('changes')
  create(@Body() dto: CreateChangeDto) {
    this.assertEnabled();
    return this.growth.createChange(dto);
  }

  @Patch('changes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateChangeDto) {
    this.assertEnabled();
    return this.growth.updateChange(id, dto);
  }

  @Post('changes/:id/evaluate')
  @HttpCode(200)
  evaluate(@Param('id') id: string) {
    this.assertEnabled();
    return this.growth.evaluate(id, 'manual');
  }

  @Get('changes/:id/evaluations')
  evaluations(@Param('id') id: string) {
    this.assertEnabled();
    return this.growth.listEvaluations(id);
  }

  @Get('changes/:id/evaluations/latest')
  latest(@Param('id') id: string) {
    this.assertEnabled();
    return this.growth.getEvaluation(id);
  }

  @Get('changes/:id/evaluations/:version')
  version(@Param('id') id: string, @Param('version') version: string) {
    this.assertEnabled();
    const v = Number(version);
    if (!Number.isInteger(v) || v < 1)
      throw new NotFoundException('Версия оценки не найдена');
    return this.growth.getEvaluation(id, v);
  }

  private assertEnabled() {
    if (!this.options.enabled)
      throw new NotFoundException('Раздел аналитики выключен');
  }
}
