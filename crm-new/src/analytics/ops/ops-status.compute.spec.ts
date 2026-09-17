import type { OpsInput } from './ops-contract';
import {
  computeOpsStatus,
  OPS_THRESHOLDS,
  sanitizeError,
} from './ops-status.compute';

/**
 * Операционная диагностика (этап 13, разделы 5–6, 21): словарь состояний,
 * детерминированные условия и пороги; отказ Метрики не делает CRM нездоровым;
 * в ответе нет ничего похожего на секрет.
 */
const NOW = new Date('2026-09-17T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

function healthyInput(): OpsInput {
  return {
    build: 'd8590e7c9e67',
    flags: {
      analyticsSyncEnabled: true,
      ordersSyncEnabled: true,
      dashboardEnabled: true,
      growthEnabled: true,
      insightsEnabled: true,
      metrikaConfigured: true,
    },
    database: {
      reachable: true,
      pendingMigrations: [],
      unknownMigrations: [],
      rolledBackMigrations: 0,
      appliedMigrations: 83,
      lastMigration: '20260916120000_analytics_insights',
    },
    sync: {
      lastSuccessAt: minutesAgo(27),
      lastRun: {
        status: 'SUCCESS',
        trigger: 'scheduler:hourly',
        startedAt: minutesAgo(27),
        finishedAt: minutesAgo(27),
        lastError: null,
      },
      runningCount: 0,
      oldestRunningStartedAt: null,
      failedLast24h: 0,
      lastDataDay: '2026-09-17',
    },
    outbox: {
      pending: 0,
      processing: 0,
      failed: 0,
      delivered: 11,
      skipped: 43,
      oldestPendingAt: null,
      oldestFailedAt: null,
      oldestProcessingLockedAt: null,
      lastDeliveredAt: minutesAgo(600),
    },
    snapshots: { count: 39, lastFetchedAt: minutesAgo(27) },
    growth: { activeChanges: 1, lastScheduledEvaluationAt: minutesAgo(700) },
    insights: {
      lastRun: {
        kind: 'hourly',
        status: 'SUCCESS',
        startedAt: minutesAgo(27),
        finishedAt: minutesAgo(27),
        errors: [],
      },
      lastSuccessAt: minutesAgo(27),
      oldestRunningStartedAt: null,
      openCards: 8,
    },
  };
}

describe('computeOpsStatus', () => {
  it('здоровая система: все подсистемы HEALTHY, условий нет, пороги отданы', () => {
    const s = computeOpsStatus(healthyInput(), NOW);
    expect(s.conditions).toEqual([]);
    for (const key of Object.keys(s.subsystems))
      expect(s.subsystems[key as keyof typeof s.subsystems].state).toBe(
        'HEALTHY',
      );
    expect(s.thresholds).toEqual({ ...OPS_THRESHOLDS });
    expect(s.timezone).toBe('Europe/Moscow');
    expect(s.build).toBe('d8590e7c9e67');
    expect(s.sync.dataAgeSeconds).toBe(27 * 60);
  });

  it('BUSINESS_PATH > ANALYTICS_PATH: отказ Метрики (401) → metrikaApi FAILED, sync FAILED, CRM и база HEALTHY', () => {
    const input = healthyInput();
    input.sync.lastRun = {
      status: 'FAILED',
      trigger: 'scheduler:hourly',
      startedAt: minutesAgo(5),
      finishedAt: minutesAgo(5),
      lastError: 'Метрика вернула ошибку 401: недействительный токен',
    };
    input.sync.failedLast24h = 3;
    const s = computeOpsStatus(input, NOW);
    expect(s.subsystems.crmBusiness.state).toBe('HEALTHY');
    expect(s.subsystems.database.state).toBe('HEALTHY');
    expect(s.subsystems.metrikaApi.state).toBe('FAILED');
    expect(s.subsystems.metrikaAnalyticsSync.state).toBe('FAILED');
    const failed = s.conditions.find((c) => c.code === 'METRIKA_SYNC_FAILED');
    expect(failed?.severity).toBe('WARNING');
    expect(failed?.operatorAction).toMatch(/токен/);
    expect(failed?.detail).toMatch(/unauthorized/);
  });

  it('данные старше 2 ч → STALE WARNING; старше 6 ч → CRITICAL; RUNNING > 60 мин → METRIKA_SYNC_STUCK', () => {
    const stale = healthyInput();
    stale.sync.lastSuccessAt = minutesAgo(150);
    let s = computeOpsStatus(stale, NOW);
    expect(s.subsystems.metrikaAnalyticsSync.state).toBe('STALE');
    expect(s.subsystems.behaviorAnalytics.state).toBe('STALE');
    expect(
      s.conditions.find((c) => c.code === 'METRIKA_SYNC_STALE')?.severity,
    ).toBe('WARNING');

    stale.sync.lastSuccessAt = minutesAgo(7 * 60);
    s = computeOpsStatus(stale, NOW);
    expect(
      s.conditions.find((c) => c.code === 'METRIKA_SYNC_STALE')?.severity,
    ).toBe('CRITICAL');

    stale.sync.runningCount = 1;
    stale.sync.oldestRunningStartedAt = minutesAgo(90);
    s = computeOpsStatus(stale, NOW);
    expect(s.subsystems.metrikaAnalyticsSync.state).toBe('FAILED');
    // CRITICAL первыми, внутри уровня — по коду
    expect(s.conditions.map((c) => `${c.severity}:${c.code}`)).toEqual([
      'CRITICAL:METRIKA_SYNC_STALE',
      'CRITICAL:METRIKA_SYNC_STUCK',
    ]);
    expect(
      s.conditions.find((c) => c.code === 'METRIKA_SYNC_STUCK')?.since,
    ).toBe(minutesAgo(90).toISOString());
  });

  it('флаги OFF → DISABLED без условий; не настроенная Метрика → METRIKA_NOT_CONFIGURED, CRM HEALTHY', () => {
    const off = healthyInput();
    off.flags = {
      analyticsSyncEnabled: false,
      ordersSyncEnabled: false,
      dashboardEnabled: false,
      growthEnabled: false,
      insightsEnabled: false,
      metrikaConfigured: false,
    };
    off.sync.lastSuccessAt = null;
    off.snapshots.lastFetchedAt = null;
    const s = computeOpsStatus(off, NOW);
    for (const key of [
      'metrikaApi',
      'metrikaOrdersOutbox',
      'metrikaAnalyticsSync',
      'periodSnapshots',
      'behaviorAnalytics',
      'growthEvaluations',
      'automatedInsights',
      'analyticsDashboard',
    ] as const)
      expect(s.subsystems[key].state).toBe('DISABLED');
    expect(s.subsystems.crmBusiness.state).toBe('HEALTHY');
    expect(s.conditions.map((c) => c.code)).toEqual(['METRIKA_NOT_CONFIGURED']);
  });

  it('очередь заказов: failed → OUTBOX_FAILED (FAILED); старая pending → OUTBOX_BACKLOG (DEGRADED); processing > 10 мин → OUTBOX_STUCK', () => {
    const input = healthyInput();
    input.outbox.failed = 2;
    input.outbox.oldestFailedAt = minutesAgo(400);
    let s = computeOpsStatus(input, NOW);
    expect(s.subsystems.metrikaOrdersOutbox.state).toBe('FAILED');
    expect(
      s.conditions.find((c) => c.code === 'OUTBOX_FAILED')?.detail,
    ).toMatch(/failed 2/);

    const backlog = healthyInput();
    backlog.outbox.pending = 3;
    backlog.outbox.oldestPendingAt = minutesAgo(200);
    backlog.outbox.processing = 1;
    backlog.outbox.oldestProcessingLockedAt = minutesAgo(15);
    s = computeOpsStatus(backlog, NOW);
    expect(s.subsystems.metrikaOrdersOutbox.state).toBe('DEGRADED');
    expect(s.conditions.map((c) => c.code).sort()).toEqual([
      'OUTBOX_BACKLOG',
      'OUTBOX_STUCK',
    ]);
    expect(s.outbox.oldestPendingAgeSeconds).toBe(200 * 60);
  });

  it('сигналы: RUNNING > 10 мин → INSIGHTS_RUN_STUCK; последний FAILED → INSIGHTS_RUN_FAILED; FAILED + новый RUNNING → RECOVERING', () => {
    const stuck = healthyInput();
    stuck.insights.oldestRunningStartedAt = minutesAgo(12);
    let s = computeOpsStatus(stuck, NOW);
    expect(s.subsystems.automatedInsights.state).toBe('FAILED');
    expect(s.conditions.map((c) => c.code)).toEqual(['INSIGHTS_RUN_STUCK']);

    const failed = healthyInput();
    failed.insights.lastRun = {
      kind: 'daily',
      status: 'FAILED',
      startedAt: minutesAgo(30),
      finishedAt: minutesAgo(30),
      errors: [
        'контекст: connection refused (OAuth y0_secret_should_not_leak_here_123456)',
      ],
    };
    s = computeOpsStatus(failed, NOW);
    expect(s.subsystems.automatedInsights.state).toBe('FAILED');
    const cond = s.conditions.find((c) => c.code === 'INSIGHTS_RUN_FAILED')!;
    expect(cond.detail).not.toMatch(/y0_secret/);
    expect(cond.detail).toMatch(/<скрыто>/);
    expect(s.insights.lastErrors[0]).not.toMatch(/y0_secret/);

    failed.insights.oldestRunningStartedAt = minutesAgo(1);
    s = computeOpsStatus(failed, NOW);
    expect(s.subsystems.automatedInsights.state).toBe('RECOVERING');
  });

  it('миграции: неприменённая на диске → DATABASE_MIGRATION_MISMATCH CRITICAL, база DEGRADED; неизвестная базе → WARNING', () => {
    const input = healthyInput();
    input.database.pendingMigrations = ['20260920000000_next'];
    let s = computeOpsStatus(input, NOW);
    expect(s.subsystems.database.state).toBe('DEGRADED');
    expect(s.conditions[0]).toMatchObject({
      code: 'DATABASE_MIGRATION_MISMATCH',
      severity: 'CRITICAL',
    });
    input.database.pendingMigrations = [];
    input.database.unknownMigrations = ['20260920000000_from_newer_image'];
    s = computeOpsStatus(input, NOW);
    expect(s.conditions[0].severity).toBe('WARNING');
  });

  it('база недоступна → DATABASE_UNAVAILABLE CRITICAL и crmBusiness FAILED (единственный случай)', () => {
    const input = healthyInput();
    input.database.reachable = false;
    const s = computeOpsStatus(input, NOW);
    expect(s.subsystems.crmBusiness.state).toBe('FAILED');
    expect(s.conditions[0].code).toBe('DATABASE_UNAVAILABLE');
  });

  it('снимки и автооценка: снимки старше 2 ч → SNAPSHOT_STALE; активные изменения без автооценки 26 ч → GROWTH_RUN_FAILED', () => {
    const input = healthyInput();
    input.snapshots.lastFetchedAt = minutesAgo(130);
    input.growth.lastScheduledEvaluationAt = minutesAgo(27 * 60);
    const s = computeOpsStatus(input, NOW);
    expect(s.subsystems.periodSnapshots.state).toBe('STALE');
    expect(s.subsystems.growthEvaluations.state).toBe('DEGRADED');
    expect(s.conditions.map((c) => c.code).sort()).toEqual([
      'GROWTH_RUN_FAILED',
      'SNAPSHOT_STALE',
    ]);
  });

  it('детерминизм: один вход — один и тот же ответ; в ответе нет ключей и значений, похожих на секреты', () => {
    const input = healthyInput();
    input.sync.lastRun!.lastError =
      'Bearer abcdefghijklmnop postgresql://user:pass@host/db y0_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const a = JSON.stringify(computeOpsStatus(input, NOW));
    const b = JSON.stringify(computeOpsStatus(input, NOW));
    expect(a).toBe(b);
    expect(a).not.toMatch(/pass@host|y0_AAAA|Bearer abcdef/);
    expect(a).not.toMatch(/token|secret|password|DATABASE_URL|clientId/i);
  });

  it('sanitizeError скрывает токены и адреса базы, оставляя класс ошибки', () => {
    expect(
      sanitizeError(
        'Метрика вернула ошибку 429 (OAuth y0_abcdefghijklmnopqrstuvwxyz)',
      ),
    ).toBe('Метрика вернула ошибку 429 (OAuth <скрыто>)');
    expect(sanitizeError('postgresql://u:p@h:5432/db timeout')).toBe(
      'postgresql://<скрыто> timeout',
    );
    expect(sanitizeError(null)).toBeNull();
  });
});
