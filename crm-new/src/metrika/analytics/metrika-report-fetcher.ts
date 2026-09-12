import type { YandexMetrikaClient } from '../metrika-api.client';
import type { MetrikaStatsResponse, MetrikaStatsRow } from '../metrika.types';
import { addDays, daysBetween, type DateRange } from './metrika-dates';
import type { QueryResult, ReportQuery } from './metrika-query-catalog';

/**
 * Получение отчёта целиком (этап 07, разделы 16 и 24).
 *
 * Без постраничного чтения: `limit` — максимум API (100 000 строк), и если
 * строк оказалось больше, период делится пополам и читается двумя
 * запросами. Смещение (`offset`) не используется намеренно: между
 * страницами порядок строк с одинаковыми значениями не гарантирован, и
 * строка могла бы попасть в две страницы или ни в одну.
 *
 * Точность: сначала запрос как есть (умолчание API — Метрика сама решает,
 * нужна ли выборка). Если ответ семплированный, запрос повторяется с
 * `accuracy=full`, и сохраняется его результат — вместе с его же признаком
 * семплирования. Так выборка никогда не выдаётся за точные данные, а
 * дорогой полный режим включается только когда он что-то меняет.
 */

export const API_ROW_LIMIT = 100_000;
export const ACCURACY_DEFAULT = 'default';
export const ACCURACY_FULL = 'full';

export interface FetchMeta {
  requests: number;
  sampled: boolean;
  /** Наименьшая доля выборки среди запросов; 1 — данные полные. */
  sampleShare: number;
  /** Наибольшая задержка данных (с) среди запросов. */
  dataLag: number | null;
  /** full — хотя бы один запрос пришлось повторить с полной точностью. */
  accuracy: typeof ACCURACY_DEFAULT | typeof ACCURACY_FULL;
}

export interface FetchedQuery extends QueryResult {
  meta: FetchMeta;
}

export function emptyMeta(): FetchMeta {
  return {
    requests: 0,
    sampled: false,
    sampleShare: 1,
    dataLag: null,
    accuracy: ACCURACY_DEFAULT,
  };
}

export function mergeMeta(a: FetchMeta, b: FetchMeta): FetchMeta {
  return {
    requests: a.requests + b.requests,
    sampled: a.sampled || b.sampled,
    sampleShare: Math.min(a.sampleShare, b.sampleShare),
    dataLag:
      a.dataLag === null
        ? b.dataLag
        : b.dataLag === null
          ? a.dataLag
          : Math.max(a.dataLag, b.dataLag),
    accuracy:
      a.accuracy === ACCURACY_FULL || b.accuracy === ACCURACY_FULL
        ? ACCURACY_FULL
        : ACCURACY_DEFAULT,
  };
}

function metaOf(
  res: MetrikaStatsResponse,
  requests: number,
  accuracy: FetchMeta['accuracy'],
): FetchMeta {
  return {
    requests,
    sampled: res.sampled === true,
    sampleShare: typeof res.sample_share === 'number' ? res.sample_share : 1,
    dataLag: typeof res.data_lag === 'number' ? res.data_lag : null,
    accuracy,
  };
}

/** Счётчик попыток: растёт и на неудачных запросах, чтобы журнал видел, сколько раз ходили в API. */
export interface RequestCounter {
  requests: number;
}

export class MetrikaReportFetcher {
  constructor(private readonly client: YandexMetrikaClient) {}

  async fetch(
    query: ReportQuery,
    range: DateRange,
    counter: RequestCounter = { requests: 0 },
  ): Promise<FetchedQuery> {
    const { rows, meta } = await this.fetchRange(query, range, counter);
    return { query, rows, meta };
  }

  private async fetchRange(
    query: ReportQuery,
    range: DateRange,
    counter: RequestCounter,
  ): Promise<{ rows: MetrikaStatsRow[]; meta: FetchMeta }> {
    counter.requests += 1;
    let res = await this.client.getStats({
      metrics: query.metrics,
      dimensions: query.dimensions.length > 0 ? query.dimensions : undefined,
      date1: range.from,
      date2: range.to,
      sort: query.sort,
      lang: query.lang,
      limit: API_ROW_LIMIT,
    });
    let meta = metaOf(res, 1, ACCURACY_DEFAULT);

    if (res.sampled === true) {
      counter.requests += 1;
      res = await this.client.getStats({
        metrics: query.metrics,
        dimensions: query.dimensions.length > 0 ? query.dimensions : undefined,
        date1: range.from,
        date2: range.to,
        sort: query.sort,
        lang: query.lang,
        limit: API_ROW_LIMIT,
        accuracy: ACCURACY_FULL,
      });
      meta = mergeMeta(
        { ...meta, sampled: false, sampleShare: 1 },
        metaOf(res, 1, ACCURACY_FULL),
      );
    }

    const total =
      typeof res.total_rows === 'number' ? res.total_rows : res.data.length;
    if (total <= res.data.length) return { rows: res.data, meta };

    const days = daysBetween(range.from, range.to);
    if (days <= 1) {
      throw new Error(
        `Метрика: за ${range.from} строк больше лимита API (${total} > ${res.data.length}) — набор слишком детальный для одного дня`,
      );
    }
    const mid = addDays(range.from, Math.floor(days / 2) - 1);
    const left = await this.fetchRange(
      query,
      { from: range.from, to: mid },
      counter,
    );
    const right = await this.fetchRange(
      query,
      { from: addDays(mid, 1), to: range.to },
      counter,
    );
    return {
      rows: [...left.rows, ...right.rows],
      meta: mergeMeta(meta, mergeMeta(left.meta, right.meta)),
    };
  }
}
