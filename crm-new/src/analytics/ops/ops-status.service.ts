import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaService } from 'src/prisma/prisma.service';
import { buildIdentity } from '../../health.controller';
import {
  isMetrikaConfigured,
  metrikaAnalyticsSyncEnabledFromEnv,
  metrikaConfigFromEnv,
  metrikaOrdersSyncEnabledFromEnv,
} from '../../metrika/metrika.config';
import { dashboardEnabledFromEnv } from '../dashboard/analytics-dashboard.controller';
import type { GrowthEvaluation } from '../growth/growth-contract';
import { growthEnabledFromEnv } from '../growth/growth-flags';
import { insightsEnabledFromEnv } from '../insights/insights-flags';
import type { OpsInput, OpsStatus } from './ops-contract';
import { computeOpsStatus } from './ops-status.compute';

/**
 * Значение trigger, которым этап 11 помечает автоматические оценки роста.
 * Тип взят из контракта этапа 11 — опечатка вроде 'scheduled' больше не
 * соберётся, а молчаливое расхождение диагностики с фактом не повторится.
 */
const GROWTH_SCHEDULER_TRIGGER: GrowthEvaluation['trigger'] = 'scheduler';

/**
 * Сбор фактов для операционной диагностики (этап 13, раздел 6). Только чтение
 * Postgres и окружения: ни одного запроса к Метрике, ни одной записи. Все
 * запросы — по индексам журналов, укладываются в доли секунды.
 */
@Injectable()
export class OpsStatusService {
  private readonly logger = new Logger(OpsStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly now: () => Date = () => new Date(),
    private readonly migrationsDir: string = resolve(
      process.cwd(),
      'prisma',
      'migrations',
    ),
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async status(): Promise<OpsStatus> {
    return computeOpsStatus(await this.collect(), this.now());
  }

  async collect(): Promise<OpsInput> {
    const now = this.now();
    const flags: OpsInput['flags'] = {
      analyticsSyncEnabled: metrikaAnalyticsSyncEnabledFromEnv(this.env),
      ordersSyncEnabled: metrikaOrdersSyncEnabledFromEnv(this.env),
      dashboardEnabled: dashboardEnabledFromEnv(this.env),
      growthEnabled: growthEnabledFromEnv(this.env),
      insightsEnabled: insightsEnabledFromEnv(this.env),
      metrikaConfigured: isMetrikaConfigured(metrikaConfigFromEnv(this.env)),
    };
    const build = buildIdentity(this.env).build;

    let reachable = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.warn(
        `Диагностика: база недоступна — ${(error as Error).message.slice(0, 120)}`,
      );
      reachable = false;
    }
    if (!reachable) return this.unreachable(build, flags);

    const [migrations, sync, outbox, snapshots, growth, insights, reports] =
      await Promise.all([
        this.migrations(),
        this.sync(now),
        this.outbox(),
        this.snapshots(),
        this.growth(),
        this.insights(),
        this.reports(now),
      ]);
    return {
      build,
      flags,
      database: { reachable: true, ...migrations },
      sync,
      outbox,
      snapshots,
      growth,
      insights,
      reports,
    };
  }

  private unreachable(
    build: string | null,
    flags: OpsInput['flags'],
  ): OpsInput {
    return {
      build,
      flags,
      database: {
        reachable: false,
        pendingMigrations: [],
        unknownMigrations: [],
        rolledBackMigrations: 0,
        appliedMigrations: 0,
        lastMigration: null,
      },
      sync: {
        lastSuccessAt: null,
        lastRun: null,
        runningCount: 0,
        oldestRunningStartedAt: null,
        failedLast24h: 0,
        lastDataDay: null,
      },
      outbox: {
        pending: 0,
        processing: 0,
        failed: 0,
        delivered: 0,
        skipped: 0,
        oldestPendingAt: null,
        oldestFailedAt: null,
        oldestProcessingLockedAt: null,
        lastDeliveredAt: null,
      },
      snapshots: { count: 0, lastFetchedAt: null },
      growth: { activeChanges: 0, lastScheduledEvaluationAt: null },
      insights: {
        lastRun: null,
        lastSuccessAt: null,
        oldestRunningStartedAt: null,
        openCards: 0,
      },
      reports: {
        queued: 0,
        generating: 0,
        failedLast24h: 0,
        lastSuccessAt: null,
      },
    };
  }

  /** Миграции на диске против _prisma_migrations: расхождение = образ и база разной версии. */
  private async migrations(): Promise<Omit<OpsInput['database'], 'reachable'>> {
    const onDisk = existsSync(this.migrationsDir)
      ? readdirSync(this.migrationsDir)
          .filter((name) => {
            const full = join(this.migrationsDir, name);
            return (
              statSync(full).isDirectory() &&
              existsSync(join(full, 'migration.sql'))
            );
          })
          .sort()
      : [];
    const rows = await this.prisma.$queryRaw<
      {
        migration_name: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }[]
    >`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY finished_at`;
    const applied = rows.filter((r) => r.finished_at && !r.rolled_back_at);
    const appliedNames = new Set(applied.map((r) => r.migration_name));
    const diskNames = new Set(onDisk);
    return {
      pendingMigrations: onDisk.filter((n) => !appliedNames.has(n)),
      unknownMigrations: applied
        .map((r) => r.migration_name)
        .filter((n) => !diskNames.has(n)),
      rolledBackMigrations: rows.filter((r) => r.rolled_back_at).length,
      appliedMigrations: applied.length,
      lastMigration: applied.at(-1)?.migration_name ?? null,
    };
  }

  private async sync(now: Date): Promise<OpsInput['sync']> {
    const dayAgo = new Date(now.getTime() - 24 * 3600_000);
    const [lastSuccess, lastRun, running, failed24, lastTraffic] =
      await Promise.all([
        this.prisma.metrikaSyncRun.findFirst({
          where: { status: 'SUCCESS' },
          orderBy: { finishedAt: 'desc' },
          select: { finishedAt: true },
        }),
        this.prisma.metrikaSyncRun.findFirst({
          where: { status: { not: 'RUNNING' } },
          orderBy: { startedAt: 'desc' },
          select: {
            status: true,
            trigger: true,
            startedAt: true,
            finishedAt: true,
            lastError: true,
          },
        }),
        this.prisma.metrikaSyncRun.findMany({
          where: { status: 'RUNNING' },
          orderBy: { startedAt: 'asc' },
          select: { startedAt: true },
        }),
        this.prisma.metrikaSyncRun.count({
          where: { status: 'FAILED', startedAt: { gte: dayAgo } },
        }),
        this.prisma.metrikaDailyTraffic.findFirst({
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
      ]);
    return {
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      lastRun: lastRun
        ? {
            status: lastRun.status,
            trigger: lastRun.trigger,
            startedAt: lastRun.startedAt,
            finishedAt: lastRun.finishedAt,
            lastError: lastRun.lastError,
          }
        : null,
      runningCount: running.length,
      oldestRunningStartedAt: running[0]?.startedAt ?? null,
      failedLast24h: failed24,
      lastDataDay: lastTraffic
        ? lastTraffic.date.toISOString().slice(0, 10)
        : null,
    };
  }

  private async outbox(): Promise<OpsInput['outbox']> {
    const [
      groups,
      oldestPending,
      oldestFailed,
      oldestProcessing,
      lastDelivered,
    ] = await Promise.all([
      this.prisma.metrikaOrderOutbox.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.metrikaOrderOutbox.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.metrikaOrderOutbox.findFirst({
        where: { status: 'failed' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.metrikaOrderOutbox.findFirst({
        where: { status: 'processing' },
        orderBy: { lockedAt: 'asc' },
        select: { lockedAt: true },
      }),
      this.prisma.metrikaOrderOutbox.findFirst({
        where: { status: 'delivered' },
        orderBy: { processedAt: 'desc' },
        select: { processedAt: true },
      }),
    ]);
    const count = (status: string) =>
      groups.find((g) => g.status === status)?._count._all ?? 0;
    return {
      pending: count('pending'),
      processing: count('processing'),
      failed: count('failed'),
      delivered: count('delivered'),
      skipped: count('skipped'),
      oldestPendingAt: oldestPending?.createdAt ?? null,
      oldestFailedAt: oldestFailed?.createdAt ?? null,
      oldestProcessingLockedAt: oldestProcessing?.lockedAt ?? null,
      lastDeliveredAt: lastDelivered?.processedAt ?? null,
    };
  }

  private async snapshots(): Promise<OpsInput['snapshots']> {
    const [count, last] = await Promise.all([
      this.prisma.metrikaPeriodSnapshot.count(),
      this.prisma.metrikaPeriodSnapshot.findFirst({
        orderBy: { fetchedAt: 'desc' },
        select: { fetchedAt: true },
      }),
    ]);
    return { count, lastFetchedAt: last?.fetchedAt ?? null };
  }

  private async growth(): Promise<OpsInput['growth']> {
    const [active, last] = await Promise.all([
      this.prisma.analyticsChange.count({ where: { status: 'ACTIVE' } }),
      this.prisma.analyticsChangeEvaluation.findFirst({
        // Этап 11 пишет ровно два значения: 'manual' и 'scheduler'
        // (GROWTH_EVALUATION_TRIGGER). Диагностика спрашивала несуществующее
        // 'scheduled' — ответ всегда был пустой, и на боевом стенде
        // 22.09.2026 висел ложный GROWTH_RUN_FAILED при работающей автооценке.
        // Ручные оценки здесь не считаются намеренно: свежесть автооценки
        // они не подтверждают.
        where: { trigger: GROWTH_SCHEDULER_TRIGGER },
        orderBy: { evaluatedAt: 'desc' },
        select: { evaluatedAt: true },
      }),
    ]);
    return {
      activeChanges: active,
      lastScheduledEvaluationAt: last?.evaluatedAt ?? null,
    };
  }

  /**
   * Очередь отчётов этапа 16. Только счётчики: содержимое отчётов лежит
   * файлами и в диагностику не попадает.
   */
  private async reports(now: Date): Promise<OpsInput['reports']> {
    const dayAgo = new Date(now.getTime() - 24 * 3600_000);
    const [queued, generating, failedLast24h, lastSuccess] = await Promise.all([
      this.prisma.analyticsReport.count({ where: { status: 'QUEUED' } }),
      this.prisma.analyticsReport.count({ where: { status: 'GENERATING' } }),
      this.prisma.analyticsReport.count({
        where: { status: 'FAILED', requestedAt: { gte: dayAgo } },
      }),
      this.prisma.analyticsReport.findFirst({
        where: { status: 'READY' },
        orderBy: { generatedAt: 'desc' },
        select: { generatedAt: true },
      }),
    ]);
    return {
      queued,
      generating,
      failedLast24h,
      lastSuccessAt: lastSuccess?.generatedAt ?? null,
    };
  }

  private async insights(): Promise<OpsInput['insights']> {
    const [lastRun, lastSuccess, running, open] = await Promise.all([
      this.prisma.analyticsInsightRun.findFirst({
        where: { status: { not: 'RUNNING' } },
        orderBy: { startedAt: 'desc' },
        select: {
          kind: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          errors: true,
        },
      }),
      this.prisma.analyticsInsightRun.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { startedAt: 'desc' },
        select: { finishedAt: true, startedAt: true },
      }),
      this.prisma.analyticsInsightRun.findFirst({
        where: { status: 'RUNNING' },
        orderBy: { startedAt: 'asc' },
        select: { startedAt: true },
      }),
      this.prisma.analyticsInsight.count({
        where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      }),
    ]);
    return {
      lastRun: lastRun
        ? {
            kind: lastRun.kind,
            status: lastRun.status,
            startedAt: lastRun.startedAt,
            finishedAt: lastRun.finishedAt,
            errors: Array.isArray(lastRun.errors)
              ? (lastRun.errors as unknown[]).map(String)
              : [],
          }
        : null,
      lastSuccessAt: lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null,
      oldestRunningStartedAt: running?.startedAt ?? null,
      openCards: open,
    };
  }
}
