import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MetrikaApiError,
  type YandexMetrikaClient,
} from '../metrika-api.client';
import type { MetrikaGoal } from '../metrika.types';
import { assertRange, type DateRange } from './metrika-dates';
import {
  resolveCanonicalGoals,
  type GoalResolution,
} from './metrika-goal-registry';
import {
  ALL_DATASETS,
  DATASET_SPECS,
  type CatalogContext,
  type MetrikaDataset,
} from './metrika-query-catalog';
import {
  emptyMeta,
  mergeMeta,
  MetrikaReportFetcher,
  type FetchedQuery,
  type FetchMeta,
  type RequestCounter,
} from './metrika-report-fetcher';
import { InMemoryLock, type SyncLock } from './metrika-sync-lock';
import type { MetrikaSyncStore } from './metrika-sync-store';

/**
 * Синхронизация отчётов Метрики в локальные таблицы (этап 07, разделы
 * 4–6, 19–21).
 *
 * Один вызов `sync` — один запуск (batch): блокировка → цели счётчика →
 * по каждому набору: строка журнала RUNNING → все запросы набора →
 * разбор → замена строк за период в одной транзакции → SUCCESS или
 * FAILED. Наборы независимы: упавшие источники не мешают трафику, и
 * итог запуска честный — PARTIAL, если упала часть.
 *
 * Замена, а не upsert: за период удаляется всё и вставляется ответ API
 * целиком. Иначе источник, который в новом ответе исчез (Метрика
 * пересчитала, атрибуция сменилась), остался бы в базе призраком.
 * Если API не ответил, до транзакции дело не доходит — прежние строки
 * остаются читаемыми.
 *
 * Токен здесь не появляется: клиент сам не выдаёт его ни в ошибках,
 * ни в логах. В журнал попадает человеческое сообщение ошибки.
 */

/** RUNNING старше этого — процесс погиб посреди синхронизации: строка закрывается как FAILED. */
const STALE_RUN_MS = 60 * 60_000;

export type MetrikaReportsClient = Pick<
  YandexMetrikaClient,
  'getStats' | 'getGoals' | 'isConfigured'
>;

export interface SyncOptions {
  range: DateRange;
  /** По умолчанию — все наборы каталога, в его порядке. */
  datasets?: MetrikaDataset[];
  /** cli | scheduler:hourly | scheduler:daily. */
  trigger: string;
}

export interface DatasetOutcome {
  dataset: MetrikaDataset;
  runId: string | null;
  status: 'SUCCESS' | 'FAILED';
  rowsReceived: number;
  rowsStored: number;
  requests: number;
  sampled: boolean;
  sampleShare: number;
  dataLag: number | null;
  accuracy: string;
  error: string | null;
  durationMs: number;
}

export type BatchStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'FAILED'
  | 'LOCKED'
  | 'NOT_CONFIGURED';

export interface SyncSummary {
  batchId: string;
  status: BatchStatus;
  range: DateRange;
  trigger: string;
  datasets: DatasetOutcome[];
  goals: { total: number; resolution: GoalResolution } | null;
  /** Запросов к API всего, включая чтение списка целей. */
  requests: number;
  durationMs: number;
  error: string | null;
}

export class MetrikaAnalyticsSyncService {
  private readonly logger = new Logger(MetrikaAnalyticsSyncService.name);
  private readonly fetcher: MetrikaReportFetcher;

  constructor(
    private readonly store: MetrikaSyncStore,
    private readonly client: MetrikaReportsClient,
    private readonly lock: SyncLock = new InMemoryLock(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.fetcher = new MetrikaReportFetcher(client as YandexMetrikaClient);
  }

  async sync(options: SyncOptions): Promise<SyncSummary> {
    assertRange(options.range);
    const datasets = options.datasets ?? [...ALL_DATASETS];
    const batchId = randomUUID();
    const startedAt = this.now();
    const base = {
      batchId,
      range: options.range,
      trigger: options.trigger,
      datasets: [] as DatasetOutcome[],
      goals: null,
      requests: 0,
      error: null,
    };

    if (!this.client.isConfigured()) {
      return {
        ...base,
        status: 'NOT_CONFIGURED',
        durationMs: this.elapsed(startedAt),
        error: 'клиент Метрики не настроен',
      };
    }

    const release = await this.lock.tryAcquire();
    if (!release) {
      this.logger.warn(
        `Метрика: синхронизация ${options.range.from}..${options.range.to} пропущена — другая уже идёт`,
      );
      return {
        ...base,
        status: 'LOCKED',
        durationMs: this.elapsed(startedAt),
        error: 'другая синхронизация уже идёт',
      };
    }

    try {
      const stale = await this.store.failStaleRuns(
        new Date(startedAt.getTime() - STALE_RUN_MS),
        startedAt,
      );
      if (stale > 0)
        this.logger.warn(
          `Метрика: ${stale} зависших запусков закрыты как FAILED`,
        );

      let goals: MetrikaGoal[];
      try {
        goals = await this.client.getGoals();
      } catch (error) {
        const message = describe(error);
        this.logger.warn(`Метрика: список целей не прочитан — ${message}`);
        return {
          ...base,
          status: 'FAILED',
          requests: 1,
          durationMs: this.elapsed(startedAt),
          error: message,
        };
      }
      const resolution = resolveCanonicalGoals(goals);
      const ctx: CatalogContext = { goals, registry: resolution.registry };
      for (const d of resolution.drift) {
        this.logger.warn(
          `Метрика: цель ${d.key} найдена под номером ${d.actual}, в манифесте ${d.expected} — обновите GOALS_MANIFEST.md`,
        );
      }

      const outcomes: DatasetOutcome[] = [];
      for (const dataset of datasets) {
        outcomes.push(await this.syncDataset(dataset, options, batchId, ctx));
      }
      const failed = outcomes.filter((o) => o.status === 'FAILED').length;
      const status: BatchStatus =
        failed === 0
          ? 'SUCCESS'
          : failed === outcomes.length
            ? 'FAILED'
            : 'PARTIAL';
      const requests = 1 + outcomes.reduce((sum, o) => sum + o.requests, 0);
      this.logger.log(
        `Метрика: синхронизация ${options.range.from}..${options.range.to} (${options.trigger}) — ${status}, наборов ${outcomes.length}, запросов ${requests}, строк ${outcomes.reduce((s, o) => s + o.rowsStored, 0)}`,
      );
      return {
        ...base,
        status,
        datasets: outcomes,
        goals: { total: goals.length, resolution },
        requests,
        durationMs: this.elapsed(startedAt),
      };
    } finally {
      await release();
    }
  }

  private async syncDataset(
    dataset: MetrikaDataset,
    options: SyncOptions,
    batchId: string,
    ctx: CatalogContext,
  ): Promise<DatasetOutcome> {
    const spec = DATASET_SPECS[dataset];
    const startedAt = this.now();
    let runId: string | null = null;
    let meta: FetchMeta = emptyMeta();
    let rowsReceived = 0;
    const counter: RequestCounter = { requests: 0 };
    try {
      runId = await this.store.createRun({
        batchId,
        dataset,
        range: options.range,
        trigger: options.trigger,
        startedAt,
      });
      const fetched: FetchedQuery[] = [];
      for (const query of spec.queries(ctx)) {
        const result = await this.fetcher.fetch(query, options.range, counter);
        meta = mergeMeta(meta, result.meta);
        fetched.push(result);
      }
      rowsReceived = fetched.reduce((sum, f) => sum + f.rows.length, 0);
      const rows = spec.parse(fetched, ctx);
      const rowsStored = await this.store.replaceRows(
        dataset,
        options.range,
        rows,
      );
      await this.store.finishRun(runId, {
        status: 'SUCCESS',
        finishedAt: this.now(),
        rowsReceived,
        rowsStored,
        requestCount: meta.requests,
        sampled: meta.sampled,
        sampleShare: meta.sampleShare,
        dataLag: meta.dataLag,
        accuracy: meta.accuracy,
        lastError: null,
      });
      if (meta.sampled) {
        this.logger.warn(
          `Метрика: набор ${dataset} за ${options.range.from}..${options.range.to} семплирован (доля ${meta.sampleShare}) даже при accuracy=full`,
        );
      }
      return {
        dataset,
        runId,
        status: 'SUCCESS',
        rowsReceived,
        rowsStored,
        requests: meta.requests,
        sampled: meta.sampled,
        sampleShare: meta.sampleShare,
        dataLag: meta.dataLag,
        accuracy: meta.accuracy,
        error: null,
        durationMs: this.elapsed(startedAt),
      };
    } catch (error) {
      const message = describe(error);
      this.logger.warn(
        `Метрика: набор ${dataset} за ${options.range.from}..${options.range.to} не синхронизирован — ${message}`,
      );
      if (runId) {
        try {
          await this.store.finishRun(runId, {
            status: 'FAILED',
            finishedAt: this.now(),
            rowsReceived,
            rowsStored: 0,
            requestCount: counter.requests,
            sampled: meta.requests > 0 ? meta.sampled : null,
            sampleShare: meta.requests > 0 ? meta.sampleShare : null,
            dataLag: meta.dataLag,
            accuracy: meta.requests > 0 ? meta.accuracy : null,
            lastError: message,
          });
        } catch (storeError) {
          this.logger.error(
            `Метрика: не удалось записать провал набора ${dataset} в журнал`,
            storeError as Error,
          );
        }
      }
      return {
        dataset,
        runId,
        status: 'FAILED',
        rowsReceived,
        rowsStored: 0,
        requests: counter.requests,
        sampled: meta.sampled,
        sampleShare: meta.sampleShare,
        dataLag: meta.dataLag,
        accuracy: meta.accuracy,
        error: message,
        durationMs: this.elapsed(startedAt),
      };
    }
  }

  private elapsed(since: Date): number {
    return Math.max(0, this.now().getTime() - since.getTime());
  }
}

/** Текст ошибки для журнала: человеческое сообщение, без тела ответа и без секретов. */
export function describe(error: unknown): string {
  if (error instanceof MetrikaApiError)
    return `${error.kind} (HTTP ${error.status}): ${error.humanMessage}`.slice(
      0,
      500,
    );
  if (error instanceof Error)
    return `${error.name}: ${error.message}`.slice(0, 500);
  return String(error).slice(0, 500);
}
