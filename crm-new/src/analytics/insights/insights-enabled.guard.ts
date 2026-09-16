import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DASHBOARD_OPTIONS,
  type DashboardOptions,
} from '../dashboard/analytics-dashboard.controller';

export const ALLOW_WHEN_DISABLED = 'insights:allowWhenDisabled';
/** Маршрут доступен и при выключенном разделе (только status). */
export const AllowWhenDisabled = () => SetMetadata(ALLOW_WHEN_DISABLED, true);

/**
 * Проверка флага раздела до пайпов: guards в Nest выполняются раньше
 * ValidationPipe, поэтому при выключенном разделе любой запрос данных —
 * даже с невалидным телом — получает 404, а не 400 (урок § 9.5 этапа 11).
 */
@Injectable()
export class InsightsEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DASHBOARD_OPTIONS) private readonly options: DashboardOptions,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.options.enabled) return true;
    const allow = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WHEN_DISABLED,
      [context.getHandler(), context.getClass()],
    );
    if (allow) return true;
    throw new NotFoundException('Раздел аналитики выключен');
  }
}
