import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { DashboardCache } from '../dashboard/dashboard-cache';
import { BehaviorDashboardController } from './behavior-dashboard.controller';
import type { BehaviorMetricsService } from './behavior-metrics.service';

/**
 * API поведения (этап 10, раздел 17): те же правила, что у дашборда —
 * ADMIN only, флаг, разбор периода, кэш; контроллер не считает ничего сам.
 */
function fakeService() {
  const calls: string[] = [];
  const stub = (name: string) =>
    jest.fn((period: { from: string; to: string }) => {
      calls.push(`${name}:${period.from}..${period.to}`);
      return Promise.resolve({ name, period });
    });
  const service = {
    getSummary: stub('summary'),
    getFunnels: stub('funnels'),
    getErrors: stub('errors'),
    getPages: stub('pages'),
    getDevices: stub('devices'),
    getPaths: stub('paths'),
    getIssues: stub('issues'),
  } as unknown as BehaviorMetricsService;
  return { service, calls };
}

describe('BehaviorDashboardController', () => {
  it('защищён JwtAuthGuard + RolesGuard и открыт только ADMIN', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      BehaviorDashboardController,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, BehaviorDashboardController)).toEqual(
      ['ADMIN'],
    );
  });

  it('status отдаёт флаг, даты доступности и пороги правил даже при выключенном разделе', () => {
    const { service } = fakeService();
    const c = new BehaviorDashboardController(
      service,
      { enabled: false },
      new DashboardCache(),
    );
    expect(c.status()).toMatchObject({
      enabled: false,
      behaviorGoalsAvailableFrom: '2026-09-10',
      directionGoalsAvailableFrom: '2026-09-12',
      minSampleVisits: 30,
    });
    expect(c.status().thresholds.deviceGapAttentionRatio).toBe(0.5);
  });

  it('выключенный флаг → 404, сервис не вызывается', async () => {
    const { service, calls } = fakeService();
    const c = new BehaviorDashboardController(
      service,
      { enabled: false },
      new DashboardCache(),
    );
    await expect(c.summary({ preset: 'today' })).rejects.toThrow(
      NotFoundException,
    );
    await expect(c.issues({ preset: 'today' })).rejects.toThrow(
      NotFoundException,
    );
    expect(calls).toEqual([]);
  });

  it('каждый маршрут зовёт свой метод сервиса с разобранным периодом', async () => {
    const { service, calls } = fakeService();
    const c = new BehaviorDashboardController(
      service,
      { enabled: true },
      new DashboardCache(),
    );
    const q = { from: '2026-09-10', to: '2026-09-16' };
    await c.summary(q);
    await c.funnels(q);
    await c.errors(q);
    await c.pages(q);
    await c.devices(q);
    await c.paths(q);
    await c.issues(q);
    expect(calls).toEqual([
      'summary:2026-09-10..2026-09-16',
      'funnels:2026-09-10..2026-09-16',
      'errors:2026-09-10..2026-09-16',
      'pages:2026-09-10..2026-09-16',
      'devices:2026-09-10..2026-09-16',
      'paths:2026-09-10..2026-09-16',
      'issues:2026-09-10..2026-09-16',
    ]);
  });

  it('неверный пресет и слишком длинный период → 400 до вызова сервиса', () => {
    const { service, calls } = fakeService();
    const c = new BehaviorDashboardController(
      service,
      { enabled: true },
      new DashboardCache(),
    );
    // Разбор периода — синхронный: Nest превращает исключение в 400 так же, как отказ промиса.
    expect(() => c.summary({ preset: 'last_year' })).toThrow(
      BadRequestException,
    );
    expect(() => c.summary({ from: '2025-01-01', to: '2026-09-14' })).toThrow(
      BadRequestException,
    );
    expect(calls).toEqual([]);
  });

  it('кэш: тот же период — один вызов; ключи поведения не пересекаются с ключами дашборда', async () => {
    const { service, calls } = fakeService();
    const cache = new DashboardCache();
    const c = new BehaviorDashboardController(
      service,
      { enabled: true },
      cache,
    );
    await c.summary({ preset: 'last_7_days' });
    await c.summary({ preset: 'last_7_days' });
    await c.funnels({ preset: 'last_7_days' });
    expect(calls).toHaveLength(2);
    expect(cache.size).toBe(2);
  });
});
