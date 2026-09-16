import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import {
  calendarDateIn,
  utcDateToIso,
  type DateRange,
  type IsoDate,
} from '../../metrika/analytics/metrika-dates';
import type { SnapshotOutcome } from '../../metrika/analytics/metrika-period-snapshot.service';
import type { BehaviorMetricsService } from '../behavior/behavior-metrics.service';
import type { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import {
  periodBoundsUtc,
  type AnalyticsPeriod,
} from '../metrics/analytics-period';
import {
  freshnessOf,
  type OrderWithLifecycle,
} from '../metrics/metrics-compute';
import type { Slice, SourceRow } from '../metrics/metrics-contract';
import {
  computeEvaluation,
  type CohortData,
  type EvaluationInputs,
  type OverlappingChange,
  type WindowData,
} from './growth-compute';
import {
  AUDIENCE_DIMENSIONS,
  CHANGE_STATUSES,
  CHANGE_TYPES,
  GROWTH_METRIC_VERSION,
  type AnalyticsChangeRecord,
  type AudienceDefinition,
  type ChangeStatus,
  type ChangeType,
  type ExpectedDirection,
  type GrowthEvaluation,
  type GrowthEvaluationSummary,
  type GrowthMetricKey,
  type GrowthStatus,
} from './growth-contract';
import { lagInputsFrom, maturityPolicyFrom } from './growth-maturity';
import {
  GROWTH_METRIC_KEYS,
  GROWTH_METRICS,
  isGrowthMetricKey,
} from './growth-metrics';
import {
  ALPHA,
  EVALUATION_DAYS_OPTIONS,
  MATCHED_COVERAGE_MIN_PCT,
  MIN_EVENTS,
  MIN_SAMPLE_VISITS,
  MIX_SHIFT_POINTS_ATTENTION,
  POWER,
  TARGET_RELATIVE_EFFECT,
} from './growth-rules';
import {
  buildWindows,
  cutoverDayOf,
  observationCutoffOf,
} from './growth-windows';

/**
 * Сервис «Рост и изменения» (этап 11, разделы 19–22): реестр изменений,
 * оценки версиями и хук расписания. Значения метрик берутся из канонических
 * сервисов этапов 08 (AnalyticsMetricsService) и 10 (BehaviorMetricsService),
 * когорты — из их жизненных циклов заказов; к API Метрики сервис обращается
 * только через MetrikaPeriodSnapshotService ради точных снимков окон, и
 * только из хука расписания — запросы дашборда всегда локальные.
 */

export interface ChangeInput {
  name: string;
  description?: string;
  status?: ChangeStatus;
  changeType: ChangeType;
  startedAt: string;
  endedAt?: string | null;
  deploymentRef?: string | null;
  surface: string;
  audienceDefinition?: AudienceDefinition | null;
  primaryMetric: GrowthMetricKey;
  secondaryMetrics?: GrowthMetricKey[];
  expectedDirection: ExpectedDirection;
  hypothesis?: string | null;
  maturityDays?: number | null;
  evaluationDays?: number | null;
}

export type ChangePatch = Partial<ChangeInput>;

/** Что сервису нужно от снимков периодов: точный снимок произвольного окна (1 + 1 запрос к Метрике). */
export interface ExactWindowSnapshots {
  refreshRange(range: DateRange, preset: null): Promise<SnapshotOutcome>;
}

export interface GrowthServiceDeps {
  prisma: PrismaService;
  metrics: AnalyticsMetricsService;
  behavior: BehaviorMetricsService;
  snapshots?: ExactWindowSnapshots | null;
  now?: () => Date;
}

type ChangeRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string;
  status: string;
  changeType: string;
  startedAt: Date;
  endedAt: Date | null;
  deploymentRef: string | null;
  surface: string;
  audienceDefinition: unknown;
  primaryMetric: string;
  secondaryMetrics: unknown;
  expectedDirection: string;
  hypothesis: string | null;
  maturityDays: number | null;
  evaluationDays: number | null;
  primaryLockedAt: Date | null;
};

type EvaluationRow = {
  id: string;
  changeId: string;
  version: number;
  evaluatedAt: Date;
  trigger: string;
  verdict: string;
  maturity: string;
  primaryMetric: string;
  result: unknown;
  flags: unknown;
};

export class AnalyticsGrowthService {
  private readonly logger = new Logger(AnalyticsGrowthService.name);
  private readonly prisma: PrismaService;
  private readonly metrics: AnalyticsMetricsService;
  private readonly behavior: BehaviorMetricsService;
  private readonly snapshots: ExactWindowSnapshots | null;
  private readonly now: () => Date;

  constructor(deps: GrowthServiceDeps) {
    this.prisma = deps.prisma;
    this.metrics = deps.metrics;
    this.behavior = deps.behavior;
    this.snapshots = deps.snapshots ?? null;
    this.now = deps.now ?? (() => new Date());
  }

  // ---------------------------------------------------------------------------
  // Реестр

  async listChanges(): Promise<AnalyticsChangeRecord[]> {
    const rows = await this.prisma.analyticsChange.findMany({
      orderBy: [{ startedAt: 'desc' }],
    });
    const latest = await this.latestEvaluations(rows.map((r) => r.id));
    return rows.map((r) => this.toRecord(r, latest.get(r.id) ?? null));
  }

  async getChange(id: string): Promise<AnalyticsChangeRecord> {
    const row = await this.prisma.analyticsChange.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Изменение не найдено');
    const latest = await this.latestEvaluations([id]);
    return this.toRecord(row, latest.get(id) ?? null);
  }

  async createChange(input: ChangeInput): Promise<AnalyticsChangeRecord> {
    const data = this.validate(input, null);
    const row = await this.prisma.analyticsChange.create({ data });
    return this.toRecord(row, null);
  }

  async updateChange(
    id: string,
    patch: ChangePatch,
  ): Promise<AnalyticsChangeRecord> {
    const current = await this.prisma.analyticsChange.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Изменение не найдено');
    // Первичная метрика зафиксирована первой оценкой: менять её после — это подгонка результата.
    if (
      current.primaryLockedAt &&
      patch.primaryMetric !== undefined &&
      patch.primaryMetric !== current.primaryMetric
    )
      throw new BadRequestException(
        'Первичная метрика зафиксирована первой оценкой и не меняется; создайте новое изменение',
      );
    if (
      current.primaryLockedAt &&
      patch.expectedDirection !== undefined &&
      patch.expectedDirection !== current.expectedDirection
    )
      throw new BadRequestException(
        'Ожидаемое направление зафиксировано первой оценкой и не меняется',
      );
    const merged: ChangeInput = {
      name: patch.name ?? current.name,
      description: patch.description ?? current.description,
      status: (patch.status ?? current.status) as ChangeStatus,
      changeType: (patch.changeType ?? current.changeType) as ChangeType,
      startedAt: patch.startedAt ?? current.startedAt.toISOString(),
      endedAt:
        patch.endedAt === undefined
          ? (current.endedAt?.toISOString() ?? null)
          : patch.endedAt,
      deploymentRef:
        patch.deploymentRef === undefined
          ? current.deploymentRef
          : patch.deploymentRef,
      surface: patch.surface ?? current.surface,
      audienceDefinition:
        patch.audienceDefinition === undefined
          ? (current.audienceDefinition as AudienceDefinition | null)
          : patch.audienceDefinition,
      primaryMetric: (patch.primaryMetric ??
        current.primaryMetric) as GrowthMetricKey,
      secondaryMetrics:
        patch.secondaryMetrics ??
        (current.secondaryMetrics as GrowthMetricKey[]),
      expectedDirection: (patch.expectedDirection ??
        current.expectedDirection) as ExpectedDirection,
      hypothesis:
        patch.hypothesis === undefined ? current.hypothesis : patch.hypothesis,
      maturityDays:
        patch.maturityDays === undefined
          ? current.maturityDays
          : patch.maturityDays,
      evaluationDays:
        patch.evaluationDays === undefined
          ? current.evaluationDays
          : patch.evaluationDays,
    };
    const data = this.validate(merged, current);
    const row = await this.prisma.analyticsChange.update({
      where: { id },
      data,
    });
    const latest = await this.latestEvaluations([id]);
    return this.toRecord(row, latest.get(id) ?? null);
  }

  private validate(input: ChangeInput, current: ChangeRow | null) {
    const name = input.name?.trim();
    if (!name || name.length > 200)
      throw new BadRequestException('Название: 1–200 символов');
    const surface = input.surface?.trim();
    if (!surface || surface.length > 80)
      throw new BadRequestException('Поверхность: 1–80 символов');
    if (!CHANGE_TYPES.includes(input.changeType))
      throw new BadRequestException('Неизвестный тип изменения');
    const status = input.status ?? 'DRAFT';
    if (!CHANGE_STATUSES.includes(status))
      throw new BadRequestException('Неизвестный статус');
    if (!isGrowthMetricKey(input.primaryMetric))
      throw new BadRequestException('Неизвестная первичная метрика');
    const secondary = [...new Set(input.secondaryMetrics ?? [])].filter(
      (k) => k !== input.primaryMetric,
    );
    if (secondary.some((k) => !isGrowthMetricKey(k)))
      throw new BadRequestException('Неизвестная метрика в secondaryMetrics');
    if (!['INCREASE', 'DECREASE', 'NEUTRAL'].includes(input.expectedDirection))
      throw new BadRequestException(
        'Ожидаемое направление: INCREASE | DECREASE | NEUTRAL',
      );
    const startedAt = new Date(input.startedAt);
    if (Number.isNaN(startedAt.getTime()))
      throw new BadRequestException('startedAt — не дата');
    const endedAt = input.endedAt ? new Date(input.endedAt) : null;
    if (endedAt && (Number.isNaN(endedAt.getTime()) || endedAt <= startedAt))
      throw new BadRequestException('endedAt должен быть позже startedAt');
    if (
      input.evaluationDays != null &&
      !(EVALUATION_DAYS_OPTIONS as readonly number[]).includes(
        input.evaluationDays,
      )
    )
      throw new BadRequestException(
        `evaluationDays: ${EVALUATION_DAYS_OPTIONS.join(' / ')}`,
      );
    if (
      input.maturityDays != null &&
      (input.maturityDays < 0 || input.maturityDays > 90)
    )
      throw new BadRequestException('maturityDays: 0–90');
    const audience = input.audienceDefinition ?? null;
    if (audience) {
      if (!AUDIENCE_DIMENSIONS.includes(audience.dimension))
        throw new BadRequestException(
          'Аудитория: измерение device | source | utm | landing',
        );
      if (
        !Array.isArray(audience.values) ||
        audience.values.length === 0 ||
        audience.values.length > 20
      )
        throw new BadRequestException('Аудитория: 1–20 значений');
      if (
        audience.values.some(
          (v) => typeof v !== 'string' || v.length === 0 || v.length > 200,
        )
      )
        throw new BadRequestException('Аудитория: значения — непустые строки');
    }
    void current;
    return {
      name,
      description: (input.description ?? '').slice(0, 4000),
      status,
      changeType: input.changeType,
      startedAt,
      endedAt,
      deploymentRef: input.deploymentRef?.trim().slice(0, 120) || null,
      surface,
      audienceDefinition:
        audience === null
          ? undefined
          : { dimension: audience.dimension, values: audience.values },
      primaryMetric: input.primaryMetric,
      secondaryMetrics: secondary,
      expectedDirection: input.expectedDirection,
      hypothesis: input.hypothesis?.trim().slice(0, 4000) || null,
      maturityDays: input.maturityDays ?? null,
      evaluationDays: input.evaluationDays ?? null,
    };
  }

  private async latestEvaluations(
    ids: string[],
  ): Promise<Map<string, GrowthEvaluationSummary>> {
    const out = new Map<string, GrowthEvaluationSummary>();
    if (ids.length === 0) return out;
    const rows = await this.prisma.analyticsChangeEvaluation.findMany({
      where: { changeId: { in: ids } },
      orderBy: [{ changeId: 'asc' }, { version: 'desc' }],
    });
    for (const r of rows)
      if (!out.has(r.changeId)) out.set(r.changeId, this.toSummary(r));
    return out;
  }

  private toSummary(r: EvaluationRow): GrowthEvaluationSummary {
    const e = r.result as GrowthEvaluation;
    return {
      id: r.id,
      version: r.version,
      evaluatedAt: r.evaluatedAt.toISOString(),
      trigger: r.trigger as 'manual' | 'scheduler',
      verdict: e.verdict,
      maturity: e.maturity,
      primaryMetric: e.primaryMetric,
      before: e.primary.before,
      after: e.primary.after,
      absoluteDifference: e.primary.statistics?.absoluteDifference ?? null,
      relativeDifference: e.primary.statistics?.relativeDifference ?? null,
      windows: {
        before: e.windows.before,
        after: e.windows.after,
        days: e.windows.days,
      },
      flags: e.dataQuality.flags,
    };
  }

  private toRecord(
    r: ChangeRow,
    latest: GrowthEvaluationSummary | null,
  ): AnalyticsChangeRecord {
    const cutover = cutoverDayOf(r.startedAt);
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      name: r.name,
      description: r.description,
      status: r.status as ChangeStatus,
      changeType: r.changeType as ChangeType,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt?.toISOString() ?? null,
      deploymentRef: r.deploymentRef,
      surface: r.surface,
      audienceDefinition:
        (r.audienceDefinition as AudienceDefinition | null) ?? null,
      primaryMetric: r.primaryMetric as GrowthMetricKey,
      secondaryMetrics: (r.secondaryMetrics as GrowthMetricKey[]) ?? [],
      expectedDirection: r.expectedDirection as ExpectedDirection,
      hypothesis: r.hypothesis,
      maturityDays: r.maturityDays,
      evaluationDays: r.evaluationDays,
      primaryLockedAt: r.primaryLockedAt?.toISOString() ?? null,
      cutoverDay: cutover.day,
      cutoverDayIsFull: cutover.isFullDay,
      latestEvaluation: latest,
    };
  }

  // ---------------------------------------------------------------------------
  // Оценки

  async listEvaluations(changeId: string): Promise<GrowthEvaluationSummary[]> {
    await this.getChange(changeId);
    const rows = await this.prisma.analyticsChangeEvaluation.findMany({
      where: { changeId },
      orderBy: { version: 'desc' },
    });
    return rows.map((r) => this.toSummary(r));
  }

  async getEvaluation(
    changeId: string,
    version?: number,
  ): Promise<GrowthEvaluation> {
    const row = version
      ? await this.prisma.analyticsChangeEvaluation.findUnique({
          where: { changeId_version: { changeId, version } },
        })
      : await this.prisma.analyticsChangeEvaluation.findFirst({
          where: { changeId },
          orderBy: { version: 'desc' },
        });
    if (!row) throw new NotFoundException('Оценки ещё нет');
    return row.result as unknown as GrowthEvaluation;
  }

  /** Оценить изменение и сохранить новую версию; прежние версии не меняются. */
  async evaluate(
    changeId: string,
    trigger: 'manual' | 'scheduler',
  ): Promise<GrowthEvaluation> {
    const row = await this.prisma.analyticsChange.findUnique({
      where: { id: changeId },
    });
    if (!row) throw new NotFoundException('Изменение не найдено');
    if (row.status === 'CANCELLED')
      throw new BadRequestException('Отменённое изменение не оценивается');
    const now = this.now();
    const lastDataDay = await this.lastDataDay();
    const windows = buildWindows({
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      evaluationDays: row.evaluationDays,
      now,
      lastDataDay,
    });
    if (!windows)
      throw new BadRequestException(
        `После cutover (${cutoverDayOf(row.startedAt).day}) ещё нет ни одного полного московского дня с данными — оценивать нечего (NO_COMPLETE_DAYS_AFTER)`,
      );
    const [lastSync, orders, before, after, overlapping] = await Promise.all([
      this.prisma.metrikaSyncRun.findFirst({
        where: { status: 'SUCCESS', finishedAt: { not: null } },
        orderBy: { finishedAt: 'desc' },
        select: { id: true, finishedAt: true },
      }),
      this.metrics.lifecycles(windows.after),
      this.loadWindow(
        windows.before,
        row.audienceDefinition as AudienceDefinition | null,
      ),
      this.loadWindow(
        windows.after,
        row.audienceDefinition as AudienceDefinition | null,
      ),
      this.overlappingChanges(row.id, windows.before.from, windows.after.to),
    ]);
    const cutoffEnd = periodBoundsUtc({
      from: windows.observationCutoff,
      to: windows.observationCutoff,
    }).endExclusive;
    before.cohorts = cohortsFor(orders, windows.before, cutoffEnd);
    after.cohorts = cohortsFor(orders, windows.after, cutoffEnd);
    const maturityPolicy = maturityPolicyFrom(
      lagInputsFrom(orders),
      row.maturityDays,
    );
    const version =
      ((
        await this.prisma.analyticsChangeEvaluation.aggregate({
          where: { changeId },
          _max: { version: true },
        })
      )._max.version ?? 0) + 1;
    const inputs: EvaluationInputs = {
      change: {
        id: row.id,
        changeType: row.changeType as ChangeType,
        surface: row.surface,
        primaryMetric: row.primaryMetric as GrowthMetricKey,
        secondaryMetrics: (row.secondaryMetrics as GrowthMetricKey[]) ?? [],
        expectedDirection: row.expectedDirection as ExpectedDirection,
        audienceDefinition:
          (row.audienceDefinition as AudienceDefinition | null) ?? null,
      },
      windows,
      before,
      after,
      maturityPolicy,
      freshness: freshnessOf(lastSync?.finishedAt ?? null, now),
      lastSyncRunId: lastSync?.id ?? null,
      overlapping,
      evaluatedAt: now,
      version,
      trigger,
    };
    const evaluation = computeEvaluation(inputs);
    await this.prisma.$transaction([
      this.prisma.analyticsChangeEvaluation.create({
        data: {
          changeId,
          version,
          evaluatedAt: now,
          trigger,
          observationCutoff: new Date(
            `${windows.observationCutoff}T00:00:00.000Z`,
          ),
          beforeFrom: new Date(`${windows.before.from}T00:00:00.000Z`),
          beforeTo: new Date(`${windows.before.to}T00:00:00.000Z`),
          afterFrom: new Date(`${windows.after.from}T00:00:00.000Z`),
          afterTo: new Date(`${windows.after.to}T00:00:00.000Z`),
          metricVersion: GROWTH_METRIC_VERSION,
          primaryMetric: row.primaryMetric,
          verdict: evaluation.verdict,
          maturity: evaluation.maturity,
          result: evaluation as unknown as Prisma.InputJsonValue,
          flags: evaluation.dataQuality.flags,
          lastSyncRunId: lastSync?.id ?? null,
        },
      }),
      this.prisma.analyticsChange.update({
        where: { id: changeId },
        data: { primaryLockedAt: row.primaryLockedAt ?? now },
      }),
    ]);
    return evaluation;
  }

  /**
   * Данные окна для оценки; публичен, потому что этап 12 строит на тех же
   * загрузчиках сравнение скользящих окон — формулы и загрузки не дублируются.
   */
  async loadWindow(
    period: AnalyticsPeriod,
    audience: AudienceDefinition | null,
  ): Promise<WindowData> {
    // Устройства и страницы входа берутся из поведенческих агрегатов (loadInput): в них те же визиты
    // и достижения lead_submitted, лишние загрузки заказов срезами этапа 09 не нужны. Полный срез
    // источников (с сопоставленными заказами) нужен только для сегментов по аудитории source; для
    // confounder «сдвиг источников» хватает визитов по источникам из дневной таблицы одним запросом.
    const [overview, behavior, sources, utm] = await Promise.all([
      this.metrics.getOverview(period, false),
      this.behavior.loadInput(period),
      audience?.dimension === 'source'
        ? this.metrics.getTrafficSources(period)
        : this.sourceVisits(period),
      audience?.dimension === 'utm'
        ? this.metrics.getUtm(period)
        : Promise.resolve(null),
    ]);
    return {
      period,
      overview,
      behavior,
      cohorts: {
        leads: 0,
        leadsAccepted: 0,
        leadsPaid: 0,
        accepted: 0,
        acceptedPaid: 0,
        acceptedContractValues: [],
        acceptedPaidValues: [],
      },
      slices: { sources, utm },
    };
  }

  /** Визиты и достижения lead по источникам за окно одним запросом — для описательного сдвига смеси. */
  private async sourceVisits(
    period: AnalyticsPeriod,
  ): Promise<Slice<SourceRow>> {
    const rows = await this.prisma.metrikaDailySource.groupBy({
      by: ['trafficSource', 'trafficSourceName'],
      where: {
        date: {
          gte: new Date(`${period.from}T00:00:00.000Z`),
          lte: new Date(`${period.to}T00:00:00.000Z`),
        },
      },
      _sum: { visits: true, leadReaches: true },
    });
    const empty = {
      matchedAccepted: 0,
      matchedPaid: 0,
      visitToLead: null,
      visitToAccepted: null,
      visitToPaid: null,
      leadToAccepted: null,
      acceptedToPaid: null,
    };
    const out: SourceRow[] = rows.map((r) => ({
      trafficSource: r.trafficSource,
      trafficSourceName: r.trafficSourceName,
      sourceEngine: '',
      sourceEngineName: '',
      pageviews: 0,
      visits: r._sum.visits ?? 0,
      siteLeads: r._sum.leadReaches ?? 0,
      ...empty,
    }));
    return {
      period,
      rows: out,
      totals: {
        visits: out.reduce((s, r) => s + r.visits, 0),
        siteLeads: out.reduce((s, r) => s + r.siteLeads, 0),
        ...empty,
      },
      quality: { completeness: 'complete', notes: [] },
    };
  }

  /** Изменения реестра (ACTIVE/COMPLETED), пересекающие [from, to]; excludeId — само оцениваемое изменение. */
  async overlappingChanges(
    excludeId: string | null,
    from: IsoDate,
    to: IsoDate,
  ): Promise<OverlappingChange[]> {
    const bounds = periodBoundsUtc({ from, to });
    const rows = await this.prisma.analyticsChange.findMany({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        status: { in: ['ACTIVE', 'COMPLETED'] },
        startedAt: { lt: bounds.endExclusive },
        OR: [{ endedAt: null }, { endedAt: { gt: bounds.start } }],
      },
      select: {
        id: true,
        name: true,
        surface: true,
        startedAt: true,
        endedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      surface: r.surface,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt?.toISOString() ?? null,
    }));
  }

  /** Последний день с данными трафика Метрики (граница полных дней для окон). */
  async lastDataDay(): Promise<IsoDate | null> {
    const agg = await this.prisma.metrikaDailyTraffic.aggregate({
      _max: { date: true },
    });
    return agg._max.date ? utcDateToIso(agg._max.date) : null;
  }

  // ---------------------------------------------------------------------------
  // Статус и хук расписания

  async status(enabled: boolean): Promise<GrowthStatus> {
    const [rows, orders] = await Promise.all([
      this.prisma.analyticsChange.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.metrics.lifecycles({
        from: calendarDateIn(this.now()),
        to: calendarDateIn(this.now()),
        kind: 'days',
        preset: null,
      }),
    ]);
    const counts: Record<ChangeStatus, number> = {
      DRAFT: 0,
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const r of rows)
      if (r.status in counts) counts[r.status as ChangeStatus] = r._count._all;
    return {
      enabled,
      metricVersion: GROWTH_METRIC_VERSION,
      abCapability: 'NO_VARIANT_ASSIGNMENT',
      evidenceTypes: ['OBSERVATIONAL_BEFORE_AFTER'],
      metrics: GROWTH_METRIC_KEYS.map((k) => GROWTH_METRICS[k]),
      audienceDimensions: [...AUDIENCE_DIMENSIONS],
      changeTypes: [...CHANGE_TYPES],
      statuses: [...CHANGE_STATUSES],
      defaults: {
        alpha: ALPHA,
        power: POWER,
        targetRelativeEffect: TARGET_RELATIVE_EFFECT,
        minSampleVisits: MIN_SAMPLE_VISITS,
        minEvents: MIN_EVENTS,
        evaluationDaysOptions: [...EVALUATION_DAYS_OPTIONS],
        matchedCoverageMinPct: MATCHED_COVERAGE_MIN_PCT,
        mixShiftPointsAttention: MIX_SHIFT_POINTS_ATTENTION,
      },
      maturityPolicy: maturityPolicyFrom(lagInputsFrom(orders), null),
      counts,
    };
  }

  /**
   * После успешной синхронизации Метрики (раздел 22): точные снимки окон для
   * ACTIVE/COMPLETED изменений (только пока окно не устоялось или снимка нет)
   * и повторная оценка ACTIVE изменений, у которых появился новый полный день.
   * Ошибки логируются и не выходят наружу — синхронизация этапов 07/10 не страдает.
   */
  async afterSync(): Promise<{
    evaluated: number;
    snapshotRequests: number;
    errors: number;
  }> {
    let evaluated = 0;
    let snapshotRequests = 0;
    let errors = 0;
    const now = this.now();
    const cutoff = observationCutoffOf(now, await this.lastDataDay());
    const changes = await this.prisma.analyticsChange.findMany({
      where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
    });
    for (const row of changes) {
      try {
        const windows = buildWindows({
          startedAt: row.startedAt,
          endedAt: row.endedAt,
          evaluationDays: row.evaluationDays,
          now,
          lastDataDay: cutoff,
        });
        if (!windows) continue;
        if (this.snapshots)
          snapshotRequests += await this.refreshExactWindows(
            windows.before,
            windows.after,
            cutoff,
          );
        if (row.status !== 'ACTIVE') continue;
        const last = await this.prisma.analyticsChangeEvaluation.findFirst({
          where: { changeId: row.id },
          orderBy: { version: 'desc' },
          select: { observationCutoff: true, afterTo: true },
        });
        // Переоценка только при новом полном дне и пока окно «после» ещё двигается или зреет.
        const lastCutoff = last ? utcDateToIso(last.observationCutoff) : null;
        if (lastCutoff !== null && lastCutoff >= cutoff) continue;
        await this.evaluate(row.id, 'scheduler');
        evaluated++;
      } catch (error) {
        errors++;
        this.logger.warn(
          `Рост: изменение ${row.id} — ошибка автооценки: ${(error as Error).message}`,
        );
      }
    }
    if (evaluated || snapshotRequests)
      this.logger.log(
        `Рост: автооценка — изменений ${evaluated}, запросов снимков окон ${snapshotRequests}, ошибок ${errors}`,
      );
    return { evaluated, snapshotRequests, errors };
  }

  /** Снимок окна берётся, если его нет или окно ещё заканчивается не раньше дня cutoff − 1 (данные могут меняться). */
  private async refreshExactWindows(
    before: AnalyticsPeriod,
    after: AnalyticsPeriod,
    cutoff: IsoDate,
  ): Promise<number> {
    if (!this.snapshots) return 0;
    let requests = 0;
    for (const w of [before, after]) {
      const existing = await this.prisma.metrikaPeriodSnapshot.findUnique({
        where: {
          periodStart_periodEnd_metricScope: {
            periodStart: new Date(`${w.from}T00:00:00.000Z`),
            periodEnd: new Date(`${w.to}T00:00:00.000Z`),
            metricScope: 'counter',
          },
        },
        select: { fetchedAt: true },
      });
      const settled = w.to < cutoff; // окно целиком в прошлом относительно последнего полного дня
      if (existing && settled) continue;
      const outcome = await this.snapshots.refreshRange(
        { from: w.from, to: w.to },
        null,
      );
      requests += outcome.requests;
    }
    return requests;
  }
}

/** Когорты окна: заявки/принятые с датой внутри окна и их исходы до конца дня наблюдения. */
export function cohortsFor(
  orders: OrderWithLifecycle[],
  period: AnalyticsPeriod,
  cutoffEnd: Date,
): CohortData {
  const b = periodBoundsUtc(period);
  const inWindow = (d: Date | null) =>
    d !== null && d >= b.start && d < b.endExclusive;
  const byCutoff = (d: Date | null) => d !== null && d < cutoffEnd;
  const leads = orders.filter((o) => inWindow(o.lifecycle.leadAt));
  const accepted = orders.filter((o) => inWindow(o.lifecycle.acceptedAt));
  const acceptedPaid = accepted.filter((o) => byCutoff(o.lifecycle.paidAt));
  return {
    leads: leads.length,
    leadsAccepted: leads.filter((o) => byCutoff(o.lifecycle.acceptedAt)).length,
    leadsPaid: leads.filter((o) => byCutoff(o.lifecycle.paidAt)).length,
    accepted: accepted.length,
    acceptedPaid: acceptedPaid.length,
    acceptedContractValues: accepted.map((o) => o.order.totalOrder ?? 0),
    acceptedPaidValues: acceptedPaid.map((o) => o.order.totalOrder ?? 0),
  };
}
