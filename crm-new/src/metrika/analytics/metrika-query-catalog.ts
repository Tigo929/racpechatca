import type { MetrikaGoal, MetrikaStatsRow } from '../metrika.types';
import { isIsoDate, type IsoDate } from './metrika-dates';
import {
  goalEventIdentifier,
  REQUIRED_FOR_DIMENSION_DATASETS,
  type CanonicalGoalRegistry,
} from './metrika-goal-registry';

/**
 * Каталог запросов к Reports API (этап 07, раздел 15) — единственное
 * место, где живут измерения и метрики наборов. Человеческое описание
 * каждого набора — `docs/analytics/METRIKA_QUERY_CATALOG.md`; здесь то
 * же самое в типах, чтобы код и документ не расходились.
 *
 * Правила, проверенные живым API 12.09.2026:
 *   - не больше 20 метрик в запросе (4015), 10 измерений;
 *   - метрики `ym:s:` (визиты, цели) и измерения `ym:pv:` (просмотры)
 *     в одном запросе не сочетаются (4011) — поэтому у страниц нет целей;
 *   - `ym:pv:visits` не существует (4002);
 *   - строки, где все метрики нули, API не отдаёт — поэтому в запросах
 *     по целям есть якорная метрика `ym:s:visits`: она возвращает каждый
 *     день с трафиком, и таблица целей получается плотной (нули явные);
 *   - атрибуция источников/UTM — «последний значимый переход»
 *     (`lastsign`), названа явно, чтобы не зависеть от умолчания API.
 */

export type MetrikaDataset =
  | 'traffic'
  | 'goals'
  | 'sources'
  | 'utm'
  | 'landings'
  | 'devices'
  | 'pages';

export const ALL_DATASETS: readonly MetrikaDataset[] = [
  'traffic',
  'goals',
  'sources',
  'utm',
  'landings',
  'devices',
  'pages',
];

export function isDataset(value: string): value is MetrikaDataset {
  return (ALL_DATASETS as readonly string[]).includes(value);
}

export const ATTRIBUTION_PREFIX = 'lastsign';
export const METRICS_LIMIT = 20;
/** Целей в одном запросе набора goals: 3 метрики на цель + якорь визитов ≤ 20. */
export const GOALS_PER_REQUEST = 6;

export interface ReportQuery {
  dimensions: string[];
  metrics: string[];
  sort: string;
  lang: 'ru';
}

export interface QueryResult {
  query: ReportQuery;
  rows: MetrikaStatsRow[];
}

/** Что нужно каталогу, чтобы собрать запросы: цели счётчика и реестр канонических. */
export interface CatalogContext {
  goals: MetrikaGoal[];
  registry: CanonicalGoalRegistry;
}

export interface TrafficRow {
  date: IsoDate;
  visits: number;
  users: number;
  pageviews: number;
}

export interface GoalRow {
  date: IsoDate;
  goalId: number;
  goalName: string;
  goalIdentifier: string | null;
  reaches: number;
  goalVisits: number;
  convertedUsers: number;
}

interface GoalMetrics {
  leadReaches: number;
  orderCreatedReaches: number;
  orderPaidReaches: number;
}

export interface SourceRow extends GoalMetrics {
  date: IsoDate;
  trafficSource: string;
  trafficSourceName: string;
  sourceEngine: string;
  sourceEngineName: string;
  visits: number;
  users: number;
  pageviews: number;
}

export interface UtmRow extends GoalMetrics {
  date: IsoDate;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  visits: number;
  users: number;
}

export interface LandingRow extends GoalMetrics {
  date: IsoDate;
  landingPath: string;
  normalizedPath: string;
  visits: number;
  users: number;
}

export interface DeviceRow extends GoalMetrics {
  date: IsoDate;
  deviceRaw: string;
  deviceName: string;
  deviceCategory: DeviceCategory;
  visits: number;
  users: number;
}

export interface PageRow {
  date: IsoDate;
  pagePath: string;
  normalizedPath: string;
  pageviews: number;
  users: number;
}

export type DatasetRow<D extends MetrikaDataset> = D extends 'traffic'
  ? TrafficRow
  : D extends 'goals'
    ? GoalRow
    : D extends 'sources'
      ? SourceRow
      : D extends 'utm'
        ? UtmRow
        : D extends 'landings'
          ? LandingRow
          : D extends 'devices'
            ? DeviceRow
            : PageRow;

export interface DatasetSpec<D extends MetrikaDataset = MetrikaDataset> {
  dataset: D;
  table: string;
  title: string;
  grain: string;
  /** Запросы к API для набора (у целей их несколько — по 20 метрик). */
  queries(ctx: CatalogContext): ReportQuery[];
  /** Ответы всех запросов набора → строки локальной таблицы. */
  parse(results: QueryResult[], ctx: CatalogContext): DatasetRow<D>[];
}

export class MetrikaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetrikaParseError';
  }
}

// ---------------------------------------------------------------------------
// Разбор значений

/** Метрика API → целое; null/пусто/не число — 0 (у пустых дней API отдаёт null). */
export function metricInt(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

type Dim = MetrikaStatsRow['dimensions'][number] | undefined;

/** Отображаемое значение измерения; null (источник не определён) → ''. */
export function dimName(dim: Dim): string {
  const v = dim?.name;
  return v === null || v === undefined ? '' : String(v);
}

/** Код измерения (`id`); если кода нет — отображаемое значение. */
export function dimId(dim: Dim): string {
  const v = dim?.id;
  if (v === null || v === undefined) return dimName(dim);
  return String(v);
}

export function dimDate(dim: Dim, where: string): IsoDate {
  const v = dimName(dim);
  if (!isIsoDate(v))
    throw new MetrikaParseError(
      `${where}: измерение даты не YYYY-MM-DD: «${v}»`,
    );
  return v;
}

/** Путь страницы в нижнем регистре без параметров, якоря и завершающего слэша; корень — «/». */
export function normalizePath(raw: string): string {
  let p = raw.trim();
  const cut = p.search(/[?#]/);
  if (cut >= 0) p = p.slice(0, cut);
  try {
    p = decodeURI(p);
  } catch {
    // оставляем как есть — битые проценты не повод терять строку
  }
  p = p.toLowerCase();
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export type DeviceCategory = 'desktop' | 'mobile' | 'tablet' | 'other';

export function deviceCategoryOf(raw: string): DeviceCategory {
  switch (raw.trim().toLowerCase()) {
    case 'desktop':
      return 'desktop';
    case 'mobile':
      return 'mobile';
    case 'tablet':
      return 'tablet';
    default:
      return 'other';
  }
}

// ---------------------------------------------------------------------------
// Метрики целей

export function goalMetric(
  goalId: number,
  kind: 'reaches' | 'visits' | 'users',
): string {
  return `ym:s:goal${goalId}${kind}`;
}

function requireCanonical(
  ctx: CatalogContext,
  dataset: MetrikaDataset,
): {
  lead: number;
  created: number;
  paid: number;
} {
  const r = ctx.registry;
  const ids = {
    lead: r.canonicalLeadGoalId,
    created: r.crmOrderCreatedGoalId,
    paid: r.crmOrderPaidGoalId,
  };
  const missing = REQUIRED_FOR_DIMENSION_DATASETS.filter((key) =>
    key === 'lead'
      ? ids.lead === null
      : key === 'crmOrderCreated'
        ? ids.created === null
        : ids.paid === null,
  );
  if (missing.length > 0) {
    throw new MetrikaParseError(
      `набор ${dataset}: в счётчике не найдены канонические цели ${missing.join(', ')} — запрос не собрать`,
    );
  }
  return ids as { lead: number; created: number; paid: number };
}

/** Метрики канонических целей — в этом порядке идут после трафиковых. */
function canonicalGoalMetrics(
  ctx: CatalogContext,
  dataset: MetrikaDataset,
): string[] {
  const ids = requireCanonical(ctx, dataset);
  return [
    goalMetric(ids.lead, 'reaches'),
    goalMetric(ids.created, 'reaches'),
    goalMetric(ids.paid, 'reaches'),
  ];
}

function goalMetricsFrom(
  metrics: (number | null)[],
  offset: number,
): GoalMetrics {
  return {
    leadReaches: metricInt(metrics[offset]),
    orderCreatedReaches: metricInt(metrics[offset + 1]),
    orderPaidReaches: metricInt(metrics[offset + 2]),
  };
}

function single(
  results: QueryResult[],
  dataset: MetrikaDataset,
): MetrikaStatsRow[] {
  if (results.length !== 1) {
    throw new MetrikaParseError(
      `набор ${dataset}: ожидался один ответ, получено ${results.length}`,
    );
  }
  return results[0].rows;
}

// ---------------------------------------------------------------------------
// Наборы

const traffic: DatasetSpec<'traffic'> = {
  dataset: 'traffic',
  table: 'MetrikaDailyTraffic',
  title: 'Трафик по дням',
  grain: 'date',
  queries: () => [
    {
      dimensions: ['ym:s:date'],
      metrics: ['ym:s:visits', 'ym:s:users', 'ym:s:pageviews'],
      sort: 'ym:s:date',
      lang: 'ru',
    },
  ],
  parse: (results) =>
    single(results, 'traffic').map((row) => ({
      date: dimDate(row.dimensions[0], 'traffic'),
      visits: metricInt(row.metrics[0]),
      users: metricInt(row.metrics[1]),
      pageviews: metricInt(row.metrics[2]),
    })),
};

/** Цели чанками по GOALS_PER_REQUEST, в порядке возрастания номера. */
export function goalChunks(goals: MetrikaGoal[]): MetrikaGoal[][] {
  const sorted = [...goals].sort((a, b) => a.id - b.id);
  const chunks: MetrikaGoal[][] = [];
  for (let i = 0; i < sorted.length; i += GOALS_PER_REQUEST)
    chunks.push(sorted.slice(i, i + GOALS_PER_REQUEST));
  return chunks;
}

const goals: DatasetSpec<'goals'> = {
  dataset: 'goals',
  table: 'MetrikaDailyGoal',
  title: 'Достижения целей по дням',
  grain: 'date + goalId',
  queries: (ctx) =>
    goalChunks(ctx.goals).map((chunk) => ({
      dimensions: ['ym:s:date'],
      metrics: [
        'ym:s:visits',
        ...chunk.flatMap((g) => [
          goalMetric(g.id, 'reaches'),
          goalMetric(g.id, 'visits'),
          goalMetric(g.id, 'users'),
        ]),
      ],
      sort: 'ym:s:date',
      lang: 'ru',
    })),
  parse: (results, ctx) => {
    const chunks = goalChunks(ctx.goals);
    if (results.length !== chunks.length) {
      throw new MetrikaParseError(
        `набор goals: ожидалось ответов ${chunks.length}, получено ${results.length}`,
      );
    }
    const out: GoalRow[] = [];
    chunks.forEach((chunk, i) => {
      for (const row of results[i].rows) {
        const date = dimDate(row.dimensions[0], 'goals');
        chunk.forEach((g, j) => {
          const base = 1 + j * 3;
          out.push({
            date,
            goalId: g.id,
            goalName: g.name,
            goalIdentifier: goalEventIdentifier(g),
            reaches: metricInt(row.metrics[base]),
            goalVisits: metricInt(row.metrics[base + 1]),
            convertedUsers: metricInt(row.metrics[base + 2]),
          });
        });
      }
    });
    return out;
  },
};

const sources: DatasetSpec<'sources'> = {
  dataset: 'sources',
  table: 'MetrikaDailySource',
  title: 'Источники трафика по дням',
  grain: 'date + trafficSource + sourceEngine',
  queries: (ctx) => [
    {
      dimensions: [
        'ym:s:date',
        `ym:s:${ATTRIBUTION_PREFIX}TrafficSource`,
        `ym:s:${ATTRIBUTION_PREFIX}SourceEngine`,
      ],
      metrics: [
        'ym:s:visits',
        'ym:s:users',
        'ym:s:pageviews',
        ...canonicalGoalMetrics(ctx, 'sources'),
      ],
      sort: 'ym:s:date',
      lang: 'ru',
    },
  ],
  parse: (results) =>
    single(results, 'sources').map((row) => ({
      date: dimDate(row.dimensions[0], 'sources'),
      trafficSource: dimId(row.dimensions[1]),
      trafficSourceName: dimName(row.dimensions[1]),
      sourceEngine: dimId(row.dimensions[2]),
      sourceEngineName: dimName(row.dimensions[2]),
      visits: metricInt(row.metrics[0]),
      users: metricInt(row.metrics[1]),
      pageviews: metricInt(row.metrics[2]),
      ...goalMetricsFrom(row.metrics, 3),
    })),
};

const utm: DatasetSpec<'utm'> = {
  dataset: 'utm',
  table: 'MetrikaDailyUtm',
  title: 'UTM-метки визитов по дням',
  grain: 'date + utmSource + utmMedium + utmCampaign + utmContent + utmTerm',
  queries: (ctx) => [
    {
      dimensions: [
        'ym:s:date',
        `ym:s:${ATTRIBUTION_PREFIX}UTMSource`,
        `ym:s:${ATTRIBUTION_PREFIX}UTMMedium`,
        `ym:s:${ATTRIBUTION_PREFIX}UTMCampaign`,
        `ym:s:${ATTRIBUTION_PREFIX}UTMContent`,
        `ym:s:${ATTRIBUTION_PREFIX}UTMTerm`,
      ],
      metrics: [
        'ym:s:visits',
        'ym:s:users',
        ...canonicalGoalMetrics(ctx, 'utm'),
      ],
      sort: 'ym:s:date',
      lang: 'ru',
    },
  ],
  parse: (results) =>
    single(results, 'utm').map((row) => ({
      date: dimDate(row.dimensions[0], 'utm'),
      utmSource: dimName(row.dimensions[1]),
      utmMedium: dimName(row.dimensions[2]),
      utmCampaign: dimName(row.dimensions[3]),
      utmContent: dimName(row.dimensions[4]),
      utmTerm: dimName(row.dimensions[5]),
      visits: metricInt(row.metrics[0]),
      users: metricInt(row.metrics[1]),
      ...goalMetricsFrom(row.metrics, 2),
    })),
};

const landings: DatasetSpec<'landings'> = {
  dataset: 'landings',
  table: 'MetrikaDailyLanding',
  title: 'Страницы входа по дням',
  grain: 'date + landingPath',
  queries: (ctx) => [
    {
      dimensions: ['ym:s:date', 'ym:s:startURLPath'],
      metrics: [
        'ym:s:visits',
        'ym:s:users',
        ...canonicalGoalMetrics(ctx, 'landings'),
      ],
      sort: 'ym:s:date',
      lang: 'ru',
    },
  ],
  parse: (results) =>
    single(results, 'landings').map((row) => {
      const landingPath = dimName(row.dimensions[1]);
      return {
        date: dimDate(row.dimensions[0], 'landings'),
        landingPath,
        normalizedPath: normalizePath(landingPath),
        visits: metricInt(row.metrics[0]),
        users: metricInt(row.metrics[1]),
        ...goalMetricsFrom(row.metrics, 2),
      };
    }),
};

const devices: DatasetSpec<'devices'> = {
  dataset: 'devices',
  table: 'MetrikaDailyDevice',
  title: 'Устройства по дням',
  grain: 'date + deviceRaw',
  queries: (ctx) => [
    {
      dimensions: ['ym:s:date', 'ym:s:deviceCategory'],
      metrics: [
        'ym:s:visits',
        'ym:s:users',
        ...canonicalGoalMetrics(ctx, 'devices'),
      ],
      sort: 'ym:s:date',
      lang: 'ru',
    },
  ],
  parse: (results) =>
    single(results, 'devices').map((row) => {
      const deviceRaw = dimId(row.dimensions[1]);
      return {
        date: dimDate(row.dimensions[0], 'devices'),
        deviceRaw,
        deviceName: dimName(row.dimensions[1]),
        deviceCategory: deviceCategoryOf(deviceRaw),
        visits: metricInt(row.metrics[0]),
        users: metricInt(row.metrics[1]),
        ...goalMetricsFrom(row.metrics, 2),
      };
    }),
};

const pages: DatasetSpec<'pages'> = {
  dataset: 'pages',
  table: 'MetrikaDailyPage',
  title: 'Просмотры страниц по дням',
  grain: 'date + pagePath',
  queries: () => [
    {
      dimensions: ['ym:pv:date', 'ym:pv:URLPath'],
      metrics: ['ym:pv:pageviews', 'ym:pv:users'],
      sort: 'ym:pv:date',
      lang: 'ru',
    },
  ],
  parse: (results) =>
    single(results, 'pages').map((row) => {
      const pagePath = dimName(row.dimensions[1]);
      return {
        date: dimDate(row.dimensions[0], 'pages'),
        pagePath,
        normalizedPath: normalizePath(pagePath),
        pageviews: metricInt(row.metrics[0]),
        users: metricInt(row.metrics[1]),
      };
    }),
};

export const DATASET_SPECS: { [D in MetrikaDataset]: DatasetSpec<D> } = {
  traffic,
  goals,
  sources,
  utm,
  landings,
  devices,
  pages,
};

export function specOf<D extends MetrikaDataset>(dataset: D): DatasetSpec<D> {
  return DATASET_SPECS[dataset];
}
