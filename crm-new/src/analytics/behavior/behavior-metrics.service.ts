import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { isoToUtcDate } from '../../metrika/analytics/metrika-dates';
import { METRIKA_SCOPE_COUNTER } from '../metrics/analytics-constants';
import {
  previousPeriod,
  type AnalyticsPeriod,
} from '../metrics/analytics-period';
import { freshnessOf } from '../metrics/metrics-compute';
import {
  computeDevices,
  computeErrors,
  computeFunnel,
  computeIssues,
  computePages,
  computePaths,
  computeSummary,
  FUNNEL_KEYS,
  type BehaviorInput,
  type DeviceInput,
  type GoalCount,
  type LandingInput,
  type ParamInput,
  type PathInput,
} from './behavior-compute';
import type {
  BehaviorIssues,
  BehaviorSummary,
  DevicesBehavior,
  FormErrors,
  Funnel,
  PagesBehavior,
  PathsBehavior,
} from './behavior-contract';

/**
 * Поведенческий слой (этап 10): читает только локальные агрегаты Метрики
 * (наборы этапов 07 и 10, снимки периодов) и отдаёт контракт
 * behavior-contract. К API Яндекса не обращается. Формулы — в
 * behavior-compute.ts; здесь только выборка и сборка BehaviorInput.
 */
@Injectable()
export class BehaviorMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getSummary(period: AnalyticsPeriod): Promise<BehaviorSummary> {
    const [input, prev] = await this.loadPair(period);
    const funnels = FUNNEL_KEYS.map((k) => computeFunnel(k, input, prev));
    const devices = computeDevices(input);
    const errors = computeErrors(input, prev);
    const pages = computePages(input);
    const issues = computeIssues(input, prev, {
      funnels,
      errors,
      pages,
      devices,
      previousLeadRate: prev ? this.leadRateOf(prev) : null,
    });
    return computeSummary(input, prev, funnels[0], devices, issues, this.now());
  }

  async getFunnels(period: AnalyticsPeriod): Promise<Funnel[]> {
    const [input, prev] = await this.loadPair(period);
    return FUNNEL_KEYS.map((k) => computeFunnel(k, input, prev));
  }

  async getErrors(period: AnalyticsPeriod): Promise<FormErrors> {
    const [input, prev] = await this.loadPair(period);
    return computeErrors(input, prev);
  }

  async getPages(period: AnalyticsPeriod): Promise<PagesBehavior> {
    return computePages(await this.loadInput(period));
  }

  async getDevices(period: AnalyticsPeriod): Promise<DevicesBehavior> {
    return computeDevices(await this.loadInput(period));
  }

  async getPaths(period: AnalyticsPeriod): Promise<PathsBehavior> {
    return computePaths(await this.loadInput(period));
  }

  async getIssues(period: AnalyticsPeriod): Promise<BehaviorIssues> {
    const [input, prev] = await this.loadPair(period);
    const funnels = FUNNEL_KEYS.map((k) => computeFunnel(k, input, prev));
    return computeIssues(input, prev, {
      funnels,
      errors: computeErrors(input, prev),
      pages: computePages(input),
      devices: computeDevices(input),
      previousLeadRate: prev ? this.leadRateOf(prev) : null,
    });
  }

  // ---------------------------------------------------------------------------

  private leadRateOf(input: BehaviorInput): {
    visits: number;
    leadVisits: number;
  } {
    return {
      visits: input.visits,
      leadVisits: input.goalTotals.get('lead_submitted')?.visits ?? 0,
    };
  }

  private async loadPair(
    period: AnalyticsPeriod,
  ): Promise<[BehaviorInput, BehaviorInput | null]> {
    const prev = previousPeriod(period);
    const [input, previous] = await Promise.all([
      this.loadInput(period),
      this.loadInput(prev),
    ]);
    return [input, previous];
  }

  private dateWhere(period: AnalyticsPeriod) {
    return { gte: isoToUtcDate(period.from), lte: isoToUtcDate(period.to) };
  }

  /** Все агрегаты периода — параллельно, только суммы по локальным таблицам. */
  async loadInput(period: AnalyticsPeriod): Promise<BehaviorInput> {
    const where = { date: this.dateWhere(period) };
    const periodKey = {
      periodStart: isoToUtcDate(period.from),
      periodEnd: isoToUtcDate(period.to),
    };
    const [
      traffic,
      goals,
      goalSnapshots,
      snapshot,
      devices,
      behaviorDevices,
      engagement,
      landings,
      behaviorLandings,
      params,
      paths,
      behaviorRows,
      lastSync,
    ] = await Promise.all([
      this.prisma.metrikaDailyTraffic.aggregate({
        where,
        _sum: { visits: true, users: true },
      }),
      this.prisma.metrikaDailyGoal.groupBy({
        by: ['goalIdentifier'],
        where: { ...where, goalIdentifier: { not: null } },
        _sum: { reaches: true, goalVisits: true },
      }),
      this.prisma.metrikaPeriodGoalSnapshot.findMany({ where: periodKey }),
      this.prisma.metrikaPeriodSnapshot.findUnique({
        where: {
          periodStart_periodEnd_metricScope: {
            ...periodKey,
            metricScope: METRIKA_SCOPE_COUNTER,
          },
        },
      }),
      this.prisma.metrikaDailyDevice.groupBy({
        by: ['deviceCategory'],
        where,
        _sum: { visits: true, users: true, orderCreatedReaches: true },
      }),
      this.prisma.metrikaDailyBehaviorDevice.groupBy({
        by: ['deviceCategory', 'goalIdentifier'],
        where,
        _sum: { reaches: true, goalVisits: true },
      }),
      this.prisma.metrikaDailyDeviceEngagement.groupBy({
        by: ['deviceCategory'],
        where,
        _sum: {
          visits: true,
          bounces: true,
          pageviews: true,
          durationSeconds: true,
        },
      }),
      this.prisma.metrikaDailyLanding.groupBy({
        by: ['normalizedPath'],
        where,
        _sum: { visits: true, users: true, orderCreatedReaches: true },
      }),
      this.prisma.metrikaDailyBehaviorLanding.groupBy({
        by: ['normalizedPath', 'goalIdentifier'],
        where,
        _sum: { reaches: true, goalVisits: true },
      }),
      this.prisma.metrikaDailyVisitParam.groupBy({
        by: ['deviceCategory', 'paramKey', 'paramValue'],
        where,
        _sum: { visits: true, users: true, paramsNumber: true },
      }),
      this.prisma.metrikaDailyPathPage.groupBy({
        by: ['kind', 'normalizedPath'],
        where,
        _sum: { visits: true, pageviews: true, users: true },
      }),
      this.prisma.metrikaDailyBehaviorDevice.count({ where }),
      this.prisma.metrikaSyncRun.findFirst({
        where: { status: 'SUCCESS', finishedAt: { not: null } },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
    ]);

    const n = (v: number | null | undefined): number => v ?? 0;
    const goalTotals = new Map<string, GoalCount>();
    for (const g of goals) {
      if (!g.goalIdentifier) continue;
      goalTotals.set(g.goalIdentifier, {
        reaches: n(g._sum.reaches),
        visits: n(g._sum.goalVisits),
      });
    }
    const goalUsers =
      goalSnapshots.length > 0
        ? new Map(goalSnapshots.map((s) => [s.goalIdentifier, s.users]))
        : null;

    const deviceGoals = new Map<string, Map<string, GoalCount>>();
    for (const r of behaviorDevices) {
      const m =
        deviceGoals.get(r.deviceCategory) ?? new Map<string, GoalCount>();
      m.set(r.goalIdentifier, {
        reaches: n(r._sum.reaches),
        visits: n(r._sum.goalVisits),
      });
      deviceGoals.set(r.deviceCategory, m);
    }
    const engagementByDevice = new Map(
      engagement.map((e) => [
        e.deviceCategory,
        {
          bounces: n(e._sum.bounces),
          pageviews: n(e._sum.pageviews),
          durationSeconds: n(e._sum.durationSeconds),
        },
      ]),
    );
    const byDevice: DeviceInput[] = devices.map((d) => ({
      deviceCategory: d.deviceCategory,
      visits: n(d._sum.visits),
      sumDailyUsers: n(d._sum.users),
      matchedAccepted: n(d._sum.orderCreatedReaches),
      goals: deviceGoals.get(d.deviceCategory) ?? new Map(),
      engagement: engagementByDevice.get(d.deviceCategory) ?? null,
    }));

    const landingGoals = new Map<string, Map<string, GoalCount>>();
    for (const r of behaviorLandings) {
      const m =
        landingGoals.get(r.normalizedPath) ?? new Map<string, GoalCount>();
      m.set(r.goalIdentifier, {
        reaches: n(r._sum.reaches),
        visits: n(r._sum.goalVisits),
      });
      landingGoals.set(r.normalizedPath, m);
    }
    const byLanding: LandingInput[] = landings.map((l) => ({
      normalizedPath: l.normalizedPath,
      visits: n(l._sum.visits),
      sumDailyUsers: n(l._sum.users),
      matchedAccepted: n(l._sum.orderCreatedReaches),
      goals: landingGoals.get(l.normalizedPath) ?? new Map(),
    }));

    const paramRows: ParamInput[] = params.map((p) => ({
      deviceCategory: p.deviceCategory,
      key: p.paramKey,
      value: p.paramValue,
      visits: n(p._sum.visits),
      users: n(p._sum.users),
      paramsNumber: n(p._sum.paramsNumber),
    }));

    const pathMap: BehaviorInput['paths'] = {
      entry_lead: [],
      viewed_lead: [],
      exit_all: [],
      exit_nolead: [],
    };
    for (const r of paths) {
      const list = pathMap[r.kind as keyof BehaviorInput['paths']];
      if (!list) continue;
      const row: PathInput = {
        normalizedPath: r.normalizedPath,
        visits: r._sum.visits,
        pageviews: r._sum.pageviews,
        users: n(r._sum.users),
      };
      list.push(row);
    }

    return {
      period,
      visits: n(traffic._sum.visits),
      sumDailyUsers: n(traffic._sum.users),
      periodUsers: snapshot?.users ?? null,
      goalTotals,
      goalUsers,
      byDevice,
      byLanding,
      params: paramRows,
      paths: pathMap,
      behaviorRows,
      freshness: freshnessOf(lastSync?.finishedAt ?? null, this.now()),
    };
  }
}
