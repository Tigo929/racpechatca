import type { MetrikaGoal, MetrikaStatsRow } from '../metrika.types';
import {
  BEHAVIOR_EVENTS,
  behaviorGoalChunks,
  behaviorGoals,
  visitParamKeysFilter,
} from './metrika-behavior-goals';
import type { CanonicalGoalRegistry } from './metrika-goal-registry';
import {
  BEHAVIOR_DATASETS,
  DATASET_SPECS,
  METRICS_LIMIT,
  PATH_PAGE_KINDS,
  type CatalogContext,
} from './metrika-query-catalog';

/**
 * Наборы этапа 10 (поведение): цели по устройствам и страницам входа,
 * параметры визитов из белого списка, агрегатные «пути», вовлечённость.
 * Проверяем форму запросов (лимит метрик, фильтры, измерения) и разбор
 * ответов — на тех же принципах, что у наборов этапа 07.
 */

const js = (id: number, event: string): MetrikaGoal => ({
  id,
  name: event,
  type: 'action',
  conditions: [{ type: 'contain', url: event }],
});

const GOALS: MetrikaGoal[] = [
  js(611379890, 'lead_submitted'),
  js(611379430, 'form_started'),
  js(611379504, 'lead_submit_attempt'),
  js(612290566, 'form_error'),
  js(611381532, 'view_custom_tshirt'),
  js(611382416, 'choose_size'),
  js(611384704, 'add_tshirt_lead'),
  js(611380009, 'messenger_click'),
  // не поведенческая — должна игнорироваться
  js(999, 'reviews_source_click_no_goal_in_list'),
  { id: 596990603, name: 'CRM: Заказ создан', type: 'cdp_order_in_progress' },
  {
    id: 602316919,
    name: 'Заявка отправлена',
    type: 'url',
    conditions: [{ type: 'contain', url: '/thanks' }],
  },
];

const registry: CanonicalGoalRegistry = {
  canonicalLeadGoalId: 611379890,
  photoLeadGoalId: null,
  canvasLeadGoalId: null,
  tshirtLeadGoalId: null,
  formErrorGoalId: 612290566,
  crmOrderCreatedGoalId: 596990603,
  crmOrderPaidGoalId: null,
  crmOrderCancelledGoalId: null,
  crmOrderSpamGoalId: null,
  legacyThanksGoalId: 602316919,
};
const ctx: CatalogContext = { goals: GOALS, registry };

const row = (dims: (string | null)[], metrics: number[]): MetrikaStatsRow => ({
  dimensions: dims.map((d) => ({ name: d, id: d })),
  metrics,
});

describe('behaviorGoals', () => {
  it('оставляет только поведенческие события в порядке BEHAVIOR_EVENTS, без дублей', () => {
    const goals = behaviorGoals(GOALS);
    expect(goals.map((g) => g.event)).toEqual([
      'form_started',
      'lead_submit_attempt',
      'lead_submitted',
      'form_error',
      'view_custom_tshirt',
      'choose_size',
      'add_tshirt_lead',
      'messenger_click',
    ]);
    expect(goals.find((g) => g.event === 'lead_submitted')?.goalId).toBe(
      611379890,
    );
    expect(BEHAVIOR_EVENTS).toHaveLength(14);
  });

  it('чанки по 6 целей: 3 метрики на цель + якорь визитов не превышают лимит API', () => {
    const all = BEHAVIOR_EVENTS.map((e, i) => js(700000 + i, e));
    const chunks = behaviorGoalChunks(behaviorGoals(all));
    expect(chunks.map((c) => c.length)).toEqual([6, 6, 2]);
    for (const q of DATASET_SPECS.behaviorDevices.queries({
      goals: all,
      registry,
    })) {
      expect(q.metrics.length).toBeLessThanOrEqual(METRICS_LIMIT);
      expect(q.metrics[0]).toBe('ym:s:visits');
    }
  });

  it('фильтр параметров — только белый список ключей', () => {
    expect(visitParamKeysFilter()).toBe(
      "ym:s:paramsLevel1=.('field','product','form','productSlug','intent','format','size','value','location','channel','kind','topic')",
    );
  });
});

describe('наборы этапа 10', () => {
  it('BEHAVIOR_DATASETS перечислены в каталоге и у каждого своя таблица', () => {
    expect(BEHAVIOR_DATASETS).toEqual([
      'behaviorDevices',
      'behaviorLandings',
      'behaviorParams',
      'behaviorPaths',
      'behaviorEngagement',
    ]);
    const tables = BEHAVIOR_DATASETS.map((d) => DATASET_SPECS[d].table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it('behaviorDevices: два чанка по устройствам, разбор даёт строку на (день, устройство, цель)', () => {
    const spec = DATASET_SPECS.behaviorDevices;
    const queries = spec.queries(ctx);
    expect(queries).toHaveLength(2); // 8 целей → 6 + 2
    expect(queries[0].dimensions).toEqual(['ym:s:date', 'ym:s:deviceCategory']);
    expect(queries[0].filters).toBeUndefined();
    const rows = spec.parse(
      [
        {
          query: queries[0],
          rows: [
            row(
              ['2026-09-14', 'desktop'],
              [78, 25, 13, 3, 4, 4, 1, 4, 4, 1, 3, 1, 1, 21, 11, 9, 2, 2, 2],
            ),
            row(
              ['2026-09-14', 'mobile'],
              [64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            ),
          ],
        },
        {
          query: queries[1],
          rows: [row(['2026-09-14', 'desktop'], [78, 1, 1, 1, 4, 4, 3])],
        },
      ],
      ctx,
    );
    expect(rows).toHaveLength(2 * 6 + 2);
    const formStartedDesktop = rows.find(
      (r) =>
        r.deviceCategory === 'desktop' && r.goalIdentifier === 'form_started',
    );
    expect(formStartedDesktop).toMatchObject({
      reaches: 25,
      goalVisits: 13,
      convertedUsers: 3,
      goalId: 611379430,
    });
    const messengerDesktop = rows.find(
      (r) => r.goalIdentifier === 'messenger_click',
    );
    expect(messengerDesktop).toMatchObject({
      reaches: 4,
      goalVisits: 4,
      convertedUsers: 3,
    });
    expect(
      rows
        .filter((r) => r.deviceCategory === 'mobile')
        .every((r) => r.goalVisits === 0),
    ).toBe(true);
  });

  it('behaviorLandings: путь нормализуется, цели те же', () => {
    const spec = DATASET_SPECS.behaviorLandings;
    const queries = spec.queries(ctx);
    expect(queries[0].dimensions).toEqual(['ym:s:date', 'ym:s:startURLPath']);
    const rows = spec.parse(
      [
        {
          query: queries[0],
          rows: [
            row(
              ['2026-09-14', '/Interer/Holst/'],
              [9, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            ),
          ],
        },
        { query: queries[1], rows: [] },
      ],
      ctx,
    );
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({
      landingPath: '/Interer/Holst/',
      normalizedPath: '/interer/holst',
      goalIdentifier: 'form_started',
      reaches: 2,
      goalVisits: 1,
    });
  });

  it('behaviorParams: один запрос с фильтром белого списка; строка = (день, устройство, ключ, значение)', () => {
    const spec = DATASET_SPECS.behaviorParams;
    const [q] = spec.queries(ctx);
    expect(q.dimensions).toEqual([
      'ym:s:date',
      'ym:s:deviceCategory',
      'ym:s:paramsLevel1',
      'ym:s:paramsLevel2',
    ]);
    expect(q.filters).toBe(visitParamKeysFilter());
    const rows = spec.parse(
      [
        {
          query: q,
          rows: [
            row(['2026-09-13', 'desktop', 'field', 'contactValue'], [1, 1, 3]),
            row(['2026-09-13', 'mobile', 'product', 'canvas'], [11, 5, 62]),
          ],
        },
      ],
      ctx,
    );
    expect(rows).toEqual([
      {
        date: '2026-09-13',
        deviceRaw: 'desktop',
        deviceCategory: 'desktop',
        paramKey: 'field',
        paramValue: 'contactValue',
        visits: 1,
        users: 1,
        paramsNumber: 3,
      },
      {
        date: '2026-09-13',
        deviceRaw: 'mobile',
        deviceCategory: 'mobile',
        paramKey: 'product',
        paramValue: 'canvas',
        visits: 11,
        users: 5,
        paramsNumber: 62,
      },
    ]);
  });

  it('behaviorPaths: четыре запроса — входы/просмотры визитов с заявкой, выходы всех и без заявки', () => {
    const spec = DATASET_SPECS.behaviorPaths;
    const queries = spec.queries(ctx);
    expect(queries).toHaveLength(4);
    expect(queries[0]).toMatchObject({
      dimensions: ['ym:s:date', 'ym:s:startURLPath'],
      filters: "ym:s:goal611379890IsReached=='Yes'",
    });
    expect(queries[1]).toMatchObject({
      dimensions: ['ym:pv:date', 'ym:pv:URLPath'],
      metrics: ['ym:pv:pageviews', 'ym:pv:users'],
      filters: "ym:s:goal611379890IsReached=='Yes'",
    });
    expect(queries[2]).toMatchObject({
      dimensions: ['ym:s:date', 'ym:s:endURLPath'],
    });
    expect(queries[2].filters).toBeUndefined();
    expect(queries[3].filters).toBe("ym:s:goal611379890IsReached=='No'");
    const rows = spec.parse(
      [
        { query: queries[0], rows: [row(['2026-09-11', '/'], [4, 1])] },
        {
          query: queries[1],
          rows: [row(['2026-09-11', '/catalog/foto-10x15-s-polyami'], [12, 1])],
        },
        { query: queries[2], rows: [row(['2026-09-11', '/'], [73, 52])] },
        {
          query: queries[3],
          rows: [row(['2026-09-11', '/interer/holst'], [12, 7])],
        },
      ],
      ctx,
    );
    expect(rows.map((r) => r.kind)).toEqual([...PATH_PAGE_KINDS]);
    expect(rows[0]).toMatchObject({
      kind: 'entry_lead',
      visits: 4,
      pageviews: null,
      users: 1,
    });
    expect(rows[1]).toMatchObject({
      kind: 'viewed_lead',
      visits: null,
      pageviews: 12,
      users: 1,
    });
    expect(rows[3]).toMatchObject({
      kind: 'exit_nolead',
      pagePath: '/interer/holst',
      visits: 12,
      users: 7,
    });
  });

  it('behaviorPaths: без канонической цели lead запрос не собрать — понятная ошибка', () => {
    expect(() =>
      DATASET_SPECS.behaviorPaths.queries({
        goals: GOALS,
        registry: { ...registry, canonicalLeadGoalId: null },
      }),
    ).toThrow(/lead/);
  });

  it('behaviorEngagement: аддитивные величины — отказы, просмотры, секунды', () => {
    const spec = DATASET_SPECS.behaviorEngagement;
    const [q] = spec.queries(ctx);
    expect(q.metrics).toEqual([
      'ym:s:visits',
      'ym:s:bounces',
      'ym:s:pageviews',
      'ym:s:sumVisitDurationSeconds',
    ]);
    const rows = spec.parse(
      [{ query: q, rows: [row(['2026-09-14', 'mobile'], [64, 4, 208, 7950])] }],
      ctx,
    );
    expect(rows).toEqual([
      {
        date: '2026-09-14',
        deviceRaw: 'mobile',
        deviceCategory: 'mobile',
        visits: 64,
        bounces: 4,
        pageviews: 208,
        durationSeconds: 7950,
      },
    ]);
  });
});
