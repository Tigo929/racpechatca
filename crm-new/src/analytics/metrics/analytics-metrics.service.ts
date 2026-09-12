import { Injectable } from '@nestjs/common';
import type { PrismaService } from 'src/prisma/prisma.service';
import { EXPECTED_GOAL_IDS } from '../../metrika/analytics/metrika-goal-registry';
import {
  isoToUtcDate,
  utcDateToIso,
} from '../../metrika/analytics/metrika-dates';
import { ReportsService, type PnlReport } from '../../reports/reports.service';
import type { CostSettings } from '../../reports/order-cogs';
import { METRIKA_SCOPE_COUNTER } from './analytics-constants';
import {
  periodBoundsUtc,
  previousPeriod,
  type AnalyticsPeriod,
} from './analytics-period';
import {
  compareComputations,
  computeDevices,
  computeLandings,
  computeOverview,
  computePeriod,
  computeProducts,
  computeSalesChannels,
  computeSources,
  computeUtm,
  freshnessOf,
  withLifecycles,
  type CanonicalGoalIds,
  type CrmOrderInput,
  type MetrikaPeriodInput,
  type OrderWithLifecycle,
  type PeriodComputation,
} from './metrics-compute';
import type {
  ComparisonSet,
  CrmFunnelMetrics,
  CrmSlice,
  DataQualityMetrics,
  DeviceRow,
  LandingRow,
  Overview,
  ProductRow,
  SalesChannelRow,
  SiteFunnelMetrics,
  Slice,
  SourceRow,
  UtmRow,
} from './metrics-contract';

/**
 * Канонический слой бизнес-метрик (этап 08, раздел 37).
 *
 * Единственное место, где формулы дашборда встречаются с данными:
 * локальные таблицы Метрики (этап 07), заказы CRM с историей статусов и
 * P&L отчёта владельца (ReportsService.pnlForRange — та же математика, что
 * в /reports/monthly). Сервис только собирает вход и отдаёт его чистым
 * функциям metrics-compute.ts; никаких запросов к API Яндекса здесь нет —
 * уникальные периода читаются из MetrikaPeriodSnapshot.
 *
 * Запросов к базе — постоянное число на период (заказы одним запросом с
 * историей и позициями, агрегаты Метрики, снимок, последний запуск
 * синхронизации, P&L), без обхода заказов по одному.
 */

/** Номера канонических целей — из GOALS_MANIFEST.md; расхождение с API ловит синхронизация. */
export const DEFAULT_GOAL_IDS: CanonicalGoalIds = {
  lead: EXPECTED_GOAL_IDS.lead,
  created: EXPECTED_GOAL_IDS.crmOrderCreated,
  paid: EXPECTED_GOAL_IDS.crmOrderPaid,
};

export interface MetricsServiceOptions {
  goalIds?: CanonicalGoalIds;
  now?: () => Date;
}

const ORDER_SELECT = {
  id: true,
  createdAt: true,
  status: true,
  productCategory: true,
  sourceOrder: true,
  totalOrder: true,
  clientPaidAt: true,
  completedAt: true,
  statusChangedAt: true,
  sentAt: true,
  yandexClientId: true,
  items: {
    select: {
      formatPaper: true,
      quantity: true,
      pricePosition: true,
      printOnClientItem: true,
      thermalCost: true,
    },
  },
  tshirtItems: {
    select: {
      pricePosition: true,
      quantity: true,
      designCost: true,
      thermalCost: true,
      blankCost: true,
      clientItem: true,
    },
  },
  canvasItems: { select: { contractorCostPosition: true } },
  statusHistory: {
    select: { fromStatus: true, toStatus: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
  metrikaOutbox: {
    where: { status: 'delivered' },
    select: { id: true },
    take: 1,
  },
} as const;

@Injectable()
export class AnalyticsMetricsService {
  private readonly goalIds: CanonicalGoalIds;
  private readonly now: () => Date;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    options: MetricsServiceOptions = {},
  ) {
    this.goalIds = options.goalIds ?? DEFAULT_GOAL_IDS;
    this.now = options.now ?? (() => new Date());
  }

  async getOverview(
    period: AnalyticsPeriod,
    withComparison = true,
  ): Promise<Overview> {
    const prev = previousPeriod(period);
    const [orders, settings, lastSync, current, previous] = await Promise.all([
      this.loadOrders(periodBoundsUtc(period).endExclusive),
      this.reports.costSettings(),
      this.lastMetrikaSyncAt(),
      this.loadPeriod(period),
      withComparison ? this.loadPeriod(prev) : Promise.resolve(undefined),
    ]);
    return computeOverview({
      period,
      previousPeriod: prev,
      now: this.now(),
      goalIds: this.goalIds,
      settings,
      lastMetrikaSyncAt: lastSync,
      current,
      previous,
      orders,
    });
  }

  async getFunnel(
    period: AnalyticsPeriod,
  ): Promise<{ site: SiteFunnelMetrics; crm: CrmFunnelMetrics }> {
    const c = await this.computeOne(period);
    return { site: c.siteFunnel, crm: c.crmFunnel };
  }

  async getDataQuality(period: AnalyticsPeriod): Promise<DataQualityMetrics> {
    return (await this.computeOne(period)).dataQuality;
  }

  async getComparison(
    period: AnalyticsPeriod,
    previous: AnalyticsPeriod = previousPeriod(period),
  ): Promise<{
    current: PeriodComputation;
    previous: PeriodComputation;
    comparison: ComparisonSet;
  }> {
    const [orders, settings, lastSync, cur, prev] = await Promise.all([
      this.loadOrders(
        periodBoundsUtc(period.to > previous.to ? period : previous)
          .endExclusive,
      ),
      this.reports.costSettings(),
      this.lastMetrikaSyncAt(),
      this.loadPeriod(period),
      this.loadPeriod(previous),
    ]);
    const all = withLifecycles(orders);
    const freshness = freshnessOf(lastSync, this.now());
    const current = computePeriod(
      period,
      cur.metrika,
      cur.pnl,
      all,
      this.goalIds,
      settings,
      freshness,
    );
    const before = computePeriod(
      previous,
      prev.metrika,
      prev.pnl,
      all,
      this.goalIds,
      settings,
      freshness,
    );
    return {
      current,
      previous: before,
      comparison: compareComputations(current, before),
    };
  }

  async getTrafficSources(period: AnalyticsPeriod): Promise<Slice<SourceRow>> {
    const rows = await this.prisma.metrikaDailySource.findMany({
      where: { date: this.dateWhere(period) },
      select: {
        date: true,
        trafficSource: true,
        trafficSourceName: true,
        sourceEngine: true,
        sourceEngineName: true,
        visits: true,
        pageviews: true,
        leadReaches: true,
        orderCreatedReaches: true,
        orderPaidReaches: true,
      },
    });
    return computeSources(
      rows.map((r) => ({ ...r, date: utcDateToIso(r.date) })),
      period,
    );
  }

  async getUtm(period: AnalyticsPeriod): Promise<Slice<UtmRow>> {
    const rows = await this.prisma.metrikaDailyUtm.findMany({
      where: { date: this.dateWhere(period) },
      select: {
        date: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        utmTerm: true,
        visits: true,
        leadReaches: true,
        orderCreatedReaches: true,
        orderPaidReaches: true,
      },
    });
    return computeUtm(
      rows.map((r) => ({ ...r, date: utcDateToIso(r.date) })),
      period,
    );
  }

  async getLandings(period: AnalyticsPeriod): Promise<Slice<LandingRow>> {
    const rows = await this.prisma.metrikaDailyLanding.findMany({
      where: { date: this.dateWhere(period) },
      select: {
        date: true,
        normalizedPath: true,
        visits: true,
        leadReaches: true,
        orderCreatedReaches: true,
        orderPaidReaches: true,
      },
    });
    return computeLandings(
      rows.map((r) => ({ ...r, date: utcDateToIso(r.date) })),
      period,
    );
  }

  async getDevices(period: AnalyticsPeriod): Promise<Slice<DeviceRow>> {
    const rows = await this.prisma.metrikaDailyDevice.findMany({
      where: { date: this.dateWhere(period) },
      select: {
        date: true,
        deviceCategory: true,
        visits: true,
        leadReaches: true,
        orderCreatedReaches: true,
        orderPaidReaches: true,
      },
    });
    return computeDevices(
      rows.map((r) => ({ ...r, date: utcDateToIso(r.date) })),
      period,
    );
  }

  async getProducts(period: AnalyticsPeriod): Promise<CrmSlice<ProductRow>> {
    const [orders, settings] = await Promise.all([
      this.loadOrders(periodBoundsUtc(period).endExclusive),
      this.reports.costSettings(),
    ]);
    return computeProducts(withLifecycles(orders), period, settings);
  }

  async getSalesChannels(
    period: AnalyticsPeriod,
  ): Promise<CrmSlice<SalesChannelRow>> {
    const orders = await this.loadOrders(periodBoundsUtc(period).endExclusive);
    return computeSalesChannels(withLifecycles(orders), period);
  }

  // ---------------------------------------------------------------------------

  private async computeOne(
    period: AnalyticsPeriod,
  ): Promise<PeriodComputation> {
    const [orders, settings, lastSync, cur] = await Promise.all([
      this.loadOrders(periodBoundsUtc(period).endExclusive),
      this.reports.costSettings(),
      this.lastMetrikaSyncAt(),
      this.loadPeriod(period),
    ]);
    return computePeriod(
      period,
      cur.metrika,
      cur.pnl,
      withLifecycles(orders),
      this.goalIds,
      settings,
      freshnessOf(lastSync, this.now()),
    );
  }

  private dateWhere(period: AnalyticsPeriod) {
    return { gte: isoToUtcDate(period.from), lte: isoToUtcDate(period.to) };
  }

  /**
   * Заказы, созданные до конца периода: у любого из них принятие, оплата
   * или отмена могли случиться внутри периода. Один запрос с историей,
   * позициями и признаком доставки в Метрику.
   */
  async loadOrders(createdBefore: Date): Promise<CrmOrderInput[]> {
    const rows = await this.prisma.orderPhoto.findMany({
      where: { createdAt: { lt: createdBefore } },
      select: ORDER_SELECT,
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      status: r.status,
      productCategory: r.productCategory,
      sourceOrder: r.sourceOrder,
      totalOrder: r.totalOrder,
      clientPaidAt: r.clientPaidAt,
      completedAt: r.completedAt,
      statusChangedAt: r.statusChangedAt,
      sentAt: r.sentAt,
      yandexClientId: r.yandexClientId,
      items: r.items,
      tshirtItems: r.tshirtItems,
      canvasItems: r.canvasItems,
      statusHistory: r.statusHistory,
      deliveredToMetrika: r.metrikaOutbox.length > 0,
    }));
  }

  /** Локальные данные Метрики и P&L за один период. */
  async loadPeriod(
    period: AnalyticsPeriod,
  ): Promise<{ metrika: MetrikaPeriodInput; pnl: PnlReport | null }> {
    const where = { date: this.dateWhere(period) };
    const bounds = periodBoundsUtc(period);
    const [traffic, goals, pages, snapshot, pnl] = await Promise.all([
      this.prisma.metrikaDailyTraffic.findMany({
        where,
        select: { date: true, visits: true, users: true, pageviews: true },
      }),
      this.prisma.metrikaDailyGoal.findMany({
        where: {
          ...where,
          goalId: {
            in: [this.goalIds.lead, this.goalIds.created, this.goalIds.paid],
          },
        },
        select: { date: true, goalId: true, reaches: true },
      }),
      this.prisma.metrikaDailyPage.aggregate({
        where,
        _sum: { pageviews: true },
      }),
      this.prisma.metrikaPeriodSnapshot.findUnique({
        where: {
          periodStart_periodEnd_metricScope: {
            periodStart: isoToUtcDate(period.from),
            periodEnd: isoToUtcDate(period.to),
            metricScope: METRIKA_SCOPE_COUNTER,
          },
        },
      }),
      this.reports.pnlForRange(bounds.start, bounds.endExclusive),
    ]);
    return {
      metrika: {
        traffic: traffic.map((r) => ({ ...r, date: utcDateToIso(r.date) })),
        goals: goals.map((r) => ({ ...r, date: utcDateToIso(r.date) })),
        pagesPageviews: pages._sum.pageviews ?? 0,
        snapshot: snapshot
          ? {
              users: snapshot.users,
              visits: snapshot.visits,
              pageviews: snapshot.pageviews,
              fetchedAt: snapshot.fetchedAt,
              sampled: snapshot.sampled,
            }
          : null,
      },
      pnl,
    };
  }

  async lastMetrikaSyncAt(): Promise<Date | null> {
    const run = await this.prisma.metrikaSyncRun.findFirst({
      where: { status: 'SUCCESS', finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true },
    });
    return run?.finishedAt ?? null;
  }

  /** Для сверок: сами настройки себестоимости и P&L за границы периода. */
  async pnlFor(period: AnalyticsPeriod): Promise<PnlReport> {
    const bounds = periodBoundsUtc(period);
    return this.reports.pnlForRange(bounds.start, bounds.endExclusive);
  }

  async settings(): Promise<CostSettings> {
    return this.reports.costSettings();
  }

  async lifecycles(period: AnalyticsPeriod): Promise<OrderWithLifecycle[]> {
    return withLifecycles(
      await this.loadOrders(periodBoundsUtc(period).endExclusive),
    );
  }
}
