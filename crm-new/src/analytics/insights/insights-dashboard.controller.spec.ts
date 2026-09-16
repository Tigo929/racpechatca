import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AnalyticsInsightsService } from './analytics-insights.service';
import { FeedQueryDto, ResolveInsightDto } from './dto/insight-action.dto';
import { InsightsDashboardController } from './insights-dashboard.controller';
import { InsightsEnabledGuard } from './insights-enabled.guard';
import {
  insightsEnabledFromEnv,
  insightsOptionsFromEnv,
} from './insights-flags';

/**
 * API «Инсайты» (раздел 29): ADMIN only, флаг проверяется guard'ом ДО валидации
 * (при OFF — 404 даже на невалидное тело, status доступен), DTO whitelist без PII,
 * контроллер ничего не считает сам.
 */
function fakeService() {
  const calls: string[] = [];
  const stub = (name: string) =>
    jest.fn((...args: unknown[]) => {
      calls.push(
        `${name}:${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(',')}`,
      );
      return Promise.resolve({ name });
    });
  const service = {
    status: stub('status'),
    feed: stub('feed'),
    quality: stub('quality'),
    get: stub('get'),
    versions: stub('versions'),
    acknowledge: stub('acknowledge'),
    resolve: stub('resolve'),
    run: stub('run'),
  } as unknown as AnalyticsInsightsService;
  return { service, calls };
}

function execContext(
  handler: (...args: unknown[]) => unknown,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => InsightsDashboardController,
  } as unknown as ExecutionContext;
}

describe('InsightsDashboardController', () => {
  it('защищён JwtAuthGuard + RolesGuard + InsightsEnabledGuard и открыт только ADMIN', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, InsightsDashboardController),
    ).toEqual([JwtAuthGuard, RolesGuard, InsightsEnabledGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, InsightsDashboardController)).toEqual(
      ['ADMIN'],
    );
  });

  it('J3: флаг OFF — guard даёт 404 на все маршруты данных до валидации, status проходит', () => {
    const guard = new InsightsEnabledGuard(new Reflector(), { enabled: false });
    const proto = InsightsDashboardController.prototype as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    expect(guard.canActivate(execContext(proto.status))).toBe(true);
    for (const h of [
      'feed',
      'quality',
      'one',
      'versions',
      'acknowledge',
      'resolve',
      'run',
    ])
      expect(() => guard.canActivate(execContext(proto[h]))).toThrow(
        NotFoundException,
      );
    const on = new InsightsEnabledGuard(new Reflector(), { enabled: true });
    expect(on.canActivate(execContext(proto.resolve))).toBe(true);
  });

  it('status при OFF возвращает enabled: false через сервис; при ON маршруты делегируют сервису', async () => {
    const { service, calls } = fakeService();
    const off = new InsightsDashboardController(service, { enabled: false });
    await off.status();
    expect(calls).toEqual(['status:false']);
    const on = new InsightsDashboardController(service, { enabled: true });
    await on.feed({ status: 'active', severity: 'ATTENTION' });
    await on.one('i1');
    await on.versions('i1');
    await on.acknowledge('i1');
    await on.resolve('i1', { reason: 'проверено вручную' });
    await on.run();
    expect(calls.slice(1)).toEqual([
      'feed:{"status":"active","severity":"ATTENTION"}',
      'get:i1',
      'versions:i1',
      'acknowledge:i1',
      'resolve:i1,проверено вручную',
      'run:manual',
    ]);
  });

  it('J4: DTO — лишние и PII-поля отвергаются whitelist, причина resolve обязательна, фильтры только из словарей', async () => {
    const bad = plainToInstance(ResolveInsightDto, {
      reason: 'проверено',
      customerPhone: '+79990000000',
    });
    const errors = await validate(bad, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toEqual(['customerPhone']);
    const short = await validate(
      plainToInstance(ResolveInsightDto, { reason: 'x' }),
    );
    expect(short[0].property).toBe('reason');
    const q = await validate(
      plainToInstance(FeedQueryDto, {
        status: 'weird',
        severity: 'HIGH',
        category: 'X',
        limit: '500',
      }),
    );
    expect(q.map((e) => e.property).sort()).toEqual([
      'category',
      'limit',
      'severity',
      'status',
    ]);
    const okq = await validate(
      plainToInstance(FeedQueryDto, {
        status: 'all',
        severity: 'INFO',
        category: 'DATA_QUALITY',
        limit: '50',
      }),
    );
    expect(okq).toEqual([]);
  });

  it('флаги: ANALYTICS_INSIGHTS_ENABLED разбирается как true/1/yes/on; раздел включён только при обоих флагах', () => {
    for (const v of ['true', '1', 'yes', 'on'])
      expect(insightsEnabledFromEnv({ ANALYTICS_INSIGHTS_ENABLED: v })).toBe(
        true,
      );
    for (const v of ['false', '0', '', undefined])
      expect(insightsEnabledFromEnv({ ANALYTICS_INSIGHTS_ENABLED: v })).toBe(
        false,
      );
    expect(
      insightsOptionsFromEnv({ ANALYTICS_DASHBOARD_ENABLED: 'true' }),
    ).toEqual({ enabled: false });
    expect(
      insightsOptionsFromEnv({ ANALYTICS_INSIGHTS_ENABLED: 'true' }),
    ).toEqual({ enabled: false });
    expect(
      insightsOptionsFromEnv({
        ANALYTICS_DASHBOARD_ENABLED: 'true',
        ANALYTICS_INSIGHTS_ENABLED: 'true',
      }),
    ).toEqual({ enabled: true });
  });
});
