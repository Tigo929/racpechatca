import type { MetrikaGoal, MetrikaStatsRow } from '../metrika.types';
import { resolveCanonicalGoals } from './metrika-goal-registry';
import {
  ALL_DATASETS,
  DATASET_SPECS,
  deviceCategoryOf,
  dimId,
  dimName,
  GOALS_PER_REQUEST,
  goalChunks,
  METRICS_LIMIT,
  metricInt,
  MetrikaParseError,
  normalizePath,
  type CatalogContext,
} from './metrika-query-catalog';

/**
 * Каталог запросов и разбор ответов (этап 07, разделы 15 и 30 «Parser»).
 * Формы строк — такие, какие живой API отдал 12.09.2026.
 */
const js = (id: number, event: string): MetrikaGoal => ({
  id,
  name: event,
  type: 'action',
  conditions: [{ type: 'contain', url: event }],
});
const GOALS: MetrikaGoal[] = [
  js(611379890, 'lead_submitted'),
  { id: 596990603, name: 'CRM: Заказ создан', type: 'cdp_order_in_progress' },
  { id: 596990604, name: 'CRM: Заказ оплачен', type: 'cdp_order_paid' },
  {
    id: 602316919,
    name: 'Заявка отправлена',
    type: 'url',
    conditions: [{ type: 'contain', url: '/thanks' }],
  },
];
const ctx: CatalogContext = {
  goals: GOALS,
  registry: resolveCanonicalGoals(GOALS).registry,
};

const row = (
  dims: MetrikaStatsRow['dimensions'],
  metrics: (number | null)[],
): MetrikaStatsRow => ({ dimensions: dims, metrics });
const date = (d: string) => ({ name: d });

describe('разбор значений', () => {
  it('metricInt: число, строка-число, null, пусто, мусор, дробь', () => {
    expect(metricInt(38)).toBe(38);
    expect(metricInt('38')).toBe(38);
    expect(metricInt(null)).toBe(0);
    expect(metricInt(undefined)).toBe(0);
    expect(metricInt('')).toBe(0);
    expect(metricInt('abc')).toBe(0);
    expect(metricInt(15.38461538)).toBe(15);
  });

  it('dimName/dimId: пустое измерение (источник не определён) → пустая строка, код важнее названия', () => {
    expect(dimName({ name: null, id: null })).toBe('');
    expect(dimId({ name: null, id: null })).toBe('');
    expect(dimId({ name: 'Переходы по рекламе', id: 'ad' })).toBe('ad');
    expect(dimId({ name: '/' })).toBe('/');
    expect(dimName(undefined)).toBe('');
  });

  it('normalizePath: регистр, завершающий слэш, параметры, корень, кодировка', () => {
    expect(normalizePath('/Interer/Holst/')).toBe('/interer/holst');
    expect(normalizePath('/thanks?qty=1&total=370')).toBe('/thanks');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('/catalog/%D1%84%D0%BE%D1%82%D0%BE')).toBe(
      '/catalog/фото',
    );
    expect(normalizePath('catalog')).toBe('/catalog');
  });

  it('deviceCategoryOf: коды Метрики и всё остальное — other', () => {
    expect(deviceCategoryOf('desktop')).toBe('desktop');
    expect(deviceCategoryOf('mobile')).toBe('mobile');
    expect(deviceCategoryOf('tablet')).toBe('tablet');
    expect(deviceCategoryOf('tv')).toBe('other');
    expect(deviceCategoryOf('')).toBe('other');
  });
});

describe('каталог: запросы', () => {
  it('у каждого набора не больше 20 метрик и не больше 10 измерений', () => {
    for (const dataset of ALL_DATASETS) {
      for (const q of DATASET_SPECS[dataset].queries(ctx)) {
        expect(q.metrics.length).toBeLessThanOrEqual(METRICS_LIMIT);
        expect(q.dimensions.length).toBeLessThanOrEqual(10);
        expect(q.lang).toBe('ru');
      }
    }
  });

  it('цели режутся на чанки: 21 цель → 4 запроса, в каждом якорь визитов и ≤ 20 метрик', () => {
    const many = Array.from({ length: 21 }, (_, i) => js(100 + i, `g${i}`));
    const queries = DATASET_SPECS.goals.queries({
      goals: many,
      registry: ctx.registry,
    });
    expect(goalChunks(many).map((c) => c.length)).toEqual([6, 6, 6, 3]);
    expect(queries).toHaveLength(4);
    for (const q of queries) {
      expect(q.metrics[0]).toBe('ym:s:visits');
      expect(q.metrics.length).toBeLessThanOrEqual(METRICS_LIMIT);
    }
    expect(queries[0].metrics).toHaveLength(1 + GOALS_PER_REQUEST * 3);
  });

  it('источники: атрибуция «последний значимый» названа явно, цели канонические по номерам из реестра', () => {
    const [q] = DATASET_SPECS.sources.queries(ctx);
    expect(q.dimensions).toEqual([
      'ym:s:date',
      'ym:s:lastsignTrafficSource',
      'ym:s:lastsignSourceEngine',
    ]);
    expect(q.metrics).toEqual([
      'ym:s:visits',
      'ym:s:users',
      'ym:s:pageviews',
      'ym:s:goal611379890reaches',
      'ym:s:goal596990603reaches',
      'ym:s:goal596990604reaches',
    ]);
  });

  it('без канонической цели набор с целями не собирается — ошибка, а не нули', () => {
    const bare: CatalogContext = {
      goals: [],
      registry: resolveCanonicalGoals([]).registry,
    };
    expect(() => DATASET_SPECS.utm.queries(bare)).toThrow(MetrikaParseError);
    expect(() => DATASET_SPECS.utm.queries(bare)).toThrow(
      'lead, crmOrderCreated, crmOrderPaid',
    );
    expect(() => DATASET_SPECS.traffic.queries(bare)).not.toThrow();
    expect(() => DATASET_SPECS.pages.queries(bare)).not.toThrow();
  });

  it('страницы — пространство просмотров без целей', () => {
    const [q] = DATASET_SPECS.pages.queries(ctx);
    expect(q.dimensions).toEqual(['ym:pv:date', 'ym:pv:URLPath']);
    expect(q.metrics).toEqual(['ym:pv:pageviews', 'ym:pv:users']);
  });
});

describe('каталог: разбор ответов', () => {
  it('traffic: обычная строка', () => {
    const [q] = DATASET_SPECS.traffic.queries(ctx);
    const rows = DATASET_SPECS.traffic.parse(
      [{ query: q, rows: [row([date('2026-09-10')], [38, 30, 353])] }],
      ctx,
    );
    expect(rows).toEqual([
      { date: '2026-09-10', visits: 38, users: 30, pageviews: 353 },
    ]);
  });

  it('traffic: null-метрика → 0, не NaN', () => {
    const [q] = DATASET_SPECS.traffic.queries(ctx);
    const rows = DATASET_SPECS.traffic.parse(
      [{ query: q, rows: [row([date('2026-09-10')], [null, null, 5])] }],
      ctx,
    );
    expect(rows[0]).toMatchObject({ visits: 0, users: 0, pageviews: 5 });
  });

  it('измерение даты не в формате даты — MetrikaParseError, строка не превращается в мусор', () => {
    const [q] = DATASET_SPECS.traffic.queries(ctx);
    expect(() =>
      DATASET_SPECS.traffic.parse(
        [{ query: q, rows: [row([{ name: 'вчера' }], [1, 1, 1])] }],
        ctx,
      ),
    ).toThrow(MetrikaParseError);
  });

  it('goals: один чанк — по строке на каждую цель за день, нули явные, у URL-цели идентификатор пуст', () => {
    const queries = DATASET_SPECS.goals.queries(ctx);
    expect(queries).toHaveLength(1);
    // порядок целей в чанке — по возрастанию номера: 596990603, 596990604, 602316919, 611379890
    const metrics = [180, 1, 1, 1, 0, 0, 0, 24, 20, 19, 2, 2, 1];
    const rows = DATASET_SPECS.goals.parse(
      [{ query: queries[0], rows: [row([date('2026-09-11')], metrics)] }],
      ctx,
    );
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      date: '2026-09-11',
      goalId: 596990603,
      goalName: 'CRM: Заказ создан',
      goalIdentifier: null,
      reaches: 1,
      goalVisits: 1,
      convertedUsers: 1,
    });
    expect(rows[1]).toMatchObject({
      goalId: 596990604,
      reaches: 0,
      goalVisits: 0,
      convertedUsers: 0,
    });
    expect(rows[2]).toMatchObject({
      goalId: 602316919,
      goalIdentifier: null,
      reaches: 24,
    });
    expect(rows[3]).toMatchObject({
      goalId: 611379890,
      goalIdentifier: 'lead_submitted',
      reaches: 2,
      goalVisits: 2,
      convertedUsers: 1,
    });
  });

  it('goals: число ответов не совпало с числом чанков — ошибка', () => {
    expect(() => DATASET_SPECS.goals.parse([], ctx)).toThrow(MetrikaParseError);
  });

  it('sources: код источника — ключ, пустой движок у прямых заходов → пустые строки', () => {
    const [q] = DATASET_SPECS.sources.queries(ctx);
    const rows = DATASET_SPECS.sources.parse(
      [
        {
          query: q,
          rows: [
            row(
              [
                date('2026-09-06'),
                { name: 'Переходы по рекламе', id: 'ad' },
                { name: 'Яндекс: Директ', id: 'ad.Яндекс: Директ' },
              ],
              [28, 26, 98, 0, 1, 0],
            ),
            row(
              [
                date('2026-09-06'),
                { name: 'Прямые заходы', id: 'direct' },
                { name: null, id: null },
              ],
              [5, 5, 9, 1, 0, 0],
            ),
          ],
        },
      ],
      ctx,
    );
    expect(rows[0]).toEqual({
      date: '2026-09-06',
      trafficSource: 'ad',
      trafficSourceName: 'Переходы по рекламе',
      sourceEngine: 'ad.Яндекс: Директ',
      sourceEngineName: 'Яндекс: Директ',
      visits: 28,
      users: 26,
      pageviews: 98,
      leadReaches: 0,
      orderCreatedReaches: 1,
      orderPaidReaches: 0,
    });
    expect(rows[1]).toMatchObject({
      trafficSource: 'direct',
      sourceEngine: '',
      sourceEngineName: '',
      leadReaches: 1,
    });
  });

  it('utm: все метки null → пустые строки (визит без UTM), метки сохраняются как есть', () => {
    const [q] = DATASET_SPECS.utm.queries(ctx);
    const rows = DATASET_SPECS.utm.parse(
      [
        {
          query: q,
          rows: [
            row(
              [
                date('2026-09-10'),
                { name: null },
                { name: null },
                { name: null },
                { name: null },
                { name: null },
              ],
              [38, 30, 0, 0, 0],
            ),
            row(
              [
                date('2026-09-10'),
                { name: 'chatgpt.com' },
                { name: null },
                { name: null },
                { name: null },
                { name: null },
              ],
              [9, 8, 1, 0, 0],
            ),
          ],
        },
      ],
      ctx,
    );
    expect(rows[0]).toMatchObject({
      utmSource: '',
      utmMedium: '',
      utmCampaign: '',
      utmContent: '',
      utmTerm: '',
      visits: 38,
      users: 30,
    });
    expect(rows[1]).toMatchObject({
      utmSource: 'chatgpt.com',
      utmMedium: '',
      leadReaches: 1,
    });
  });

  it('landings: путь как есть + нормализованный', () => {
    const [q] = DATASET_SPECS.landings.queries(ctx);
    const rows = DATASET_SPECS.landings.parse(
      [
        {
          query: q,
          rows: [
            row(
              [date('2026-09-06'), { name: '/Interer/Holst/' }],
              [29, 20, 1, 0, 0],
            ),
          ],
        },
      ],
      ctx,
    );
    expect(rows[0]).toEqual({
      date: '2026-09-06',
      landingPath: '/Interer/Holst/',
      normalizedPath: '/interer/holst',
      visits: 29,
      users: 20,
      leadReaches: 1,
      orderCreatedReaches: 0,
      orderPaidReaches: 0,
    });
  });

  it('devices: код Метрики и наша категория', () => {
    const [q] = DATASET_SPECS.devices.queries(ctx);
    const rows = DATASET_SPECS.devices.parse(
      [
        {
          query: q,
          rows: [
            row(
              [date('2026-09-06'), { name: 'Смартфоны', id: 'mobile' }],
              [24, 22, 0, 0, 0],
            ),
            row(
              [date('2026-09-06'), { name: 'ТВ', id: 'tv' }],
              [1, 1, 0, 0, 0],
            ),
          ],
        },
      ],
      ctx,
    );
    expect(rows[0]).toMatchObject({
      deviceRaw: 'mobile',
      deviceName: 'Смартфоны',
      deviceCategory: 'mobile',
      visits: 24,
    });
    expect(rows[1]).toMatchObject({ deviceRaw: 'tv', deviceCategory: 'other' });
  });

  it('pages: просмотры и посетители по пути', () => {
    const [q] = DATASET_SPECS.pages.queries(ctx);
    const rows = DATASET_SPECS.pages.parse(
      [
        {
          query: q,
          rows: [row([date('2026-09-10'), { name: '/' }], [136, 23])],
        },
      ],
      ctx,
    );
    expect(rows).toEqual([
      {
        date: '2026-09-10',
        pagePath: '/',
        normalizedPath: '/',
        pageviews: 136,
        users: 23,
      },
    ]);
  });

  it('набор с одним запросом получил два ответа — ошибка', () => {
    const [q] = DATASET_SPECS.traffic.queries(ctx);
    expect(() =>
      DATASET_SPECS.traffic.parse(
        [
          { query: q, rows: [] },
          { query: q, rows: [] },
        ],
        ctx,
      ),
    ).toThrow(MetrikaParseError);
  });
});
