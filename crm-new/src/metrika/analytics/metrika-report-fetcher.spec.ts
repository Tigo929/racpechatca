import {
  MetrikaApiError,
  type YandexMetrikaClient,
} from '../metrika-api.client';
import type { MetrikaStatsQuery, MetrikaStatsResponse } from '../metrika.types';
import type { ReportQuery } from './metrika-query-catalog';
import {
  ACCURACY_DEFAULT,
  ACCURACY_FULL,
  API_ROW_LIMIT,
  mergeMeta,
  MetrikaReportFetcher,
} from './metrika-report-fetcher';

/**
 * Получение отчёта (этап 07, разделы 16 и 24): семплирование не
 * замалчивается, при выборке запрос повторяется с полной точностью,
 * переполнение лимита строк решается делением периода, ошибка API
 * уходит наверх как есть.
 */
const QUERY: ReportQuery = {
  dimensions: ['ym:s:date'],
  metrics: ['ym:s:visits'],
  sort: 'ym:s:date',
  lang: 'ru',
};

function response(
  partial: Partial<MetrikaStatsResponse>,
  q: MetrikaStatsQuery,
): MetrikaStatsResponse {
  return {
    query: {
      ids: [1],
      dimensions: q.dimensions ?? [],
      metrics: q.metrics,
      date1: q.date1,
      date2: q.date2,
    },
    data: [],
    total_rows: 0,
    sampled: false,
    sample_share: 1,
    data_lag: 0,
    ...partial,
  };
}

function fakeClient(
  handler: (
    q: MetrikaStatsQuery,
    call: number,
  ) => Partial<MetrikaStatsResponse>,
) {
  const calls: MetrikaStatsQuery[] = [];
  const getStats = jest.fn((q: MetrikaStatsQuery) => {
    calls.push(q);
    const partial = handler(q, calls.length);
    return Promise.resolve(response(partial, q));
  });
  return { calls, client: { getStats } as unknown as YandexMetrikaClient };
}

const dayRow = (d: string, v: number) => ({
  dimensions: [{ name: d }],
  metrics: [v],
});

describe('MetrikaReportFetcher', () => {
  it('обычный ответ: один запрос, лимит API, сортировка и язык из каталога, точность по умолчанию', async () => {
    const { calls, client } = fakeClient(() => ({
      data: [dayRow('2026-09-10', 38)],
      total_rows: 1,
      data_lag: 12,
    }));
    const res = await new MetrikaReportFetcher(client).fetch(QUERY, {
      from: '2026-09-06',
      to: '2026-09-12',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      date1: '2026-09-06',
      date2: '2026-09-12',
      limit: API_ROW_LIMIT,
      sort: 'ym:s:date',
      lang: 'ru',
    });
    expect(calls[0].accuracy).toBeUndefined();
    expect(res.rows).toHaveLength(1);
    expect(res.meta).toEqual({
      requests: 1,
      sampled: false,
      sampleShare: 1,
      dataLag: 12,
      accuracy: ACCURACY_DEFAULT,
    });
  });

  it('семплированный ответ: повтор с accuracy=full, сохраняется его результат и его же признак выборки', async () => {
    const { calls, client } = fakeClient((q) =>
      q.accuracy === 'full'
        ? {
            data: [dayRow('2026-09-10', 40)],
            total_rows: 1,
            sampled: false,
            sample_share: 1,
          }
        : {
            data: [dayRow('2026-09-10', 38)],
            total_rows: 1,
            sampled: true,
            sample_share: 0.1,
          },
    );
    const res = await new MetrikaReportFetcher(client).fetch(QUERY, {
      from: '2026-09-10',
      to: '2026-09-10',
    });
    expect(calls).toHaveLength(2);
    expect(calls[1].accuracy).toBe('full');
    expect(res.rows[0].metrics[0]).toBe(40);
    expect(res.meta).toMatchObject({
      requests: 2,
      sampled: false,
      sampleShare: 1,
      accuracy: ACCURACY_FULL,
    });
  });

  it('выборка осталась даже при accuracy=full — так и записано, sampled=true', async () => {
    const { client } = fakeClient(() => ({
      data: [dayRow('2026-09-10', 38)],
      total_rows: 1,
      sampled: true,
      sample_share: 0.5,
    }));
    const res = await new MetrikaReportFetcher(client).fetch(QUERY, {
      from: '2026-09-10',
      to: '2026-09-10',
    });
    expect(res.meta).toMatchObject({
      requests: 2,
      sampled: true,
      sampleShare: 0.5,
      accuracy: ACCURACY_FULL,
    });
  });

  it('строк больше, чем отдано: период делится пополам, результаты склеиваются, запросы считаются', async () => {
    const { calls, client } = fakeClient((q) => {
      if (q.date1 === '2026-09-06' && q.date2 === '2026-09-09') {
        // «переполнение»: total_rows больше отданных строк
        return { data: [dayRow('2026-09-06', 1)], total_rows: 4 };
      }
      return { data: [dayRow(q.date1, 1), dayRow(q.date2, 1)], total_rows: 2 };
    });
    const res = await new MetrikaReportFetcher(client).fetch(QUERY, {
      from: '2026-09-06',
      to: '2026-09-09',
    });
    expect(calls.map((c) => `${c.date1}..${c.date2}`)).toEqual([
      '2026-09-06..2026-09-09',
      '2026-09-06..2026-09-07',
      '2026-09-08..2026-09-09',
    ]);
    expect(res.rows.map((r) => r.dimensions[0].name)).toEqual([
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
    ]);
    expect(res.meta.requests).toBe(3);
  });

  it('переполнение в пределах одного дня — ошибка, а не молчаливая потеря строк', async () => {
    const { client } = fakeClient(() => ({
      data: [dayRow('2026-09-10', 1)],
      total_rows: 200_000,
    }));
    await expect(
      new MetrikaReportFetcher(client).fetch(QUERY, {
        from: '2026-09-10',
        to: '2026-09-10',
      }),
    ).rejects.toThrow('больше лимита API');
  });

  it('ошибка API (429) уходит наверх той же ошибкой', async () => {
    const getStats = jest.fn(() =>
      Promise.reject(
        new MetrikaApiError(
          'rate_limited',
          429,
          'Метрика ограничила частоту запросов.',
        ),
      ),
    );
    const fetcher = new MetrikaReportFetcher({
      getStats,
    } as unknown as YandexMetrikaClient);
    await expect(
      fetcher.fetch(QUERY, { from: '2026-09-10', to: '2026-09-10' }),
    ).rejects.toMatchObject({ kind: 'rate_limited', status: 429 });
  });

  it('mergeMeta: sampled — хоть один, доля — наименьшая, задержка — наибольшая, full побеждает', () => {
    const merged = mergeMeta(
      {
        requests: 1,
        sampled: false,
        sampleShare: 1,
        dataLag: 5,
        accuracy: ACCURACY_DEFAULT,
      },
      {
        requests: 2,
        sampled: true,
        sampleShare: 0.3,
        dataLag: null,
        accuracy: ACCURACY_FULL,
      },
    );
    expect(merged).toEqual({
      requests: 3,
      sampled: true,
      sampleShare: 0.3,
      dataLag: 5,
      accuracy: ACCURACY_FULL,
    });
  });
});
