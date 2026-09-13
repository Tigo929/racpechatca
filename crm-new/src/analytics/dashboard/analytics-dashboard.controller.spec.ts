import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import {
  AnalyticsDashboardController,
  dashboardEnabledFromEnv,
} from './analytics-dashboard.controller';
import { DashboardCache } from './dashboard-cache';
import { MAX_CUSTOM_DAYS, periodFromQuery } from './dashboard-period';

/**
 * API дашборда (этап 09, разделы 31–33, 44): только для администратора,
 * выключается флагом, период из пресета или дат, ответы кэшируются на
 * 45 секунд, формулы не пересчитываются — контроллер только зовёт сервис.
 */
const NOW = new Date('2026-09-13T10:00:00.000Z');

function fakeMetrics() {
  const calls: string[] = [];
  const stub = (name: string) =>
    jest.fn((period: { from: string; to: string }) => {
      calls.push(`${name}:${period.from}..${period.to}`);
      return Promise.resolve({ name, period });
    });
  const metrics = {
    getOverview: stub('overview'),
    getTrend: stub('trend'),
    getTrafficSources: stub('sources'),
    getUtm: stub('utm'),
    getLandings: stub('landings'),
    getDevices: stub('devices'),
    getProducts: stub('products'),
    getSalesChannels: stub('sales-channels'),
  } as unknown as AnalyticsMetricsService;
  return { metrics, calls };
}

describe('periodFromQuery', () => {
  it('пресет → период по московскому календарю; без параметров — 7 дней', () => {
    expect(periodFromQuery({ preset: 'last_30_days' }, NOW)).toMatchObject({
      from: '2026-08-15',
      to: '2026-09-13',
      preset: 'last_30_days',
    });
    expect(periodFromQuery({}, NOW)).toMatchObject({ preset: 'last_7_days' });
  });

  it('произвольные даты — customPeriod; месяц распознаётся', () => {
    expect(
      periodFromQuery({ from: '2026-08-01', to: '2026-08-31' }, NOW),
    ).toMatchObject({ kind: 'month', preset: null });
  });

  it('неверный пресет, кривые даты, перевёрнутый и слишком длинный период → 400', () => {
    expect(() => periodFromQuery({ preset: 'last_year' }, NOW)).toThrow(
      BadRequestException,
    );
    expect(() =>
      periodFromQuery({ from: '2026-13-01', to: '2026-09-01' }, NOW),
    ).toThrow(BadRequestException);
    expect(() =>
      periodFromQuery({ from: '2026-09-10', to: '2026-09-01' }, NOW),
    ).toThrow(BadRequestException);
    expect(() =>
      periodFromQuery({ from: '2025-01-01', to: '2026-09-01' }, NOW),
    ).toThrow(`${MAX_CUSTOM_DAYS}`);
  });
});

describe('AnalyticsDashboardController', () => {
  it('защищён JwtAuthGuard + RolesGuard и открыт только ADMIN', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AnalyticsDashboardController,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(
      Reflect.getMetadata(ROLES_KEY, AnalyticsDashboardController),
    ).toEqual(['ADMIN']);
  });

  it('status отдаёт флаг, пресеты и границы данных даже при выключенном разделе', () => {
    const { metrics } = fakeMetrics();
    const c = new AnalyticsDashboardController(
      metrics,
      { enabled: false },
      new DashboardCache(),
    );
    expect(c.status()).toMatchObject({
      enabled: false,
      timezone: 'Europe/Moscow',
      cutovers: {
        falseBrowserPurchaseStoppedAt: '2026-09-12 13:19:22 Europe/Moscow',
        counterDataSince: '2026-08-13',
      },
    });
    expect(c.status().presets).toContain('previous_month');
  });

  it('выключенный флаг → 404 на данных, сервис не вызывается', async () => {
    const { metrics, calls } = fakeMetrics();
    const c = new AnalyticsDashboardController(
      metrics,
      { enabled: false },
      new DashboardCache(),
    );
    await expect(c.overview({ preset: 'today' })).rejects.toThrow(
      NotFoundException,
    );
    expect(calls).toEqual([]);
  });

  it('каждый маршрут зовёт свой метод сервиса с разобранным периодом', async () => {
    const { metrics, calls } = fakeMetrics();
    const c = new AnalyticsDashboardController(
      metrics,
      { enabled: true },
      new DashboardCache(),
    );
    const q = { from: '2026-09-01', to: '2026-09-07' };
    await c.overview(q);
    await c.trend(q);
    await c.sources(q);
    await c.utm(q);
    await c.landings(q);
    await c.devices(q);
    await c.products(q);
    await c.salesChannels(q);
    expect(calls).toEqual([
      'overview:2026-09-01..2026-09-07',
      'trend:2026-09-01..2026-09-07',
      'sources:2026-09-01..2026-09-07',
      'utm:2026-09-01..2026-09-07',
      'landings:2026-09-01..2026-09-07',
      'devices:2026-09-01..2026-09-07',
      'products:2026-09-01..2026-09-07',
      'sales-channels:2026-09-01..2026-09-07',
    ]);
  });

  it('кэш: тот же период дважды — один вызов сервиса; другой период — новый; после TTL — снова', async () => {
    const { metrics, calls } = fakeMetrics();
    let t = 1_000_000;
    const cache = new DashboardCache(45_000, () => t);
    const c = new AnalyticsDashboardController(
      metrics,
      { enabled: true },
      cache,
    );
    await c.overview({ from: '2026-09-01', to: '2026-09-07' });
    await c.overview({ from: '2026-09-01', to: '2026-09-07' });
    expect(calls).toHaveLength(1);
    await c.overview({ from: '2026-09-01', to: '2026-09-08' });
    expect(calls).toHaveLength(2);
    t += 46_000;
    await c.overview({ from: '2026-09-01', to: '2026-09-07' });
    expect(calls).toHaveLength(3);
  });

  it('кэш не запоминает ошибку: следующий запрос пробует снова', async () => {
    let attempts = 0;
    const metrics = {
      getOverview: jest.fn(() => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('база недоступна'))
          : Promise.resolve({ ok: true });
      }),
    } as unknown as AnalyticsMetricsService;
    const c = new AnalyticsDashboardController(
      metrics,
      { enabled: true },
      new DashboardCache(),
    );
    await expect(c.overview({ preset: 'today' })).rejects.toThrow(
      'база недоступна',
    );
    await expect(c.overview({ preset: 'today' })).resolves.toEqual({
      ok: true,
    });
  });

  it('флаг из окружения: только true/1/yes/on', () => {
    expect(
      dashboardEnabledFromEnv({ ANALYTICS_DASHBOARD_ENABLED: 'true' }),
    ).toBe(true);
    expect(dashboardEnabledFromEnv({ ANALYTICS_DASHBOARD_ENABLED: 'on' })).toBe(
      true,
    );
    expect(
      dashboardEnabledFromEnv({ ANALYTICS_DASHBOARD_ENABLED: 'false' }),
    ).toBe(false);
    expect(dashboardEnabledFromEnv({})).toBe(false);
  });
});
