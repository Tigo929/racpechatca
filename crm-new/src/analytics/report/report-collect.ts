import type { PrismaService } from '../../prisma/prisma.service';
import type { ReportsService } from '../../reports/reports.service';
import type { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import {
  calendarMonth,
  customPeriod,
  periodBoundsUtc,
  previousPeriod,
  type AnalyticsPeriod,
} from '../metrics/analytics-period';
import { addDays, calendarDateIn } from '../../metrika/analytics/metrika-dates';
import type {
  AttributionInput,
  GrowthInput,
  InsightInput,
  PeriodSnapshot,
  ReconciliationInput,
  ReportInput,
  SyncInput,
} from './report-contract';

/**
 * Сбор данных для отчёта (этап 15). Только чтение и только через уже принятые
 * источники: сервис метрик этапа 08, отчёт P&L владельца и прямые SELECT по
 * колонкам заказа для атрибуции и очереди.
 *
 * Здесь намеренно нет ни одной бизнес-формулы: всё, что можно спросить у
 * сервиса, спрашивается у сервиса — иначе отчёт разойдётся с дашбордом,
 * и доверять будет нечему.
 */

export interface CollectDeps {
  prisma: PrismaService;
  metrics: AnalyticsMetricsService;
  reports: ReportsService;
}

export interface CollectOptions {
  /** Длина текущего периода в днях (по умолчанию 7). */
  days?: number;
  /** Последний полный день; по умолчанию — вчера по Москве. */
  until?: string;
  /** Глубина дневного ряда для трендов и прогноза. */
  historyDays?: number;
  now?: Date;
  build?: string | null;
}

/** Последний полностью завершённый московский день. */
export function lastCompleteDay(now: Date): string {
  return addDays(calendarDateIn(now), -1);
}

function periodEndingAt(to: string, days: number): AnalyticsPeriod {
  return customPeriod(addDays(to, -(days - 1)), to);
}

async function snapshot(
  metrics: AnalyticsMetricsService,
  period: AnalyticsPeriod,
): Promise<PeriodSnapshot> {
  const overview = await metrics.getOverview(period);
  return { period, overview, dataQuality: overview.dataQuality };
}

async function attribution(
  prisma: PrismaService,
  period: AnalyticsPeriod,
): Promise<AttributionInput> {
  const { start, endExclusive } = periodBoundsUtc(period);
  const where = { createdAt: { gte: start, lt: endExclusive } };
  const notNull = (field: string) => ({ ...where, [field]: { not: null } });
  const [
    totalOrders,
    withClientId,
    withYclid,
    withUtm,
    withConversionPage,
    withFirstTouch,
    grouped,
  ] = await Promise.all([
    prisma.orderPhoto.count({ where }),
    prisma.orderPhoto.count({ where: notNull('yandexClientId') }),
    prisma.orderPhoto.count({ where: notNull('yclid') }),
    prisma.orderPhoto.count({ where: notNull('utmSource') }),
    prisma.orderPhoto.count({ where: notNull('conversionPageUrl') }),
    prisma.orderPhoto.count({ where: notNull('firstTouchUrl') }),
    prisma.orderPhoto.groupBy({
      by: ['sourceOrder'],
      where,
      _count: { _all: true },
    }),
  ]);

  const bySource = await Promise.all(
    grouped.map(async (g) => ({
      source: String(g.sourceOrder),
      orders: g._count._all,
      withAnyAttribution: await prisma.orderPhoto.count({
        where: {
          ...where,
          sourceOrder: g.sourceOrder,
          OR: [
            { yandexClientId: { not: null } },
            { yclid: { not: null } },
            { utmSource: { not: null } },
            { conversionPageUrl: { not: null } },
          ],
        },
      }),
    })),
  );

  return {
    totalOrders,
    withClientId,
    withYclid,
    withUtm,
    withConversionPage,
    withFirstTouch,
    bySource: bySource.sort((a, b) => b.orders - a.orders),
  };
}

async function sync(prisma: PrismaService): Promise<SyncInput> {
  const [groups, skipGroups, delivered, lastDelivered, dupKeys, dupPurchases] =
    await Promise.all([
      prisma.metrikaOrderOutbox.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.metrikaOrderOutbox.groupBy({
        by: ['skipReason'],
        where: { status: 'skipped' },
        _count: { _all: true },
      }),
      prisma.metrikaOrderOutbox.findMany({
        where: { status: 'delivered' },
        select: { remoteUploadingId: true, apiValidationStatus: true },
      }),
      prisma.metrikaOrderOutbox.findFirst({
        where: { status: 'delivered' },
        orderBy: { processedAt: 'desc' },
        select: { processedAt: true },
      }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count FROM (
          SELECT "dedupeKey" FROM "MetrikaOrderOutbox" GROUP BY 1 HAVING count(*) > 1
        ) x`,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count FROM (
          SELECT "orderId" FROM "MetrikaOrderOutbox"
          WHERE status = 'delivered' AND "sentMetrikaStatus" = 'PAID'
          GROUP BY 1 HAVING count(*) > 1
        ) x`,
    ]);

  const count = (status: string) =>
    groups.find((g) => g.status === status)?._count._all ?? 0;

  return {
    delivered: count('delivered'),
    skipped: count('skipped'),
    pending: count('pending'),
    processing: count('processing'),
    failed: count('failed'),
    skipReasons: skipGroups
      .map((g) => ({
        reason: g.skipReason ?? '(без причины)',
        rows: g._count._all,
      }))
      .sort((a, b) => b.rows - a.rows),
    deliveredWithUploadingId: delivered.filter((r) => r.remoteUploadingId)
      .length,
    validationPassed: delivered.filter(
      (r) => r.apiValidationStatus === 'PASSED',
    ).length,
    duplicateDedupeKeys: Number(dupKeys[0]?.count ?? 0),
    duplicatePurchasesPerOrder: Number(dupPurchases[0]?.count ?? 0),
    lastDeliveredAt: lastDelivered?.processedAt ?? null,
  };
}

async function growth(prisma: PrismaService): Promise<GrowthInput> {
  const changes = await prisma.analyticsChange.findMany({
    orderBy: { startedAt: 'desc' },
    select: { id: true, name: true, status: true, startedAt: true },
  });
  const withEvaluations = await Promise.all(
    changes.map(async (c) => {
      const latest = await prisma.analyticsChangeEvaluation.findFirst({
        where: { changeId: c.id },
        orderBy: { version: 'desc' },
        select: {
          version: true,
          evaluatedAt: true,
          trigger: true,
          verdict: true,
          maturity: true,
          primaryMetric: true,
          result: true,
        },
      });
      const result = (latest?.result ?? {}) as {
        FACT?: string;
        causality?: string;
      };
      return {
        name: c.name,
        status: c.status,
        startedAt: c.startedAt,
        latest: latest
          ? {
              version: latest.version,
              evaluatedAt: latest.evaluatedAt,
              trigger: latest.trigger,
              verdict: latest.verdict,
              maturity: latest.maturity,
              primaryMetric: latest.primaryMetric,
              causality: result.causality ?? 'NOT_ESTABLISHED',
              fact: result.FACT ?? '—',
            }
          : null,
      };
    }),
  );
  return { changes: withEvaluations };
}

/** Текст факта карточки: в payload лежит объект, нас интересует только строка. */
function factText(fact: unknown): string | null {
  if (!fact || typeof fact !== 'object') return null;
  const text = (fact as { text?: unknown }).text;
  return typeof text === 'string' ? text : null;
}

async function insights(prisma: PrismaService): Promise<InsightInput[]> {
  const rows = await prisma.analyticsInsight.findMany({
    orderBy: [{ severity: 'asc' }, { updatedAt: 'desc' }],
    take: 30,
    select: {
      detectorId: true,
      status: true,
      latestVersion: true,
      title: true,
      fact: true,
    },
  });
  return rows.map((r) => ({
    detectorId: r.detectorId,
    status: r.status,
    version: r.latestVersion,
    title: r.title,
    fact: factText(r.fact),
  }));
}

async function reconciliation(
  metrics: AnalyticsMetricsService,
  reports: ReportsService,
  current: PeriodSnapshot,
  currentTrendSum: number | null,
  monthPeriod: AnalyticsPeriod | null,
): Promise<ReconciliationInput> {
  let monthlyPnl: ReconciliationInput['monthlyPnl'] = null;
  if (monthPeriod) {
    const [year, month] = monthPeriod.from.split('-').map(Number);
    const servicePnl = await metrics.getOverview(monthPeriod);
    const report = await reports.getMonthlyReport(year);
    const row = report.months?.find((m) => m.month === month);
    if (row) {
      monthlyPnl = {
        month: `${String(month).padStart(2, '0')}.${year}`,
        serviceRevenue: servicePnl.financials.realized?.realizedRevenue ?? null,
        reportRevenue: row.totalRevenue,
        serviceNetProfit: servicePnl.financials.realized?.netProfit ?? null,
        reportNetProfit: row.netProfit,
        serviceCogs: servicePnl.financials.realized?.cogs ?? null,
        reportCogs: row.cogs,
      };
    }
  }
  return {
    trendSumRealizedRevenue: currentTrendSum,
    overviewRealizedRevenue:
      current.overview.financials.realized?.realizedRevenue ?? null,
    monthlyPnl,
  };
}

export async function collectReport(
  deps: CollectDeps,
  options: CollectOptions = {},
): Promise<ReportInput> {
  const now = options.now ?? new Date();
  const days = options.days ?? 7;
  const until = options.until ?? lastCompleteDay(now);
  const historyDays = options.historyDays ?? 84;

  const currentPeriod = periodEndingAt(until, days);
  const prevPeriod = previousPeriod(currentPeriod);
  const avgPeriod = periodEndingAt(until, 30);
  const [y, m] = until.split('-').map(Number);
  const monthRange = calendarMonth(y, m);
  const monthPeriod = customPeriod(monthRange.from, monthRange.to);
  const prevMonthRange = calendarMonth(
    m === 1 ? y - 1 : y,
    m === 1 ? 12 : m - 1,
  );
  const prevMonthPeriod = customPeriod(prevMonthRange.from, prevMonthRange.to);
  const historyPeriod = periodEndingAt(until, historyDays);

  const [current, previous, average30, month, previousMonth] =
    await Promise.all([
      snapshot(deps.metrics, currentPeriod),
      snapshot(deps.metrics, prevPeriod),
      snapshot(deps.metrics, avgPeriod),
      snapshot(deps.metrics, monthPeriod),
      snapshot(deps.metrics, prevMonthPeriod),
    ]);

  const [
    currentTrend,
    history,
    sources,
    utm,
    landings,
    products,
    salesChannels,
  ] = await Promise.all([
    deps.metrics.getTrend(currentPeriod),
    deps.metrics.getTrend(historyPeriod),
    deps.metrics.getTrafficSources(currentPeriod),
    deps.metrics.getUtm(currentPeriod),
    deps.metrics.getLandings(currentPeriod),
    deps.metrics.getProducts(currentPeriod),
    deps.metrics.getSalesChannels(currentPeriod),
  ]);

  const trendSum = currentTrend.points.reduce(
    (s, p) => s + (p.realizedRevenue ?? 0),
    0,
  );

  const [attr, syncState, growthState, insightCards, recon] = await Promise.all(
    [
      attribution(deps.prisma, currentPeriod),
      sync(deps.prisma),
      growth(deps.prisma),
      insights(deps.prisma),
      reconciliation(
        deps.metrics,
        deps.reports,
        current,
        trendSum,
        monthPeriod,
      ),
    ],
  );

  return {
    generatedAt: now,
    build: options.build ?? process.env.BUILD_SHA ?? null,
    current,
    previous,
    average30,
    month,
    previousMonth,
    daily: history.points,
    sources,
    utm,
    landings,
    products,
    salesChannels,
    attribution: attr,
    sync: syncState,
    growth: growthState,
    insights: insightCards,
    reconciliation: recon,
  };
}
