import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { addDays, utcDateToIso } from '../../metrika/analytics/metrika-dates';
import { BehaviorMetricsService } from '../behavior/behavior-metrics.service';
import { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import {
  type AnalyticsPeriod,
  periodBoundsUtc,
} from '../metrics/analytics-period';
import { freshnessOf } from '../metrics/metrics-compute';
import {
  AnalyticsGrowthService,
  cohortsFor,
} from '../growth/analytics-growth.service';
import {
  computeConfounders,
  evaluateMetric,
  type EvaluationInputs,
} from '../growth/growth-compute';
import type {
  GrowthEvaluation,
  GrowthMetricKey,
  MetricEvaluation,
} from '../growth/growth-contract';
import { GROWTH_METRIC_KEYS } from '../growth/growth-metrics';
import { lagInputsFrom, maturityPolicyFrom } from '../growth/growth-maturity';
import { buildWindows, observationCutoffOf } from '../growth/growth-windows';
import {
  INSIGHT_CATEGORIES,
  INSIGHT_ENGINE_VERSION,
  INSIGHT_SEVERITIES,
  INSIGHT_STATUSES,
  type DetectedInsight,
  type InsightCategory,
  type InsightPayload,
  type InsightRecord,
  type InsightRunKind,
  type InsightRunRecord,
  type InsightSeverity,
  type InsightStatus,
  type InsightVersionRecord,
  type InsightsFeed,
  type InsightsQuality,
  type InsightsStatus,
  type SuppressedResult,
  type SuppressionReason,
} from './insights-contract';
import {
  DETECTORS,
  payloadHash,
  runDetectors,
  type ChangeContext,
  type InsightContext,
} from './insights-engine';
import {
  COOLDOWN_DAYS,
  DATA_BOUNDARIES,
  INSIGHT_THRESHOLDS,
  MAX_ACTIVE_PER_DETECTOR,
  REOPEN_WINDOW_DAYS,
  ROLLING_WINDOW_DAYS,
  SEVERITY_ORDER,
} from './insights-rules';

/** Строка журнала RUNNING старше этого считается брошенной и не блокирует новый запуск. */
export const RUN_LOCK_MINUTES = 10;

export interface InsightsServiceDeps {
  prisma: PrismaService;
  metrics: AnalyticsMetricsService;
  behavior: BehaviorMetricsService;
  growth: AnalyticsGrowthService;
  now?: () => Date;
}

export interface FeedFilter {
  status?: 'active' | 'all' | InsightStatus;
  severity?: InsightSeverity;
  category?: InsightCategory;
  limit?: number;
}

type InsightRow = Prisma.AnalyticsInsightGetPayload<Record<string, never>>;
type RunRow = Prisma.AnalyticsInsightRunGetPayload<Record<string, never>>;

const ACTIVE: InsightStatus[] = ['OPEN', 'ACKNOWLEDGED'];
const SUPPRESSION_REASONS: SuppressionReason[] = [
  'LOW_SAMPLE',
  'INSUFFICIENT_DATA',
  'IMMATURE',
  'INCOMPARABLE_PERIODS',
  'PARTIAL_BEHAVIOR_PERIOD',
  'METRIC_NOT_AVAILABLE',
  'MEASUREMENT_DEFINITION_CHANGED',
  'WEEKDAY_MIX_MISMATCH',
  'MATCHED_COVERAGE_LOW',
  'COGS_INCOMPLETE',
  'STALE_DATA',
  'DUPLICATE',
  'COOLDOWN',
  'NO_MATERIAL_CHANGE',
];

/**
 * Движок сигналов (этап 12): собирает контекст из принятых сервисов этапов
 * 08/10/11, прогоняет детерминированные детекторы и ведёт жизненный цикл
 * карточек (отпечаток → версии → RESOLVED → эпизоды). Чтение API — только из
 * материализованных строк Postgres; к API Метрики из запросов не обращается.
 */
@Injectable()
export class AnalyticsInsightsService {
  private readonly logger = new Logger(AnalyticsInsightsService.name);
  private readonly prisma: PrismaService;
  private readonly metrics: AnalyticsMetricsService;
  private readonly behavior: BehaviorMetricsService;
  private readonly growth: AnalyticsGrowthService;
  private readonly now: () => Date;
  /** Защита от параллельного запуска внутри процесса (между процессами — advisory lock). */
  private running = false;

  constructor(deps: InsightsServiceDeps) {
    this.prisma = deps.prisma;
    this.metrics = deps.metrics;
    this.behavior = deps.behavior;
    this.growth = deps.growth;
    this.now = deps.now ?? (() => new Date());
  }

  // ---------------------------------------------------------------------------
  // Контекст

  /** Контекст запуска; null — после начала данных ещё нет двух полных окон. */
  async buildContext(
    runKind: InsightRunKind,
    seenEvaluations: Record<string, number>,
  ): Promise<InsightContext | null> {
    const now = this.now();
    const lastDataDay = await this.growth.lastDataDay();
    if (!lastDataDay) return null;
    const cutoff = observationCutoffOf(now, lastDataDay);
    const afterFrom = addDays(cutoff, -(ROLLING_WINDOW_DAYS - 1));
    const beforeFrom = addDays(afterFrom, -ROLLING_WINDOW_DAYS);
    if (beforeFrom < DATA_BOUNDARIES.metrikaHistorySince) return null;
    const windows = buildWindows({
      startedAt: periodBoundsUtc({ from: afterFrom, to: afterFrom }).start,
      endedAt: null,
      evaluationDays: ROLLING_WINDOW_DAYS,
      now,
      lastDataDay,
    });
    if (!windows) return null;

    // Часовой запуск — лёгкий контекст: только свежесть и оценки этапа 11 (детекторы с refresh: 'hourly'
    // метрик и срезов не читают); окна и данные Метрики не загружаются.
    if (runKind === 'hourly') {
      const [lastSync, changes] = await Promise.all([
        this.prisma.metrikaSyncRun.findFirst({
          where: { status: 'SUCCESS', finishedAt: { not: null } },
          orderBy: { finishedAt: 'desc' },
          select: { id: true, finishedAt: true },
        }),
        this.changeContexts(seenEvaluations),
      ]);
      return {
        now,
        runKind,
        observationCutoff: cutoff,
        windows,
        metrics: {} as Record<GrowthMetricKey, MetricEvaluation>,
        confounders: [],
        freshness: freshnessOf(lastSync?.finishedAt ?? null, now),
        lastSyncRunId: lastSync?.id ?? null,
        dataQuality: null,
        behavior: null,
        slices: { sources: null, landings: null, products: null },
        changes,
        paidWithoutDate: 0,
      };
    }

    const [lastSync, orders, before, after, overlapping, changes] =
      await Promise.all([
        this.prisma.metrikaSyncRun.findFirst({
          where: { status: 'SUCCESS', finishedAt: { not: null } },
          orderBy: { finishedAt: 'desc' },
          select: { id: true, finishedAt: true },
        }),
        this.metrics.lifecycles(windows.after),
        this.growth.loadWindow(windows.before, null),
        this.growth.loadWindow(windows.after, null),
        this.growth.overlappingChanges(
          null,
          windows.before.from,
          windows.after.to,
        ),
        this.changeContexts(seenEvaluations),
      ]);
    const cutoffEnd = periodBoundsUtc({
      from: cutoff,
      to: cutoff,
    }).endExclusive;
    before.cohorts = cohortsFor(orders, windows.before, cutoffEnd);
    after.cohorts = cohortsFor(orders, windows.after, cutoffEnd);
    const freshness = freshnessOf(lastSync?.finishedAt ?? null, now);
    const inputs: EvaluationInputs = {
      change: {
        id: 'rolling',
        changeType: 'ANALYTICS',
        surface: 'analytics:rolling-window',
        primaryMetric: 'visits',
        secondaryMetrics: [],
        expectedDirection: 'NEUTRAL',
        audienceDefinition: null,
      },
      windows,
      before,
      after,
      maturityPolicy: maturityPolicyFrom(lagInputsFrom(orders), null),
      freshness,
      lastSyncRunId: lastSync?.id ?? null,
      overlapping,
      evaluatedAt: now,
      version: 0,
      trigger: 'scheduler',
    };
    const metrics = {} as Record<GrowthMetricKey, MetricEvaluation>;
    for (const key of GROWTH_METRIC_KEYS)
      metrics[key] = evaluateMetric(key, 'secondary', inputs);
    const confounders = computeConfounders(inputs, Object.values(metrics));

    // Полный контекст дневного запуска: правила этапа 10 и срезы источников / страниц / товаров за оба окна.
    const [
      issues,
      funnels,
      sourcesB,
      sourcesA,
      landingsB,
      landingsA,
      productsB,
      productsA,
    ] = await Promise.all([
      this.behavior.getIssues(windows.after),
      this.behavior.getFunnels(windows.after),
      this.metrics.getTrafficSources(windows.before),
      this.metrics.getTrafficSources(windows.after),
      this.metrics.getLandings(windows.before),
      this.metrics.getLandings(windows.after),
      this.metrics.getProducts(windows.before),
      this.metrics.getProducts(windows.after),
    ]);

    return {
      now,
      runKind,
      observationCutoff: cutoff,
      windows,
      metrics,
      confounders,
      freshness,
      lastSyncRunId: lastSync?.id ?? null,
      dataQuality: after.overview.dataQuality,
      behavior: { issues, funnels },
      slices: {
        sources: { before: sourcesB, after: sourcesA },
        landings: { before: landingsB, after: landingsA },
        products: { before: productsB, after: productsA },
      },
      changes,
      paidWithoutDate: after.overview.orders.paidWithoutDate,
    };
  }

  private async changeContexts(
    seen: Record<string, number>,
  ): Promise<ChangeContext[]> {
    const rows = await this.prisma.analyticsChange.findMany({
      where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        name: true,
        status: true,
        surface: true,
        startedAt: true,
        endedAt: true,
        evaluations: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { result: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      surface: r.surface,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt?.toISOString() ?? null,
      latest:
        (r.evaluations[0]?.result as unknown as GrowthEvaluation | undefined) ??
        null,
      seenVersion: seen[r.id] ?? null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Запуск

  /** Полный (daily/manual) или лёгкий (hourly) запуск движка с записью журнала. */
  /**
   * Запуск с защитой от параллельности: флаг в процессе + строка журнала RUNNING
   * не старше RUN_LOCK_MINUTES (advisory lock сессии с пулом соединений Prisma
   * ненадёжен — unlock может уйти в другое соединение). Зависший RUNNING старше
   * лимита считается брошенным и не блокирует.
   */
  async run(kind: InsightRunKind): Promise<InsightRunRecord> {
    const startedAt = this.now();
    if (this.running) {
      return this.recordRun({
        kind,
        status: 'LOCKED',
        startedAt,
        errors: ['запуск уже идёт в этом процессе'],
      });
    }
    this.running = true;
    try {
      const other = await this.prisma.analyticsInsightRun.findFirst({
        where: {
          status: 'RUNNING',
          startedAt: {
            gt: new Date(startedAt.getTime() - RUN_LOCK_MINUTES * 60_000),
          },
        },
        select: { id: true },
      });
      if (other)
        return this.recordRun({
          kind,
          status: 'LOCKED',
          startedAt,
          errors: [`запуск ${other.id} ещё не завершён`],
        });
      return await this.runLocked(kind, startedAt);
    } finally {
      this.running = false;
    }
  }

  private async runLocked(
    kind: InsightRunKind,
    startedAt: Date,
  ): Promise<InsightRunRecord> {
    const prev = await this.prisma.analyticsInsightRun.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
    });
    const seen = (prev?.seenEvaluations as Record<string, number> | null) ?? {};
    // Строка RUNNING сразу — её видят другие процессы как замок.
    const runRow = await this.prisma.analyticsInsightRun.create({
      data: {
        kind,
        status: 'RUNNING',
        startedAt,
        suppressed: [],
        errors: [],
        seenEvaluations: seen,
      },
    });
    let ctx: InsightContext | null;
    try {
      ctx = await this.buildContext(kind, seen);
    } catch (e) {
      return this.finishRun(runRow.id, 'FAILED', [
        `контекст: ${(e as Error).message}`,
      ]);
    }
    if (!ctx)
      return this.finishRun(runRow.id, 'SKIPPED', [
        'нет двух полных окон данных Метрики',
      ]);

    const result = runDetectors(ctx, DETECTORS);
    const counters = {
      created: 0,
      versioned: 0,
      unchanged: 0,
      resolved: 0,
      reopened: 0,
    };
    const suppressed = [...result.suppressed];
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1) Обнаруженные: создать / версия / без изменений / переоткрыть — с лимитом активных на детектор.
        const activePerDetector = new Map<string, number>();
        for (const row of await tx.analyticsInsight.findMany({
          where: { status: { in: ACTIVE } },
          select: { detectorId: true, fingerprint: true },
        }))
          activePerDetector.set(
            row.detectorId,
            (activePerDetector.get(row.detectorId) ?? 0) + 1,
          );
        const seenFingerprints = new Set<string>();
        for (const di of result.detected) {
          const outcome = await this.upsertInsight(
            tx,
            di,
            ctx,
            startedAt,
            runRow.id,
            activePerDetector,
          );
          if (outcome.suppressed) suppressed.push(outcome.suppressed);
          else {
            counters[outcome.kind] += 1;
            seenFingerprints.add(outcome.fingerprint);
          }
        }
        // 2) Активные карточки детекторов этого запуска, которых больше нет, — RESOLVED (условие не выполняется).
        const ranDetectors = new Set(
          DETECTORS.filter(
            (d) => kind !== 'hourly' || d.refresh === 'hourly',
          ).map((d) => d.id),
        );
        const active = await tx.analyticsInsight.findMany({
          where: { status: { in: ACTIVE } },
        });
        for (const row of active) {
          if (
            !ranDetectors.has(row.detectorId) ||
            seenFingerprints.has(row.fingerprint)
          )
            continue;
          // оценки этапа 11: карточка живёт, пока изменение в реестре — её «условие» не окно, а сама оценка
          if (
            row.detectorId === 'change.evaluation' &&
            ctx.changes.some((c) => c.id === row.entityKey)
          )
            continue;
          await tx.analyticsInsight.update({
            where: { id: row.id },
            data: {
              status: 'RESOLVED',
              resolvedAt: startedAt,
              resolvedReason: 'условие сигнала больше не выполняется',
            },
          });
          counters.resolved += 1;
        }
        // 3) Версии оценок этапа 11, поднятые в ленту
        const newSeen = { ...seen };
        for (const c of ctx.changes)
          if (c.latest)
            newSeen[c.id] = Math.max(newSeen[c.id] ?? 0, c.latest.version);
        await tx.analyticsInsightRun.update({
          where: { id: runRow.id },
          data: {
            status: 'SUCCESS',
            finishedAt: this.now(),
            durationMs: this.now().getTime() - startedAt.getTime(),
            observationCutoff: new Date(
              `${ctx.observationCutoff}T00:00:00.000Z`,
            ),
            syncRunId: ctx.lastSyncRunId,
            detectors:
              kind === 'hourly'
                ? DETECTORS.filter((d) => d.refresh === 'hourly').length
                : DETECTORS.length,
            detected: result.detected.length,
            errors: result.errors,
            created: counters.created,
            versioned: counters.versioned,
            unchanged: counters.unchanged,
            resolved: counters.resolved,
            reopened: counters.reopened,
            suppressed: suppressed as unknown as Prisma.InputJsonValue,
            seenEvaluations: newSeen,
          },
        });
      });
    } catch (e) {
      return this.finishRun(runRow.id, 'FAILED', [
        `запись: ${(e as Error).message}`,
      ]);
    }
    const row = await this.prisma.analyticsInsightRun.findUniqueOrThrow({
      where: { id: runRow.id },
    });
    this.logger.log(
      `Сигналы: запуск ${kind} — обнаружено ${result.detected.length}, новых ${counters.created}, версий ${counters.versioned}, без изменений ${counters.unchanged}, закрыто ${counters.resolved}, переоткрыто ${counters.reopened}, промолчало ${suppressed.length}, ошибок ${result.errors.length}`,
    );
    return this.toRunRecord(row);
  }

  private async upsertInsight(
    tx: Prisma.TransactionClient,
    di: DetectedInsight,
    ctx: InsightContext,
    at: Date,
    runId: string,
    activePerDetector: Map<string, number>,
  ): Promise<
    | { suppressed: SuppressedResult }
    | {
        suppressed?: undefined;
        kind: 'created' | 'versioned' | 'unchanged' | 'reopened';
        fingerprint: string;
      }
  > {
    const p = di.payload;
    const hash = payloadHash(p);
    const episodes = await tx.analyticsInsight.findMany({
      where: { baseFingerprint: di.fingerprint },
      orderBy: { episode: 'desc' },
    });
    const latest = episodes[0] ?? null;
    const base = {
      category: p.category,
      severity: p.severity,
      scope: p.scope,
      source: p.source,
      detectorId: p.detectorId,
      metricKey: p.metricKey,
      entityKey: p.entityKey,
      periodStart: new Date(`${p.fact.period.from}T00:00:00.000Z`),
      periodEnd: new Date(`${p.fact.period.to}T00:00:00.000Z`),
      baselineStart: p.fact.baselinePeriod
        ? new Date(`${p.fact.baselinePeriod.from}T00:00:00.000Z`)
        : null,
      baselineEnd: p.fact.baselinePeriod
        ? new Date(`${p.fact.baselinePeriod.to}T00:00:00.000Z`)
        : null,
      title: p.title,
      fact: p.fact as unknown as Prisma.InputJsonValue,
      hypothesis: p.hypothesis as unknown as Prisma.InputJsonValue,
      recommendation: p.recommendation as unknown as Prisma.InputJsonValue,
      evidence: p.evidence as unknown as Prisma.InputJsonValue,
      limitations: p.limitations as unknown as Prisma.InputJsonValue,
      quality: p.quality as unknown as Prisma.InputJsonValue,
      link: (p.link ?? undefined) as Prisma.InputJsonValue | undefined,
      lastDetectedAt: at,
      payloadHash: hash,
    };
    const version = (insightId: string, v: number) =>
      tx.analyticsInsightVersion.create({
        data: {
          insightId,
          version: v,
          generatedAt: at,
          syncRunId: ctx.lastSyncRunId,
          runId,
          payload: p as unknown as Prisma.InputJsonValue,
          payloadHash: hash,
        },
      });

    if (latest && ACTIVE.includes(latest.status as InsightStatus)) {
      if (latest.payloadHash === hash) {
        await tx.analyticsInsight.update({
          where: { id: latest.id },
          data: { lastDetectedAt: at },
        });
        return { kind: 'unchanged', fingerprint: latest.fingerprint };
      }
      const v = latest.latestVersion + 1;
      await tx.analyticsInsight.update({
        where: { id: latest.id },
        data: { ...base, latestVersion: v },
      });
      await version(latest.id, v);
      return { kind: 'versioned', fingerprint: latest.fingerprint };
    }
    if (latest && latest.status === 'RESOLVED' && latest.resolvedAt) {
      const sinceResolved =
        (at.getTime() - latest.resolvedAt.getTime()) / 86400e3;
      if (sinceResolved <= REOPEN_WINDOW_DAYS) {
        const v = latest.latestVersion + 1;
        await tx.analyticsInsight.update({
          where: { id: latest.id },
          data: {
            ...base,
            status: 'OPEN',
            resolvedAt: null,
            resolvedReason: null,
            acknowledgedAt: null,
            latestVersion: v,
          },
        });
        await version(latest.id, v);
        return { kind: 'reopened', fingerprint: latest.fingerprint };
      }
      if (sinceResolved < COOLDOWN_DAYS + REOPEN_WINDOW_DAYS) {
        return {
          suppressed: {
            detectorId: p.detectorId,
            category: p.category,
            metricKey: p.metricKey,
            entityKey: p.entityKey,
            reason: 'COOLDOWN',
            detail: `эпизод закрыт ${Math.floor(sinceResolved)} дн. назад — новый эпизод не раньше чем через ${COOLDOWN_DAYS} дн. после окна переоткрытия`,
            sample: null,
          },
        };
      }
    }
    const activeCount = activePerDetector.get(p.detectorId) ?? 0;
    if (activeCount >= MAX_ACTIVE_PER_DETECTOR)
      return {
        suppressed: {
          detectorId: p.detectorId,
          category: p.category,
          metricKey: p.metricKey,
          entityKey: p.entityKey,
          reason: 'COOLDOWN',
          detail: `у детектора уже ${activeCount} активных карточек (лимит ${MAX_ACTIVE_PER_DETECTOR})`,
          sample: null,
        },
      };
    const episode = (latest?.episode ?? 0) + 1;
    if (latest && latest.status !== 'SUPERSEDED')
      await tx.analyticsInsight.update({
        where: { id: latest.id },
        data: { status: 'SUPERSEDED' },
      });
    const created = await tx.analyticsInsight.create({
      data: {
        ...base,
        fingerprint:
          episode === 1 ? di.fingerprint : `${di.fingerprint}#${episode}`,
        baseFingerprint: di.fingerprint,
        episode,
        status: 'OPEN',
        causality: 'NOT_ESTABLISHED',
        firstDetectedAt: at,
        latestVersion: 1,
      },
    });
    await version(created.id, 1);
    activePerDetector.set(p.detectorId, activeCount + 1);
    return { kind: 'created', fingerprint: created.fingerprint };
  }

  /** Завершить строку журнала не-успехом (FAILED / SKIPPED). */
  private async finishRun(
    id: string,
    status: 'FAILED' | 'SKIPPED',
    errors: string[],
  ): Promise<InsightRunRecord> {
    const row = await this.prisma.analyticsInsightRun.update({
      where: { id },
      data: {
        status,
        finishedAt: this.now(),
        errors,
      },
    });
    if (status === 'FAILED')
      this.logger.error(
        `Сигналы: запуск ${row.kind} — FAILED: ${errors.join('; ')}`,
      );
    return this.toRunRecord(row);
  }

  private async recordRun(input: {
    kind: InsightRunKind;
    status: 'LOCKED' | 'FAILED' | 'SKIPPED';
    startedAt: Date;
    errors: string[];
  }): Promise<InsightRunRecord> {
    const row = await this.prisma.analyticsInsightRun.create({
      data: {
        kind: input.kind,
        status: input.status,
        startedAt: input.startedAt,
        finishedAt: this.now(),
        durationMs: this.now().getTime() - input.startedAt.getTime(),
        suppressed: [],
        errors: input.errors,
        seenEvaluations: {},
      },
    });
    if (input.status === 'FAILED')
      this.logger.error(
        `Сигналы: запуск ${input.kind} — FAILED: ${input.errors.join('; ')}`,
      );
    return this.toRunRecord(row);
  }

  /** Хук после тика расписания: полный запуск при новом полном дне, иначе лёгкий часовой. */
  async afterSync(): Promise<{
    kind: InsightRunKind;
    status: InsightRunRecord['status'];
  }> {
    const lastDaily = await this.prisma.analyticsInsightRun.findFirst({
      where: { kind: { in: ['daily', 'manual'] }, status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
      select: { observationCutoff: true },
    });
    const cutoff = observationCutoffOf(
      this.now(),
      await this.growth.lastDataDay(),
    );
    const lastCutoff = lastDaily?.observationCutoff
      ? utcDateToIso(lastDaily.observationCutoff)
      : null;
    const kind: InsightRunKind =
      lastCutoff === null || lastCutoff < cutoff ? 'daily' : 'hourly';
    const run = await this.run(kind);
    return { kind, status: run.status };
  }

  // ---------------------------------------------------------------------------
  // Чтение (только Postgres)

  async feed(filter: FeedFilter = {}): Promise<InsightsFeed> {
    const where: Prisma.AnalyticsInsightWhereInput = {};
    const status = filter.status ?? 'active';
    if (status === 'active') where.status = { in: ACTIVE };
    else if (status !== 'all') where.status = status;
    if (filter.severity) where.severity = filter.severity;
    if (filter.category) where.category = filter.category;
    const [rows, total, lastRun] = await Promise.all([
      this.prisma.analyticsInsight.findMany({
        where,
        orderBy: [{ lastDetectedAt: 'desc' }],
        take: Math.min(filter.limit ?? 100, 200),
      }),
      this.prisma.analyticsInsight.count({ where }),
      this.lastRun(),
    ]);
    const items = rows.map((r) => this.toRecord(r)).sort(compareForFeed);
    return {
      items,
      total,
      suppressedSummary: summarize(lastRun?.suppressed ?? []),
      lastRun,
      generatedAt: this.now().toISOString(),
    };
  }

  async get(id: string): Promise<InsightRecord> {
    const row = await this.prisma.analyticsInsight.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Сигнал не найден');
    return this.toRecord(row);
  }

  async versions(id: string): Promise<InsightVersionRecord[]> {
    await this.get(id);
    const rows = await this.prisma.analyticsInsightVersion.findMany({
      where: { insightId: id },
      orderBy: { version: 'desc' },
    });
    return rows.map((v) => ({
      version: v.version,
      generatedAt: v.generatedAt.toISOString(),
      syncRunId: v.syncRunId,
      runId: v.runId,
      payload: v.payload as unknown as InsightPayload,
    }));
  }

  async acknowledge(id: string): Promise<InsightRecord> {
    const row = await this.prisma.analyticsInsight.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Сигнал не найден');
    if (row.status !== 'OPEN')
      throw new BadRequestException(
        `Отметить можно только открытый сигнал (сейчас ${row.status})`,
      );
    return this.toRecord(
      await this.prisma.analyticsInsight.update({
        where: { id },
        data: { status: 'ACKNOWLEDGED', acknowledgedAt: this.now() },
      }),
    );
  }

  async resolve(id: string, reason: string): Promise<InsightRecord> {
    const row = await this.prisma.analyticsInsight.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Сигнал не найден');
    if (!ACTIVE.includes(row.status as InsightStatus))
      throw new BadRequestException(
        `Закрыть можно только активный сигнал (сейчас ${row.status})`,
      );
    return this.toRecord(
      await this.prisma.analyticsInsight.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedAt: this.now(),
          resolvedReason: `вручную: ${reason}`,
        },
      }),
    );
  }

  async quality(): Promise<InsightsQuality> {
    const [runs, active] = await Promise.all([
      this.prisma.analyticsInsightRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
      this.prisma.analyticsInsight.groupBy({
        by: ['category'],
        where: { status: { in: ACTIVE } },
        _count: { _all: true },
      }),
    ]);
    const records = runs.map((r) => this.toRunRecord(r));
    const lastSuccess = records.find((r) => r.status === 'SUCCESS') ?? null;
    const activeByCategory = Object.fromEntries(
      INSIGHT_CATEGORIES.map((c) => [c, 0]),
    ) as Record<InsightCategory, number>;
    for (const g of active)
      activeByCategory[g.category as InsightCategory] = g._count._all;
    return {
      lastRun: records[0] ?? null,
      recentRuns: records,
      suppressed: lastSuccess?.suppressed ?? [],
      suppressedSummary: summarize(lastSuccess?.suppressed ?? []),
      activeByCategory,
    };
  }

  async status(enabled: boolean): Promise<InsightsStatus> {
    const [groups, lastRun] = await Promise.all([
      this.prisma.analyticsInsight.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.lastRun(),
    ]);
    const counts = Object.fromEntries(
      INSIGHT_STATUSES.map((s) => [s, 0]),
    ) as Record<InsightStatus, number>;
    for (const g of groups) counts[g.status as InsightStatus] = g._count._all;
    return {
      enabled,
      engineVersion: INSIGHT_ENGINE_VERSION,
      causality: 'NOT_ESTABLISHED',
      categories: [...INSIGHT_CATEGORIES],
      severities: [...INSIGHT_SEVERITIES],
      statuses: [...INSIGHT_STATUSES],
      detectors: DETECTORS.map((d) => ({
        id: d.id,
        category: d.category,
        refresh: d.refresh,
        source: d.source,
      })),
      thresholds: INSIGHT_THRESHOLDS,
      counts,
      lastRun,
      boundaries: {
        metrikaHistorySince: DATA_BOUNDARIES.metrikaHistorySince,
        leadSemanticsCutover: DATA_BOUNDARIES.leadSemanticsCutover,
        incident: DATA_BOUNDARIES.incident
          ? { ...DATA_BOUNDARIES.incident }
          : null,
      },
    };
  }

  private async lastRun(): Promise<InsightRunRecord | null> {
    const row = await this.prisma.analyticsInsightRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });
    return row ? this.toRunRecord(row) : null;
  }

  private toRecord(r: InsightRow): InsightRecord {
    const iso = (d: Date | null) => (d ? utcDateToIso(d) : null);
    return {
      id: r.id,
      fingerprint: r.fingerprint,
      episode: r.episode,
      category: r.category as InsightCategory,
      severity: r.severity as InsightSeverity,
      status: r.status as InsightStatus,
      scope: r.scope as InsightRecord['scope'],
      source: r.source as InsightRecord['source'],
      detectorId: r.detectorId,
      metricKey: r.metricKey,
      entityKey: r.entityKey,
      periodStart: utcDateToIso(r.periodStart),
      periodEnd: utcDateToIso(r.periodEnd),
      baselineStart: iso(r.baselineStart),
      baselineEnd: iso(r.baselineEnd),
      title: r.title,
      fact: r.fact as unknown as InsightRecord['fact'],
      hypothesis: r.hypothesis as unknown as InsightRecord['hypothesis'],
      recommendation:
        r.recommendation as unknown as InsightRecord['recommendation'],
      evidence: r.evidence as unknown as InsightRecord['evidence'],
      limitations: r.limitations as unknown as InsightRecord['limitations'],
      quality: r.quality as unknown as InsightRecord['quality'],
      causality: 'NOT_ESTABLISHED',
      link: (r.link as unknown as InsightRecord['link']) ?? null,
      firstDetectedAt: r.firstDetectedAt.toISOString(),
      lastDetectedAt: r.lastDetectedAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      resolvedReason: r.resolvedReason,
      acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
      latestVersion: r.latestVersion,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toRunRecord(r: RunRow): InsightRunRecord {
    return {
      id: r.id,
      kind: r.kind as InsightRunKind,
      status: r.status as InsightRunRecord['status'],
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      observationCutoff: r.observationCutoff
        ? utcDateToIso(r.observationCutoff)
        : null,
      syncRunId: r.syncRunId,
      detectors: r.detectors,
      detected: r.detected,
      created: r.created,
      versioned: r.versioned,
      unchanged: r.unchanged,
      resolved: r.resolved,
      reopened: r.reopened,
      suppressed: (r.suppressed as unknown as SuppressedResult[]) ?? [],
      errors: (r.errors as unknown as string[]) ?? [],
      durationMs: r.durationMs,
      queryCount: r.queryCount,
    };
  }
}

/** Порядок ленты: CRITICAL данных/техники → CRITICAL деловые → ATTENTION → INFO; внутри — свежее выше. */
export function compareForFeed(a: InsightRecord, b: InsightRecord): number {
  const sa = SEVERITY_ORDER[a.severity],
    sb = SEVERITY_ORDER[b.severity];
  if (sa !== sb) return sa - sb;
  if (a.severity === 'CRITICAL') {
    const ta = a.scope === 'data' ? 0 : 1,
      tb = b.scope === 'data' ? 0 : 1;
    if (ta !== tb) return ta - tb;
  }
  if (a.lastDetectedAt !== b.lastDetectedAt)
    return a.lastDetectedAt < b.lastDetectedAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function summarize(
  list: SuppressedResult[],
): Record<SuppressionReason, number> {
  const out = Object.fromEntries(
    SUPPRESSION_REASONS.map((r) => [r, 0]),
  ) as Record<SuppressionReason, number>;
  for (const s of list) out[s.reason] = (out[s.reason] ?? 0) + 1;
  return out;
}

export type { AnalyticsPeriod };
