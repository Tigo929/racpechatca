import { GUARDS_METADATA } from '@nestjs/common/constants';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import { OpsDashboardController } from './ops-dashboard.controller';
import { OpsStatusService } from './ops-status.service';

/**
 * Диагностика (этап 13, раздел 6): ADMIN-only, читает только Postgres и
 * окружение; сборка фактов из журналов; нет секретов в ответе; недоступная
 * база → честный DATABASE_UNAVAILABLE вместо исключения.
 */
const NOW = new Date('2026-09-17T12:00:00Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);

function fakePrisma(overrides: Partial<Record<string, unknown>> = {}) {
  const prisma = {
    $queryRaw: jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (/SELECT 1/.test(sql)) return Promise.resolve([{ '?column?': 1 }]);
      if (/_prisma_migrations/.test(sql))
        return Promise.resolve([
          {
            migration_name: '20260915130000_analytics_change_registry',
            finished_at: ago(1600),
            rolled_back_at: null,
          },
          {
            migration_name: '20260916120000_analytics_insights',
            finished_at: ago(600),
            rolled_back_at: null,
          },
        ]);
      return Promise.resolve([]);
    }),
    metrikaSyncRun: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          where.status === 'SUCCESS'
            ? { finishedAt: ago(20) }
            : {
                status: 'SUCCESS',
                trigger: 'scheduler:hourly',
                startedAt: ago(20),
                finishedAt: ago(20),
                lastError: null,
              },
        ),
      ),
      findMany: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(0)),
    },
    metrikaDailyTraffic: {
      findFirst: jest.fn(() =>
        Promise.resolve({ date: new Date('2026-09-17T00:00:00Z') }),
      ),
    },
    metrikaOrderOutbox: {
      groupBy: jest.fn(() =>
        Promise.resolve([
          { status: 'delivered', _count: { _all: 11 } },
          { status: 'skipped', _count: { _all: 43 } },
        ]),
      ),
      findFirst: jest.fn(({ where }: { where: { status: string } }) =>
        Promise.resolve(
          where.status === 'delivered' ? { processedAt: ago(500) } : null,
        ),
      ),
    },
    metrikaPeriodSnapshot: {
      count: jest.fn(() => Promise.resolve(39)),
      findFirst: jest.fn(() => Promise.resolve({ fetchedAt: ago(20) })),
    },
    analyticsChange: { count: jest.fn(() => Promise.resolve(1)) },
    analyticsChangeEvaluation: {
      findFirst: jest.fn(() => Promise.resolve({ evaluatedAt: ago(700) })),
    },
    analyticsInsightRun: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          where.status === 'RUNNING'
            ? null
            : {
                kind: 'hourly',
                status: 'SUCCESS',
                startedAt: ago(20),
                finishedAt: ago(20),
                errors: [],
              },
        ),
      ),
    },
    analyticsInsight: { count: jest.fn(() => Promise.resolve(8)) },
    ...overrides,
  };
  return prisma as unknown as PrismaService;
}

function migrationsDir(names: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'ops-migrations-'));
  for (const n of names) {
    mkdirSync(join(dir, n));
    writeFileSync(join(dir, n, 'migration.sql'), '-- test');
  }
  return dir;
}

const ENV = {
  YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED: 'true',
  YANDEX_METRIKA_ORDERS_SYNC_ENABLED: 'true',
  ANALYTICS_DASHBOARD_ENABLED: 'true',
  ANALYTICS_GROWTH_ENABLED: 'true',
  ANALYTICS_INSIGHTS_ENABLED: 'true',
  YANDEX_METRIKA_COUNTER_ID: '111569944',
  YANDEX_METRIKA_OAUTH_TOKEN: 'y0_test_token_never_printed_1234567890',
  BUILD_SHA: 'D8590E7C9E67',
} as NodeJS.ProcessEnv;

describe('OpsDashboardController / OpsStatusService', () => {
  it('защищён JwtAuthGuard + RolesGuard и открыт только ADMIN; флагов разделов не требует', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, OpsDashboardController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, OpsDashboardController)).toEqual([
      'ADMIN',
    ]);
  });

  it('собирает факты из журналов и окружения: build в нижнем регистре, миграции диск = база, состояния HEALTHY, секретов в ответе нет', async () => {
    const dir = migrationsDir([
      '20260915130000_analytics_change_registry',
      '20260916120000_analytics_insights',
    ]);
    try {
      const svc = new OpsStatusService(fakePrisma(), () => NOW, dir, ENV);
      const status = await new OpsDashboardController(svc).status();
      expect(status.build).toBe('d8590e7c9e67');
      expect(status.flags.metrikaConfigured).toBe(true);
      expect(status.database).toMatchObject({
        reachable: true,
        appliedMigrations: 2,
        pendingMigrations: [],
        unknownMigrations: [],
        lastMigration: '20260916120000_analytics_insights',
      });
      expect(status.subsystems.metrikaAnalyticsSync.state).toBe('HEALTHY');
      expect(status.subsystems.metrikaOrdersOutbox.state).toBe('HEALTHY');
      expect(status.outbox).toMatchObject({ delivered: 11, skipped: 43 });
      expect(status.insights.openCards).toBe(8);
      expect(status.sync.lastDataDay).toBe('2026-09-17');
      expect(status.conditions).toEqual([]);
      const json = JSON.stringify(status);
      expect(json).not.toMatch(/y0_test|111569944|OAUTH|DATABASE_URL/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('миграция на диске без строки в базе → pendingMigrations и DATABASE_MIGRATION_MISMATCH', async () => {
    const dir = migrationsDir([
      '20260915130000_analytics_change_registry',
      '20260916120000_analytics_insights',
      '20260920000000_retention_markers',
    ]);
    try {
      const svc = new OpsStatusService(fakePrisma(), () => NOW, dir, ENV);
      const status = await svc.status();
      expect(status.database.pendingMigrations).toEqual([
        '20260920000000_retention_markers',
      ]);
      expect(status.conditions[0].code).toBe('DATABASE_MIGRATION_MISMATCH');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('база недоступна → ответ с DATABASE_UNAVAILABLE, без исключения и без обращений к журналам', async () => {
    const prisma = fakePrisma({
      $queryRaw: jest.fn(() =>
        Promise.reject(new Error('connect ECONNREFUSED')),
      ),
    });
    const svc = new OpsStatusService(prisma, () => NOW, migrationsDir([]), ENV);
    const status = await svc.status();
    expect(status.subsystems.database.state).toBe('FAILED');
    expect(status.subsystems.crmBusiness.state).toBe('FAILED');
    expect(status.conditions[0].code).toBe('DATABASE_UNAVAILABLE');
    expect(
      (prisma as unknown as { metrikaSyncRun: { findFirst: jest.Mock } })
        .metrikaSyncRun.findFirst,
    ).not.toHaveBeenCalled();
  });
});
