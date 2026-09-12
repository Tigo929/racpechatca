import type { PrismaClient } from '../../generated/prisma/client.js';
import type { YandexMetrikaClient } from '../metrika-api.client';
import { normalizeMetrikaStatus } from '../orders/metrika-order-status';
import {
  COUNTER_TIME_ZONE,
  eachDay,
  isoToUtcDate,
  utcDateToIso,
  type DateRange,
  type IsoDate,
} from './metrika-dates';
import {
  EXPECTED_GOAL_IDS,
  resolveCanonicalGoals,
  type CanonicalGoalRegistry,
} from './metrika-goal-registry';
import {
  ALL_DATASETS,
  goalMetric,
  type MetrikaDataset,
} from './metrika-query-catalog';

/**
 * Чтение и проверка локального слоя (этап 07, разделы 25, 26, 29):
 * состояние синхронизации, отчёт о качестве данных, сверка с прямым
 * запросом к API и покрытие заказов CRM целями Метрики. Всё — только
 * чтение; используется командой `metrika:sync`.
 */

/** Контрольный заказ этапа 06: не естественный переход, в сверках отмечается отдельно. */
export const CONTROLLED_STAGE06_TEST_ORDER_ID =
  'f40a79d6-7a3b-4a5c-9ced-c441449fe2f0';
/** С этого момента заказы CRM уходят в Метрику через очередь (PHASE H, 12.09.2026 12:20 MSK). */
export const CRM_TO_METRIKA_LIVE_SINCE = new Date('2026-09-12T09:20:10.000Z');

type Db = PrismaClient;

function dateWhere(range: DateRange) {
  return { gte: isoToUtcDate(range.from), lte: isoToUtcDate(range.to) };
}

/** Границы календарного дня Москвы в UTC: сутки Метрики — с 21:00 UTC предыдущего дня. */
export function moscowDayBoundsUtc(range: DateRange): { gte: Date; lt: Date } {
  const offsetMs = 3 * 3_600_000;
  return {
    gte: new Date(isoToUtcDate(range.from).getTime() - offsetMs),
    lt: new Date(isoToUtcDate(range.to).getTime() + 86_400_000 - offsetMs),
  };
}

// ---------------------------------------------------------------------------
// Реестр целей для чтения: живой, если клиент настроен, иначе ожидаемый.

export async function registryForReading(
  client: YandexMetrikaClient | null,
): Promise<{ registry: CanonicalGoalRegistry; source: string }> {
  if (client?.isConfigured()) {
    const goals = await client.getGoals();
    return {
      registry: resolveCanonicalGoals(goals).registry,
      source: `Management API (${goals.length} целей)`,
    };
  }
  return {
    registry: {
      canonicalLeadGoalId: EXPECTED_GOAL_IDS.lead,
      photoLeadGoalId: EXPECTED_GOAL_IDS.photoLead,
      canvasLeadGoalId: EXPECTED_GOAL_IDS.canvasLead,
      tshirtLeadGoalId: EXPECTED_GOAL_IDS.tshirtLead,
      formErrorGoalId: EXPECTED_GOAL_IDS.formError,
      crmOrderCreatedGoalId: EXPECTED_GOAL_IDS.crmOrderCreated,
      crmOrderPaidGoalId: EXPECTED_GOAL_IDS.crmOrderPaid,
      crmOrderCancelledGoalId: EXPECTED_GOAL_IDS.crmOrderCancelled,
      crmOrderSpamGoalId: EXPECTED_GOAL_IDS.crmOrderSpam,
      legacyThanksGoalId: EXPECTED_GOAL_IDS.legacyThanks,
    },
    source:
      'GOALS_MANIFEST.md (клиент не настроен — живой список целей недоступен)',
  };
}

// ---------------------------------------------------------------------------
// Состояние

export interface DatasetState {
  dataset: MetrikaDataset;
  rows: number;
  minDate: IsoDate | null;
  maxDate: IsoDate | null;
  lastRun: {
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    range: DateRange;
    rowsStored: number;
    requestCount: number;
    sampled: boolean | null;
    trigger: string;
    lastError: string | null;
  } | null;
}

async function tableState(
  db: Db,
  dataset: MetrikaDataset,
): Promise<{ rows: number; min: Date | null; max: Date | null }> {
  switch (dataset) {
    case 'traffic': {
      const a = await db.metrikaDailyTraffic.aggregate({
        _count: true,
        _min: { date: true },
        _max: { date: true },
      });
      return { rows: a._count, min: a._min.date, max: a._max.date };
    }
    case 'goals': {
      const a = await db.metrikaDailyGoal.aggregate({
        _count: true,
        _min: { date: true },
        _max: { date: true },
      });
      return { rows: a._count, min: a._min.date, max: a._max.date };
    }
    case 'sources': {
      const a = await db.metrikaDailySource.aggregate({
        _count: true,
        _min: { date: true },
        _max: { date: true },
      });
      return { rows: a._count, min: a._min.date, max: a._max.date };
    }
    case 'utm': {
      const a = await db.metrikaDailyUtm.aggregate({
        _count: true,
        _min: { date: true },
        _max: { date: true },
      });
      return { rows: a._count, min: a._min.date, max: a._max.date };
    }
    case 'landings': {
      const a = await db.metrikaDailyLanding.aggregate({
        _count: true,
        _min: { date: true },
        _max: { date: true },
      });
      return { rows: a._count, min: a._min.date, max: a._max.date };
    }
    case 'devices': {
      const a = await db.metrikaDailyDevice.aggregate({
        _count: true,
        _min: { date: true },
        _max: { date: true },
      });
      return { rows: a._count, min: a._min.date, max: a._max.date };
    }
    case 'pages': {
      const a = await db.metrikaDailyPage.aggregate({
        _count: true,
        _min: { date: true },
        _max: { date: true },
      });
      return { rows: a._count, min: a._min.date, max: a._max.date };
    }
  }
}

export async function datasetStates(db: Db): Promise<DatasetState[]> {
  const out: DatasetState[] = [];
  for (const dataset of ALL_DATASETS) {
    const t = await tableState(db, dataset);
    const run = await db.metrikaSyncRun.findFirst({
      where: { dataset },
      orderBy: { startedAt: 'desc' },
    });
    out.push({
      dataset,
      rows: t.rows,
      minDate: t.min ? utcDateToIso(t.min) : null,
      maxDate: t.max ? utcDateToIso(t.max) : null,
      lastRun: run
        ? {
            status: run.status,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            range: {
              from: utcDateToIso(run.dateFrom),
              to: utcDateToIso(run.dateTo),
            },
            rowsStored: run.rowsStored,
            requestCount: run.requestCount,
            sampled: run.sampled,
            trigger: run.trigger,
            lastError: run.lastError,
          }
        : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Локальные суммы за период

export interface LocalTotals {
  visits: number;
  usersDailySum: number;
  pageviews: number;
  leadReaches: number | null;
  orderCreatedReaches: number | null;
  orderPaidReaches: number | null;
  /** Суммы визитов по другим наборам — должны сходиться с трафиком. */
  sourcesVisits: number;
  utmVisits: number;
  landingsVisits: number;
  devicesVisits: number;
  pagesPageviews: number;
}

async function goalSum(
  db: Db,
  range: DateRange,
  goalId: number | null,
): Promise<number | null> {
  if (goalId === null) return null;
  const a = await db.metrikaDailyGoal.aggregate({
    where: { date: dateWhere(range), goalId },
    _sum: { reaches: true },
  });
  return a._sum.reaches ?? 0;
}

export async function localTotals(
  db: Db,
  range: DateRange,
  registry: CanonicalGoalRegistry,
): Promise<LocalTotals> {
  const where = { date: dateWhere(range) };
  const t = await db.metrikaDailyTraffic.aggregate({
    where,
    _sum: { visits: true, users: true, pageviews: true },
  });
  const s = await db.metrikaDailySource.aggregate({
    where,
    _sum: { visits: true },
  });
  const u = await db.metrikaDailyUtm.aggregate({
    where,
    _sum: { visits: true },
  });
  const l = await db.metrikaDailyLanding.aggregate({
    where,
    _sum: { visits: true },
  });
  const d = await db.metrikaDailyDevice.aggregate({
    where,
    _sum: { visits: true },
  });
  const p = await db.metrikaDailyPage.aggregate({
    where,
    _sum: { pageviews: true },
  });
  return {
    visits: t._sum.visits ?? 0,
    usersDailySum: t._sum.users ?? 0,
    pageviews: t._sum.pageviews ?? 0,
    leadReaches: await goalSum(db, range, registry.canonicalLeadGoalId),
    orderCreatedReaches: await goalSum(
      db,
      range,
      registry.crmOrderCreatedGoalId,
    ),
    orderPaidReaches: await goalSum(db, range, registry.crmOrderPaidGoalId),
    sourcesVisits: s._sum.visits ?? 0,
    utmVisits: u._sum.visits ?? 0,
    landingsVisits: l._sum.visits ?? 0,
    devicesVisits: d._sum.visits ?? 0,
    pagesPageviews: p._sum.pageviews ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Сверка с прямым запросом к API

export interface ReconcileLine {
  metric: string;
  local: number | null;
  direct: number | null;
  difference: number | null;
}

export interface ReconcileResult {
  lines: ReconcileLine[];
  /** Уникальные посетители за период целиком — другая семантика, справочно. */
  directUsersPeriod: number | null;
  sampled: boolean;
  requests: number;
}

export async function reconcile(
  db: Db,
  client: YandexMetrikaClient,
  range: DateRange,
  registry: CanonicalGoalRegistry,
): Promise<ReconcileResult> {
  const local = await localTotals(db, range, registry);
  const goalIds = [
    registry.canonicalLeadGoalId,
    registry.crmOrderCreatedGoalId,
    registry.crmOrderPaidGoalId,
  ];
  const metrics = [
    'ym:s:visits',
    'ym:s:users',
    'ym:s:pageviews',
    ...goalIds.map((id) => (id === null ? null : goalMetric(id, 'reaches'))),
  ];
  const asked = metrics.filter((m): m is string => m !== null);

  const daily = await client.getStats({
    metrics: asked,
    dimensions: ['ym:s:date'],
    date1: range.from,
    date2: range.to,
    limit: 100_000,
  });
  const sums = new Array<number>(asked.length).fill(0);
  for (const row of daily.data)
    row.metrics.forEach((v, i) => (sums[i] += Math.round(Number(v ?? 0))));
  const period = await client.getStats({
    metrics: ['ym:s:users'],
    date1: range.from,
    date2: range.to,
  });
  const pv = await client.getStats({
    metrics: ['ym:pv:pageviews'],
    date1: range.from,
    date2: range.to,
  });

  let i = 0;
  const next = (present: boolean) => (present ? sums[i++] : null);
  const line = (
    metric: string,
    localValue: number | null,
    direct: number | null,
  ): ReconcileLine => ({
    metric,
    local: localValue,
    direct,
    difference:
      localValue === null || direct === null ? null : localValue - direct,
  });
  const lines: ReconcileLine[] = [
    line('visits (сумма по дням)', local.visits, next(true)),
    line('users (сумма дневных уникальных)', local.usersDailySum, next(true)),
    line('pageviews (ym:s, сумма по дням)', local.pageviews, next(true)),
    line(
      'lead_submitted reaches',
      local.leadReaches,
      next(goalIds[0] !== null),
    ),
    line(
      'CRM: Заказ создан reaches',
      local.orderCreatedReaches,
      next(goalIds[1] !== null),
    ),
    line(
      'CRM: Заказ оплачен reaches',
      local.orderPaidReaches,
      next(goalIds[2] !== null),
    ),
    line(
      'pageviews (ym:pv, набор pages)',
      local.pagesPageviews,
      Math.round(Number(pv.totals?.[0] ?? 0)),
    ),
    line('visits по источникам = трафик', local.sourcesVisits, local.visits),
    line('visits по UTM = трафик', local.utmVisits, local.visits),
    line(
      'visits по страницам входа = трафик',
      local.landingsVisits,
      local.visits,
    ),
    line('visits по устройствам = трафик', local.devicesVisits, local.visits),
  ];
  return {
    lines,
    directUsersPeriod: Math.round(Number(period.totals?.[0] ?? 0)),
    sampled:
      daily.sampled === true || period.sampled === true || pv.sampled === true,
    requests: 3,
  };
}

// ---------------------------------------------------------------------------
// Качество данных

export interface QualityReport {
  range: DateRange;
  earliestDate: IsoDate | null;
  latestDate: IsoDate | null;
  rowsPerDataset: Record<MetrikaDataset, number>;
  sampledRuns: {
    dataset: string;
    range: DateRange;
    sampleShare: number | null;
  }[];
  zeroTrafficDays: IsoDate[];
  emptySourceRows: { rows: number; visits: number };
  emptyUtmRows: { rows: number; visits: number; totalVisits: number };
  topSources: { source: string; engine: string; visits: number }[];
  topUtmCampaigns: {
    source: string;
    medium: string;
    campaign: string;
    visits: number;
  }[];
  topLandings: { path: string; visits: number }[];
  leadReaches: number | null;
  orderCreatedReaches: number | null;
  orderPaidReaches: number | null;
  failedRuns: { dataset: string; startedAt: Date; error: string | null }[];
}

export async function dataQuality(
  db: Db,
  range: DateRange,
  registry: CanonicalGoalRegistry,
): Promise<QualityReport> {
  const where = { date: dateWhere(range) };
  const rowsPerDataset = {} as Record<MetrikaDataset, number>;
  rowsPerDataset.traffic = await db.metrikaDailyTraffic.count({ where });
  rowsPerDataset.goals = await db.metrikaDailyGoal.count({ where });
  rowsPerDataset.sources = await db.metrikaDailySource.count({ where });
  rowsPerDataset.utm = await db.metrikaDailyUtm.count({ where });
  rowsPerDataset.landings = await db.metrikaDailyLanding.count({ where });
  rowsPerDataset.devices = await db.metrikaDailyDevice.count({ where });
  rowsPerDataset.pages = await db.metrikaDailyPage.count({ where });

  const traffic = await db.metrikaDailyTraffic.findMany({
    where,
    orderBy: { date: 'asc' },
  });
  const withVisits = new Set(
    traffic.filter((t) => t.visits > 0).map((t) => utcDateToIso(t.date)),
  );
  const zeroTrafficDays = eachDay(range.from, range.to).filter(
    (d) => !withVisits.has(d),
  );

  const runs = await db.metrikaSyncRun.findMany({
    where: {
      dateFrom: { lte: isoToUtcDate(range.to) },
      dateTo: { gte: isoToUtcDate(range.from) },
    },
    orderBy: { startedAt: 'desc' },
  });
  const sampledRuns = runs
    .filter((r) => r.sampled === true)
    .map((r) => ({
      dataset: r.dataset,
      range: { from: utcDateToIso(r.dateFrom), to: utcDateToIso(r.dateTo) },
      sampleShare: r.sampleShare,
    }));
  const failedRuns = runs
    .filter((r) => r.status === 'FAILED')
    .map((r) => ({
      dataset: r.dataset,
      startedAt: r.startedAt,
      error: r.lastError,
    }));

  const emptySrc = await db.metrikaDailySource.aggregate({
    where: { ...where, trafficSource: '' },
    _count: true,
    _sum: { visits: true },
  });
  const emptyUtm = await db.metrikaDailyUtm.aggregate({
    where: { ...where, utmSource: '' },
    _count: true,
    _sum: { visits: true },
  });
  const allUtm = await db.metrikaDailyUtm.aggregate({
    where,
    _sum: { visits: true },
  });

  const topSources = (
    await db.metrikaDailySource.groupBy({
      by: ['trafficSource', 'sourceEngine'],
      where,
      _sum: { visits: true },
      orderBy: { _sum: { visits: 'desc' } },
      take: 10,
    })
  ).map((g) => ({
    source: g.trafficSource || '—',
    engine: g.sourceEngine || '—',
    visits: g._sum.visits ?? 0,
  }));
  const topUtmCampaigns = (
    await db.metrikaDailyUtm.groupBy({
      by: ['utmSource', 'utmMedium', 'utmCampaign'],
      where: { ...where, NOT: { utmSource: '' } },
      _sum: { visits: true },
      orderBy: { _sum: { visits: 'desc' } },
      take: 10,
    })
  ).map((g) => ({
    source: g.utmSource,
    medium: g.utmMedium || '—',
    campaign: g.utmCampaign || '—',
    visits: g._sum.visits ?? 0,
  }));
  const topLandings = (
    await db.metrikaDailyLanding.groupBy({
      by: ['normalizedPath'],
      where,
      _sum: { visits: true },
      orderBy: { _sum: { visits: 'desc' } },
      take: 10,
    })
  ).map((g) => ({ path: g.normalizedPath, visits: g._sum.visits ?? 0 }));

  return {
    range,
    earliestDate: traffic[0] ? utcDateToIso(traffic[0].date) : null,
    latestDate:
      traffic.length > 0
        ? utcDateToIso(traffic[traffic.length - 1].date)
        : null,
    rowsPerDataset,
    sampledRuns,
    zeroTrafficDays,
    emptySourceRows: {
      rows: emptySrc._count,
      visits: emptySrc._sum.visits ?? 0,
    },
    emptyUtmRows: {
      rows: emptyUtm._count,
      visits: emptyUtm._sum.visits ?? 0,
      totalVisits: allUtm._sum.visits ?? 0,
    },
    topSources,
    topUtmCampaigns,
    topLandings,
    leadReaches: await goalSum(db, range, registry.canonicalLeadGoalId),
    orderCreatedReaches: await goalSum(
      db,
      range,
      registry.crmOrderCreatedGoalId,
    ),
    orderPaidReaches: await goalSum(db, range, registry.crmOrderPaidGoalId),
    failedRuns,
  };
}

// ---------------------------------------------------------------------------
// Покрытие заказов CRM целями Метрики

export interface CoverageReport {
  range: DateRange;
  crmAccepted: number;
  crmAcceptedWithClientId: number;
  crmAcceptedBeforeLive: number;
  crmAcceptedControlledTest: number;
  crmAcceptedDeliveredToMetrika: number;
  crmPaid: number;
  crmPaidWithClientId: number;
  crmPaidBeforeLive: number;
  metrikaOrderCreated: number | null;
  metrikaOrderPaid: number | null;
  outboxDelivered: number;
}

export async function crmCoverage(
  db: Db,
  range: DateRange,
  registry: CanonicalGoalRegistry,
): Promise<CoverageReport> {
  const bounds = moscowDayBoundsUtc(range);
  const created = await db.orderPhoto.findMany({
    where: { createdAt: { gte: bounds.gte, lt: bounds.lt } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      yandexClientId: true,
      statusHistory: { select: { toStatus: true } },
      metrikaOutbox: { select: { status: true, sentMetrikaStatus: true } },
    },
  });
  const accepted = created.filter(
    (o) =>
      normalizeMetrikaStatus(o.status) !== null ||
      o.statusHistory.some((h) => normalizeMetrikaStatus(h.toStatus) !== null),
  );
  const paid = await db.orderPhoto.findMany({
    where: { clientPaidAt: { gte: bounds.gte, lt: bounds.lt } },
    select: { id: true, yandexClientId: true, clientPaidAt: true },
  });
  const outboxDelivered = await db.metrikaOrderOutbox.count({
    where: {
      status: 'delivered',
      processedAt: { gte: bounds.gte, lt: bounds.lt },
    },
  });
  return {
    range,
    crmAccepted: accepted.length,
    crmAcceptedWithClientId: accepted.filter((o) => o.yandexClientId).length,
    crmAcceptedBeforeLive: accepted.filter(
      (o) => o.createdAt < CRM_TO_METRIKA_LIVE_SINCE,
    ).length,
    crmAcceptedControlledTest: accepted.filter(
      (o) => o.id === CONTROLLED_STAGE06_TEST_ORDER_ID,
    ).length,
    crmAcceptedDeliveredToMetrika: accepted.filter((o) =>
      o.metrikaOutbox.some((r) => r.status === 'delivered'),
    ).length,
    crmPaid: paid.length,
    crmPaidWithClientId: paid.filter((o) => o.yandexClientId).length,
    crmPaidBeforeLive: paid.filter(
      (o) => (o.clientPaidAt ?? new Date(0)) < CRM_TO_METRIKA_LIVE_SINCE,
    ).length,
    metrikaOrderCreated: await goalSum(
      db,
      range,
      registry.crmOrderCreatedGoalId,
    ),
    metrikaOrderPaid: await goalSum(db, range, registry.crmOrderPaidGoalId),
    outboxDelivered,
  };
}

export { COUNTER_TIME_ZONE };
