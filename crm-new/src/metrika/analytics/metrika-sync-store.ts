import type { PrismaService } from 'src/prisma/prisma.service';
import { isoToUtcDate, type DateRange } from './metrika-dates';
import type { DatasetRow, MetrikaDataset } from './metrika-query-catalog';

/**
 * Хранилище синхронизации (этап 07, раздел 20): журнал запусков и замена
 * строк наборов. Отделено от сервиса интерфейсом, чтобы логику запуска
 * проверять без базы, а работу с базой — одним живым прогоном.
 */

export type SyncRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';

export interface CreateRunInput {
  batchId: string;
  dataset: MetrikaDataset;
  range: DateRange;
  trigger: string;
  startedAt: Date;
}

export interface FinishRunInput {
  status: SyncRunStatus;
  finishedAt: Date;
  rowsReceived: number;
  rowsStored: number;
  requestCount: number;
  sampled: boolean | null;
  sampleShare: number | null;
  dataLag: number | null;
  accuracy: string | null;
  lastError: string | null;
}

export interface MetrikaSyncStore {
  createRun(input: CreateRunInput): Promise<string>;
  finishRun(id: string, patch: FinishRunInput): Promise<void>;
  /**
   * Заменить строки набора за период: в одной транзакции удалить всё в
   * диапазоне дат и вставить свежий ответ API. Возвращает число вставленных.
   * Если транзакция не прошла, прежние строки остаются как были.
   */
  replaceRows<D extends MetrikaDataset>(
    dataset: D,
    range: DateRange,
    rows: DatasetRow<D>[],
  ): Promise<number>;
  /**
   * Запуски, оставшиеся RUNNING с давних пор (процесс упал посреди работы),
   * закрыть как FAILED, чтобы журнал не врал. Возвращает число закрытых.
   */
  failStaleRuns(startedBefore: Date, finishedAt: Date): Promise<number>;
}

const INSERT_CHUNK = 1000;
/** Замена 90 дней самого широкого набора — секунды; две минуты — с запасом. */
const REPLACE_TIMEOUT_MS = 120_000;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

export class PrismaMetrikaSyncStore implements MetrikaSyncStore {
  constructor(private readonly prisma: PrismaService) {}

  async createRun(input: CreateRunInput): Promise<string> {
    const run = await this.prisma.metrikaSyncRun.create({
      data: {
        batchId: input.batchId,
        dataset: input.dataset,
        dateFrom: isoToUtcDate(input.range.from),
        dateTo: isoToUtcDate(input.range.to),
        trigger: input.trigger,
        startedAt: input.startedAt,
        status: 'RUNNING',
      },
      select: { id: true },
    });
    return run.id;
  }

  async finishRun(id: string, patch: FinishRunInput): Promise<void> {
    await this.prisma.metrikaSyncRun.update({ where: { id }, data: patch });
  }

  async failStaleRuns(startedBefore: Date, finishedAt: Date): Promise<number> {
    const res = await this.prisma.metrikaSyncRun.updateMany({
      where: { status: 'RUNNING', startedAt: { lt: startedBefore } },
      data: {
        status: 'FAILED',
        finishedAt,
        lastError:
          'запуск не завершился — процесс прервался посреди синхронизации',
      },
    });
    return res.count;
  }

  async replaceRows<D extends MetrikaDataset>(
    dataset: D,
    range: DateRange,
    rows: DatasetRow<D>[],
  ): Promise<number> {
    const where = {
      date: { gte: isoToUtcDate(range.from), lte: isoToUtcDate(range.to) },
    };
    return this.prisma.$transaction(
      async (tx) => {
        let stored = 0;
        switch (dataset) {
          case 'traffic':
            await tx.metrikaDailyTraffic.deleteMany({ where });
            for (const part of chunks(
              rows as DatasetRow<'traffic'>[],
              INSERT_CHUNK,
            )) {
              stored += (
                await tx.metrikaDailyTraffic.createMany({
                  data: part.map(withDate),
                })
              ).count;
            }
            return stored;
          case 'goals':
            await tx.metrikaDailyGoal.deleteMany({ where });
            for (const part of chunks(
              rows as DatasetRow<'goals'>[],
              INSERT_CHUNK,
            )) {
              stored += (
                await tx.metrikaDailyGoal.createMany({
                  data: part.map(withDate),
                })
              ).count;
            }
            return stored;
          case 'sources':
            await tx.metrikaDailySource.deleteMany({ where });
            for (const part of chunks(
              rows as DatasetRow<'sources'>[],
              INSERT_CHUNK,
            )) {
              stored += (
                await tx.metrikaDailySource.createMany({
                  data: part.map(withDate),
                })
              ).count;
            }
            return stored;
          case 'utm':
            await tx.metrikaDailyUtm.deleteMany({ where });
            for (const part of chunks(
              rows as DatasetRow<'utm'>[],
              INSERT_CHUNK,
            )) {
              stored += (
                await tx.metrikaDailyUtm.createMany({
                  data: part.map(withDate),
                })
              ).count;
            }
            return stored;
          case 'landings':
            await tx.metrikaDailyLanding.deleteMany({ where });
            for (const part of chunks(
              rows as DatasetRow<'landings'>[],
              INSERT_CHUNK,
            )) {
              stored += (
                await tx.metrikaDailyLanding.createMany({
                  data: part.map(withDate),
                })
              ).count;
            }
            return stored;
          case 'devices':
            await tx.metrikaDailyDevice.deleteMany({ where });
            for (const part of chunks(
              rows as DatasetRow<'devices'>[],
              INSERT_CHUNK,
            )) {
              stored += (
                await tx.metrikaDailyDevice.createMany({
                  data: part.map(withDate),
                })
              ).count;
            }
            return stored;
          case 'pages':
            await tx.metrikaDailyPage.deleteMany({ where });
            for (const part of chunks(
              rows as DatasetRow<'pages'>[],
              INSERT_CHUNK,
            )) {
              stored += (
                await tx.metrikaDailyPage.createMany({
                  data: part.map(withDate),
                })
              ).count;
            }
            return stored;
          default:
            throw new Error(`Неизвестный набор данных: ${String(dataset)}`);
        }
      },
      { timeout: REPLACE_TIMEOUT_MS },
    );
  }
}

/** Строка каталога → строка Prisma: календарная дата становится DATE (полночь UTC). */
function withDate<T extends { date: string }>(
  row: T,
): Omit<T, 'date'> & { date: Date } {
  return { ...row, date: isoToUtcDate(row.date) };
}
