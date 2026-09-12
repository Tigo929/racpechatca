import { MetrikaApiError } from '../metrika-api.client';
import type {
  MetrikaGoal,
  MetrikaStatsQuery,
  MetrikaStatsResponse,
  MetrikaStatsRow,
} from '../metrika.types';
import {
  MetrikaAnalyticsSyncService,
  type MetrikaReportsClient,
} from './metrika-analytics-sync.service';
import type { DateRange } from './metrika-dates';
import type { DatasetRow, MetrikaDataset } from './metrika-query-catalog';
import { InMemoryLock } from './metrika-sync-lock';
import type {
  CreateRunInput,
  FinishRunInput,
  MetrikaSyncStore,
} from './metrika-sync-store';

/**
 * Сервис синхронизации (этап 07, раздел 30: idempotency, replacement,
 * lock, failure isolation). База и API заменены памятью: хранилище
 * повторяет семантику «удалить период → вставить» и умеет падать по
 * команде, клиент отдаёт заготовленные ответы по измерениям запроса.
 */

// ---------------------------------------------------------------------------
// Хранилище в памяти

type RunRow = CreateRunInput & { id: string } & Partial<FinishRunInput>;

class MemoryStore implements MetrikaSyncStore {
  runs: RunRow[] = [];
  tables: Record<MetrikaDataset, { date: string; [k: string]: unknown }[]> = {
    traffic: [],
    goals: [],
    sources: [],
    utm: [],
    landings: [],
    devices: [],
    pages: [],
  };
  failReplaceFor: MetrikaDataset | null = null;
  replaceCalls: MetrikaDataset[] = [];

  createRun(input: CreateRunInput): Promise<string> {
    const id = `run-${this.runs.length + 1}`;
    this.runs.push({ ...input, id });
    return Promise.resolve(id);
  }

  finishRun(id: string, patch: FinishRunInput): Promise<void> {
    const run = this.runs.find((r) => r.id === id);
    if (!run) return Promise.reject(new Error(`нет запуска ${id}`));
    Object.assign(run, patch);
    return Promise.resolve();
  }

  failStaleRuns(startedBefore: Date, finishedAt: Date): Promise<number> {
    let n = 0;
    for (const r of this.runs) {
      if (r.status === undefined && r.startedAt < startedBefore) {
        Object.assign(r, { status: 'FAILED', finishedAt, lastError: 'stale' });
        n += 1;
      }
    }
    return Promise.resolve(n);
  }

  replaceRows<D extends MetrikaDataset>(
    dataset: D,
    range: DateRange,
    rows: DatasetRow<D>[],
  ): Promise<number> {
    this.replaceCalls.push(dataset);
    if (this.failReplaceFor === dataset)
      return Promise.reject(new Error('база недоступна'));
    // как транзакция: удалить период и вставить — атомарно
    const kept = this.tables[dataset].filter(
      (r) => r.date < range.from || r.date > range.to,
    );
    this.tables[dataset] = [...kept, ...(rows as { date: string }[])];
    return Promise.resolve(rows.length);
  }
}

// ---------------------------------------------------------------------------
// Клиент в памяти

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
];

type Handler = (
  q: MetrikaStatsQuery,
) => MetrikaStatsRow[] | Error | Partial<MetrikaStatsResponse>;

function fakeClient(
  handler: Handler,
  goals: MetrikaGoal[] = GOALS,
  configured = true,
) {
  const calls: MetrikaStatsQuery[] = [];
  const client: MetrikaReportsClient = {
    isConfigured: () => configured,
    getGoals: () => Promise.resolve(goals),
    getStats: (q) => {
      calls.push(q);
      const out = handler(q);
      if (out instanceof Error) return Promise.reject(out);
      const partial: Partial<MetrikaStatsResponse> = Array.isArray(out)
        ? { data: out }
        : out;
      const data = partial.data ?? [];
      return Promise.resolve({
        query: {
          ids: [1],
          dimensions: q.dimensions ?? [],
          metrics: q.metrics,
          date1: q.date1,
          date2: q.date2,
        },
        data,
        total_rows: data.length,
        sampled: false,
        sample_share: 1,
        data_lag: 0,
        ...partial,
      });
    },
  };
  return { client, calls };
}

const day = (d: string) => ({ name: d });
const dims = (q: MetrikaStatsQuery) => (q.dimensions ?? []).join(',');

/** Ответы «как у живого счётчика»: трафик за два дня, два источника, остальное — по одной строке. */
function liveLike(sourcesToday: 'AB' | 'A' = 'AB'): Handler {
  return (q) => {
    const d = dims(q);
    if (
      d === 'ym:s:date' &&
      q.metrics[0] === 'ym:s:visits' &&
      q.metrics.length === 3
    ) {
      return [
        { dimensions: [day('2026-09-10')], metrics: [38, 30, 353] },
        { dimensions: [day('2026-09-11')], metrics: [20, 15, 100] },
      ];
    }
    if (d === 'ym:s:date') {
      // цели: якорь + 3 метрики на цель
      return [
        {
          dimensions: [day('2026-09-10')],
          metrics: q.metrics.map((_, i) => (i === 0 ? 38 : 1)),
        },
      ];
    }
    if (d.includes('TrafficSource')) {
      const rows = [
        {
          dimensions: [
            day('2026-09-10'),
            { name: 'Реклама', id: 'ad' },
            { name: 'Директ', id: 'ad.Директ' },
          ],
          metrics: [30, 25, 300, 1, 1, 0],
        },
      ];
      if (sourcesToday === 'AB')
        rows.push({
          dimensions: [
            day('2026-09-10'),
            { name: 'Поиск', id: 'organic' },
            { name: 'Яндекс', id: 'organic.yandex' },
          ],
          metrics: [8, 5, 53, 0, 0, 0],
        });
      return rows;
    }
    if (d.includes('UTM'))
      return [
        {
          dimensions: [
            day('2026-09-10'),
            { name: null },
            { name: null },
            { name: null },
            { name: null },
            { name: null },
          ],
          metrics: [38, 30, 1, 1, 0],
        },
      ];
    if (d.includes('startURLPath'))
      return [
        {
          dimensions: [day('2026-09-10'), { name: '/' }],
          metrics: [38, 30, 1, 1, 0],
        },
      ];
    if (d.includes('deviceCategory'))
      return [
        {
          dimensions: [day('2026-09-10'), { name: 'ПК', id: 'desktop' }],
          metrics: [38, 30, 1, 1, 0],
        },
      ];
    if (d.startsWith('ym:pv:'))
      return [
        { dimensions: [day('2026-09-10'), { name: '/' }], metrics: [353, 30] },
      ];
    return [];
  };
}

const RANGE: DateRange = { from: '2026-09-10', to: '2026-09-11' };

describe('MetrikaAnalyticsSyncService', () => {
  it('полный запуск: все наборы SUCCESS, журнал по каждому, запросов = цели + наборы', async () => {
    const store = new MemoryStore();
    const { client, calls } = fakeClient(liveLike());
    const service = new MetrikaAnalyticsSyncService(store, client);

    const s = await service.sync({ range: RANGE, trigger: 'cli' });

    expect(s.status).toBe('SUCCESS');
    expect(s.datasets.map((d) => `${d.dataset}:${d.status}`)).toEqual([
      'traffic:SUCCESS',
      'goals:SUCCESS',
      'sources:SUCCESS',
      'utm:SUCCESS',
      'landings:SUCCESS',
      'devices:SUCCESS',
      'pages:SUCCESS',
    ]);
    expect(calls).toHaveLength(7);
    expect(s.requests).toBe(8); // 7 отчётов + список целей
    expect(store.runs).toHaveLength(7);
    expect(
      store.runs.every(
        (r) =>
          r.status === 'SUCCESS' && r.batchId === s.batchId && r.finishedAt,
      ),
    ).toBe(true);
    expect(store.tables.traffic).toHaveLength(2);
    expect(store.tables.goals).toHaveLength(3);
    expect(store.tables.sources).toHaveLength(2);
    expect(s.goals?.resolution.missing).not.toEqual(
      expect.arrayContaining(['lead', 'crmOrderCreated', 'crmOrderPaid']),
    );
    expect(s.goals?.total).toBe(3);
  });

  it('idempotency: тот же период дважды — те же строки, без дублей и дрейфа сумм', async () => {
    const store = new MemoryStore();
    const service = new MetrikaAnalyticsSyncService(
      store,
      fakeClient(liveLike()).client,
    );

    await service.sync({ range: RANGE, trigger: 'cli' });
    const first = JSON.stringify(store.tables);
    await service.sync({ range: RANGE, trigger: 'cli' });

    expect(JSON.stringify(store.tables)).toBe(first);
    expect(
      store.tables.traffic.reduce((s, r) => s + (r.visits as number), 0),
    ).toBe(58);
    expect(store.runs).toHaveLength(14);
  });

  it('replacement: источник исчез из ответа API — исчезает и локально за этот период', async () => {
    const store = new MemoryStore();
    const first = new MetrikaAnalyticsSyncService(
      store,
      fakeClient(liveLike('AB')).client,
    );
    await first.sync({ range: RANGE, datasets: ['sources'], trigger: 'cli' });
    expect(store.tables.sources.map((r) => r.trafficSource)).toEqual([
      'ad',
      'organic',
    ]);

    const second = new MetrikaAnalyticsSyncService(
      store,
      fakeClient(liveLike('A')).client,
    );
    await second.sync({ range: RANGE, datasets: ['sources'], trigger: 'cli' });
    expect(store.tables.sources.map((r) => r.trafficSource)).toEqual(['ad']);
  });

  it('replacement не трогает строки вне запрошенного периода', async () => {
    const store = new MemoryStore();
    store.tables.traffic.push({
      date: '2026-09-01',
      visits: 7,
      users: 7,
      pageviews: 7,
    });
    const service = new MetrikaAnalyticsSyncService(
      store,
      fakeClient(liveLike()).client,
    );
    await service.sync({ range: RANGE, datasets: ['traffic'], trigger: 'cli' });
    expect(store.tables.traffic.map((r) => r.date)).toEqual([
      '2026-09-01',
      '2026-09-10',
      '2026-09-11',
    ]);
  });

  it('failure isolation: 5xx на источниках → sources FAILED с ошибкой в журнале, прежние строки читаемы, остальные SUCCESS, итог PARTIAL', async () => {
    const store = new MemoryStore();
    await new MetrikaAnalyticsSyncService(
      store,
      fakeClient(liveLike()).client,
    ).sync({ range: RANGE, trigger: 'cli' });
    const before = JSON.stringify(store.tables.sources);

    const failing: Handler = (q) =>
      dims(q).includes('TrafficSource')
        ? new MetrikaApiError(
            'server',
            503,
            'Метрика сейчас недоступна (ошибка на её стороне).',
          )
        : liveLike()(q);
    const s = await new MetrikaAnalyticsSyncService(
      store,
      fakeClient(failing).client,
    ).sync({ range: RANGE, trigger: 'scheduler:hourly' });

    expect(s.status).toBe('PARTIAL');
    const sources = s.datasets.find((d) => d.dataset === 'sources');
    expect(sources).toMatchObject({
      status: 'FAILED',
      rowsStored: 0,
      requests: 1,
    });
    expect(sources?.error).toContain('server (HTTP 503)');
    expect(JSON.stringify(store.tables.sources)).toBe(before);
    const run = store.runs.find(
      (r) => r.dataset === 'sources' && r.trigger === 'scheduler:hourly',
    );
    expect(run).toMatchObject({
      status: 'FAILED',
      requestCount: 1,
    });
    expect(run?.lastError).toContain('503');
    expect(s.datasets.filter((d) => d.status === 'SUCCESS')).toHaveLength(6);
  });

  it('таймаут/сеть на всех наборах → каждый FAILED, итог FAILED, ни одной записи', async () => {
    const store = new MemoryStore();
    const s = await new MetrikaAnalyticsSyncService(
      store,
      fakeClient(
        () =>
          new MetrikaApiError(
            'timeout',
            0,
            'Метрика не ответила за 10 секунд.',
          ),
      ).client,
    ).sync({
      range: RANGE,
      trigger: 'cli',
    });
    expect(s.status).toBe('FAILED');
    expect(store.replaceCalls).toEqual([]);
    expect(store.runs.every((r) => r.status === 'FAILED')).toBe(true);
  });

  it('падение транзакции записи → набор FAILED, прежние строки на месте', async () => {
    const store = new MemoryStore();
    await new MetrikaAnalyticsSyncService(
      store,
      fakeClient(liveLike()).client,
    ).sync({ range: RANGE, datasets: ['traffic'], trigger: 'cli' });
    store.failReplaceFor = 'traffic';
    const s = await new MetrikaAnalyticsSyncService(
      store,
      fakeClient(liveLike()).client,
    ).sync({ range: RANGE, datasets: ['traffic'], trigger: 'cli' });
    expect(s.status).toBe('FAILED');
    expect(s.datasets[0].error).toContain('база недоступна');
    expect(store.tables.traffic).toHaveLength(2);
  });

  it('ответ с нечитаемой датой → FAILED без записи (разбор перед транзакцией)', async () => {
    const store = new MemoryStore();
    const bad: Handler = (q) =>
      dims(q) === 'ym:s:date' && q.metrics.length === 3
        ? [{ dimensions: [{ name: 'вчера' }], metrics: [1, 1, 1] }]
        : liveLike()(q);
    const s = await new MetrikaAnalyticsSyncService(
      store,
      fakeClient(bad).client,
    ).sync({ range: RANGE, datasets: ['traffic'], trigger: 'cli' });
    expect(s.status).toBe('FAILED');
    expect(s.datasets[0].error).toContain('YYYY-MM-DD');
    expect(store.replaceCalls).toEqual([]);
  });

  it('нет канонической цели в счётчике → наборы с целями FAILED с понятной причиной, трафик и страницы SUCCESS', async () => {
    const store = new MemoryStore();
    const onlyLead = [js(611379890, 'lead_submitted')];
    const s = await new MetrikaAnalyticsSyncService(
      store,
      fakeClient(liveLike(), onlyLead).client,
    ).sync({ range: RANGE, trigger: 'cli' });
    expect(s.status).toBe('PARTIAL');
    expect(s.goals?.resolution.missing).toContain('crmOrderCreated');
    expect(s.datasets.find((d) => d.dataset === 'utm')?.error).toContain(
      'crmOrderCreated, crmOrderPaid',
    );
    expect(s.datasets.find((d) => d.dataset === 'traffic')?.status).toBe(
      'SUCCESS',
    );
    expect(s.datasets.find((d) => d.dataset === 'pages')?.status).toBe(
      'SUCCESS',
    );
  });

  it('sampling metadata: семплированный ответ → повтор с full; в журнале запросов 2 и итог повтора', async () => {
    const store = new MemoryStore();
    const sampledOnce: Handler = (q) => {
      if (dims(q) === 'ym:s:date' && q.metrics.length === 3) {
        return q.accuracy === 'full'
          ? {
              data: [
                { dimensions: [day('2026-09-10')], metrics: [40, 30, 353] },
              ],
              sampled: false,
              sample_share: 1,
              data_lag: 30,
            }
          : {
              data: [
                { dimensions: [day('2026-09-10')], metrics: [38, 30, 353] },
              ],
              sampled: true,
              sample_share: 0.5,
            };
      }
      return liveLike()(q);
    };
    const s = await new MetrikaAnalyticsSyncService(
      store,
      fakeClient(sampledOnce).client,
    ).sync({ range: RANGE, datasets: ['traffic'], trigger: 'cli' });
    expect(s.datasets[0]).toMatchObject({
      status: 'SUCCESS',
      requests: 2,
      sampled: false,
      sampleShare: 1,
      accuracy: 'full',
      dataLag: 30,
    });
    expect(store.runs[0]).toMatchObject({
      requestCount: 2,
      sampled: false,
      accuracy: 'full',
      dataLag: 30,
    });
    expect(store.tables.traffic[0].visits).toBe(40);
  });

  it('lock: два одновременных запуска — выполняется один, второй честно LOCKED и ничего не пишет', async () => {
    const store = new MemoryStore();
    let releaseStats!: () => void;
    const gate = new Promise<void>((r) => (releaseStats = r));
    const slow: Handler = liveLike();
    const { client } = fakeClient(slow);
    const waitingClient: MetrikaReportsClient = {
      ...client,
      getStats: async (q) => {
        await gate;
        return client.getStats(q);
      },
    };
    const lock = new InMemoryLock();
    const a = new MetrikaAnalyticsSyncService(store, waitingClient, lock);
    const b = new MetrikaAnalyticsSyncService(store, client, lock);

    const pa = a.sync({ range: RANGE, datasets: ['traffic'], trigger: 'cli' });
    await new Promise((r) => setImmediate(r));
    const sb = await b.sync({
      range: RANGE,
      datasets: ['traffic'],
      trigger: 'scheduler:hourly',
    });
    expect(sb.status).toBe('LOCKED');
    expect(sb.datasets).toEqual([]);

    releaseStats();
    const sa = await pa;
    expect(sa.status).toBe('SUCCESS');
    expect(store.runs).toHaveLength(1);

    // после освобождения — можно снова
    const again = await b.sync({
      range: RANGE,
      datasets: ['traffic'],
      trigger: 'scheduler:hourly',
    });
    expect(again.status).toBe('SUCCESS');
  });

  it('клиент не настроен → NOT_CONFIGURED, к API и базе не обращаемся', async () => {
    const store = new MemoryStore();
    const { client, calls } = fakeClient(liveLike(), GOALS, false);
    const s = await new MetrikaAnalyticsSyncService(store, client).sync({
      range: RANGE,
      trigger: 'cli',
    });
    expect(s.status).toBe('NOT_CONFIGURED');
    expect(calls).toEqual([]);
    expect(store.runs).toEqual([]);
  });

  it('список целей не прочитан → FAILED сразу, наборы не запускаются', async () => {
    const store = new MemoryStore();
    const client: MetrikaReportsClient = {
      isConfigured: () => true,
      getGoals: () =>
        Promise.reject(
          new MetrikaApiError(
            'unauthorized',
            401,
            'Метрика не приняла OAuth-токен.',
          ),
        ),
      getStats: () => Promise.reject(new Error('не должен вызываться')),
    };
    const s = await new MetrikaAnalyticsSyncService(store, client).sync({
      range: RANGE,
      trigger: 'cli',
    });
    expect(s.status).toBe('FAILED');
    expect(s.error).toContain('401');
    expect(store.runs).toEqual([]);
  });

  it('зависший RUNNING старше часа закрывается как FAILED на следующем запуске', async () => {
    const store = new MemoryStore();
    store.runs.push({
      id: 'old',
      batchId: 'b0',
      dataset: 'traffic',
      range: RANGE,
      trigger: 'cli',
      startedAt: new Date('2026-09-12T08:00:00Z'),
    });
    const now = () => new Date('2026-09-12T10:00:00Z');
    await new MetrikaAnalyticsSyncService(
      store,
      fakeClient(liveLike()).client,
      new InMemoryLock(),
      now,
    ).sync({ range: RANGE, datasets: ['traffic'], trigger: 'cli' });
    expect(store.runs[0]).toMatchObject({
      status: 'FAILED',
      lastError: 'stale',
    });
  });

  it('перевёрнутый период отвергается до блокировки', async () => {
    const store = new MemoryStore();
    await expect(
      new MetrikaAnalyticsSyncService(
        store,
        fakeClient(liveLike()).client,
      ).sync({
        range: { from: '2026-09-11', to: '2026-09-10' },
        trigger: 'cli',
      }),
    ).rejects.toThrow('позже конца');
  });
});
