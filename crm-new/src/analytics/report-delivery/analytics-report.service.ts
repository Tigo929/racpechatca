import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  isoToUtcDate,
  utcDateToIso,
} from '../../metrika/analytics/metrika-dates';
import {
  readReportFile,
  removeReportDir,
  type ReportFormat,
} from './report-storage';
import {
  resolvePeriod,
  type PeriodRequest,
  type ResolvedPeriod,
} from './report-period';

/**
 * Заказы аналитических отчётов (этап 16).
 *
 * Сервис ничего не считает: он ведёт очередь заказов и отдаёт готовые файлы.
 * Сам отчёт собирает генератор этапа 15 — тот же, что у командной строки.
 */

export const REPORT_RETENTION_DAYS = 180;
export const REPORT_RETENTION_KEEP = 50;

/**
 * Сколько ждать отчёт, прежде чем считать его брошенным. Backend может
 * перезапуститься посреди генерации (обновление образа, перезагрузка сервера):
 * строка останется в GENERATING, файлов не будет, и без уборки такой отчёт
 * висел бы «формируется» вечно, а владельцу пришлось бы звать администратора.
 * Пятнадцать минут — заведомо больше реальной генерации (секунды) и меньше
 * человеческого терпения.
 */
export const STALE_GENERATING_MS = 15 * 60_000;

export type ReportStatus = 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED';

export interface ReportSummary {
  id: string;
  status: ReportStatus;
  periodType: string;
  dateFrom: string;
  dateTo: string;
  requestedAt: Date;
  generatedAt: Date | null;
  productionBuild: string | null;
  mdSizeBytes: number | null;
  htmlSizeBytes: number | null;
  errorMessage: string | null;
  /** Какие форматы можно скачать прямо сейчас. */
  formats: ReportFormat[];
}

interface ReportRow {
  id: string;
  status: string;
  updatedAt?: Date;
  periodType: string;
  dateFrom: Date;
  dateTo: Date;
  requestedAt: Date;
  generatedAt: Date | null;
  productionBuild: string | null;
  mdFilename: string | null;
  htmlFilename: string | null;
  mdSizeBytes: number | null;
  htmlSizeBytes: number | null;
  errorMessage: string | null;
}

@Injectable()
export class AnalyticsReportService {
  private readonly logger = new Logger(AnalyticsReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly now: () => Date = () => new Date(),
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  private toSummary(row: ReportRow): ReportSummary {
    const formats: ReportFormat[] = [];
    if (row.status === 'READY') {
      if (row.mdFilename) formats.push('md');
      if (row.htmlFilename) formats.push('html');
    }
    return {
      id: row.id,
      status: row.status as ReportStatus,
      periodType: row.periodType,
      dateFrom: utcDateToIso(row.dateFrom),
      dateTo: utcDateToIso(row.dateTo),
      requestedAt: row.requestedAt,
      generatedAt: row.generatedAt,
      productionBuild: row.productionBuild,
      mdSizeBytes: row.mdSizeBytes,
      htmlSizeBytes: row.htmlSizeBytes,
      errorMessage: row.errorMessage,
      formats,
    };
  }

  /**
   * Поставить отчёт в очередь. Повторное нажатие кнопки с тем же периодом,
   * пока прошлый заказ не готов, возвращает тот же заказ — иначе двойной клик
   * забьёт очередь одинаковыми отчётами на сервере с одним ядром.
   */
  async create(request: PeriodRequest, userId: string): Promise<ReportSummary> {
    const period: ResolvedPeriod = resolvePeriod(request, this.now());
    const active = (await this.prisma.analyticsReport.findFirst({
      where: {
        requestedBy: userId,
        dateFrom: isoToUtcDate(period.from),
        dateTo: isoToUtcDate(period.to),
        status: { in: ['QUEUED', 'GENERATING'] },
      },
      orderBy: { requestedAt: 'desc' },
    })) as ReportRow | null;
    if (active) return this.toSummary(active);

    const created = (await this.prisma.analyticsReport.create({
      data: {
        status: 'QUEUED',
        periodType: period.periodType,
        dateFrom: isoToUtcDate(period.from),
        dateTo: isoToUtcDate(period.to),
        requestedBy: userId,
      },
    })) as ReportRow;
    this.logger.log(
      `Отчёт ${created.id}: заказан период ${period.from}..${period.to} (${period.periodType})`,
    );
    return this.toSummary(created);
  }

  async list(
    limit = 20,
    offset = 0,
  ): Promise<{ items: ReportSummary[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.analyticsReport.findMany({
        orderBy: { requestedAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 100),
        skip: Math.max(offset, 0),
      }),
      this.prisma.analyticsReport.count(),
    ]);
    return {
      items: (rows as ReportRow[]).map((r) => this.toSummary(r)),
      total,
    };
  }

  async get(id: string): Promise<ReportSummary> {
    const row = (await this.prisma.analyticsReport.findUnique({
      where: { id },
    })) as ReportRow | null;
    if (!row) throw new NotFoundException('Отчёт не найден');
    return this.toSummary(row);
  }

  /**
   * Содержимое готового отчёта. Имя файла берётся из метаданных, а не из
   * запроса: пользователь передаёт только идентификатор и формат.
   */
  async download(
    id: string,
    format: ReportFormat,
  ): Promise<{ filename: string; content: string }> {
    const row = (await this.prisma.analyticsReport.findUnique({
      where: { id },
    })) as ReportRow | null;
    if (!row) throw new NotFoundException('Отчёт не найден');
    if (row.status !== 'READY') {
      throw new NotFoundException('Отчёт ещё не готов');
    }
    const name = format === 'md' ? row.mdFilename : row.htmlFilename;
    if (!name) throw new NotFoundException('Файл отчёта не найден');
    return { filename: name, content: readReportFile(id, name, this.env) };
  }

  /**
   * Уборка: отчёты старше 180 дней и всё, что вышло за 50 последних готовых.
   * Заказы в работе не трогаем — иначе воркер запишет файлы в удалённый каталог.
   */
  /**
   * Вернуть в очередь отчёты, брошенные на середине (FIX_01).
   *
   * Признак — статус GENERATING дольше таймаута: `updatedAt` обновляется в
   * момент захвата строки воркером, поэтому отдельной колонки не нужно.
   * Недописанные файлы такого заказа удаляются, период и заказчик остаются
   * прежними, второй отчёт не создаётся — воркер просто соберёт его заново.
   */
  async recoverStale(
    timeoutMs: number = STALE_GENERATING_MS,
  ): Promise<{ recovered: number }> {
    const cutoff = new Date(this.now().getTime() - timeoutMs);
    const stale = (await this.prisma.analyticsReport.findMany({
      where: { status: 'GENERATING', updatedAt: { lt: cutoff } },
      select: { id: true },
    })) as { id: string }[];

    let recovered = 0;
    for (const { id } of stale) {
      try {
        // только каталог этого заказа: чужие готовые файлы не трогаем
        removeReportDir(id, this.env);
        await this.prisma.analyticsReport.update({
          where: { id },
          data: {
            status: 'QUEUED',
            generatedAt: null,
            productionBuild: null,
            mdFilename: null,
            htmlFilename: null,
            mdSizeBytes: null,
            htmlSizeBytes: null,
            errorMessage: null,
          },
        });
        recovered += 1;
        this.logger.warn(
          `Отчёт ${id}: остался в работе дольше ${Math.round(timeoutMs / 60_000)} мин — возвращён в очередь`,
        );
      } catch (error) {
        // один проблемный заказ не должен останавливать восстановление остальных
        this.logger.warn(
          `Отчёт ${id}: не удалось вернуть в очередь — ${(error as Error).message.slice(0, 120)}`,
        );
      }
    }
    return { recovered };
  }

  async applyRetention(): Promise<{ removed: number }> {
    const cutoff = new Date(
      this.now().getTime() - REPORT_RETENTION_DAYS * 86_400_000,
    );
    const old = (await this.prisma.analyticsReport.findMany({
      where: {
        requestedAt: { lt: cutoff },
        status: { in: ['READY', 'FAILED'] },
      },
      select: { id: true },
    })) as { id: string }[];

    const ready = (await this.prisma.analyticsReport.findMany({
      where: { status: 'READY' },
      orderBy: { requestedAt: 'desc' },
      select: { id: true },
    })) as { id: string }[];
    const excess = ready.slice(REPORT_RETENTION_KEEP);

    const ids = [
      ...new Set([...old.map((r) => r.id), ...excess.map((r) => r.id)]),
    ];

    // По одному: пропавший файл или сбой на одном отчёте не должен остановить
    // уборку остальных — иначе одна битая строка заморозит хранилище навсегда.
    let removed = 0;
    for (const id of ids) {
      try {
        removeReportDir(id, this.env);
      } catch (error) {
        this.logger.warn(
          `Отчёт ${id}: файлы не удалились — ${(error as Error).message.slice(0, 120)}`,
        );
      }
      try {
        await this.prisma.analyticsReport.delete({ where: { id } });
        removed += 1;
      } catch (error) {
        this.logger.warn(
          `Отчёт ${id}: запись не удалилась — ${(error as Error).message.slice(0, 120)}`,
        );
      }
    }
    if (removed) this.logger.log(`Уборка отчётов: удалено ${removed}`);
    return { removed };
  }

  /**
   * Полный цикл присмотра за очередью (FIX_01): сначала вернуть брошенные
   * заказы, потом убрать лишнее. Не зависит от того, заказывал ли кто-то
   * отчёт: вызывается при старте и по расписанию.
   */
  async maintenance(): Promise<{ recovered: number; removed: number }> {
    const { recovered } = await this.recoverStale();
    const { removed } = await this.applyRetention();
    return { recovered, removed };
  }

  /** Факты для операционной диагностики (этап 13, раздел 6). */
  async stats(): Promise<{
    queued: number;
    generating: number;
    failedLast24h: number;
    lastSuccessAt: Date | null;
  }> {
    const dayAgo = new Date(this.now().getTime() - 24 * 3600_000);
    const [queued, generating, failedLast24h, lastSuccess] = await Promise.all([
      this.prisma.analyticsReport.count({ where: { status: 'QUEUED' } }),
      this.prisma.analyticsReport.count({ where: { status: 'GENERATING' } }),
      this.prisma.analyticsReport.count({
        where: { status: 'FAILED', requestedAt: { gte: dayAgo } },
      }),
      this.prisma.analyticsReport.findFirst({
        where: { status: 'READY' },
        orderBy: { generatedAt: 'desc' },
        select: { generatedAt: true },
      }),
    ]);
    return {
      queued,
      generating,
      failedLast24h,
      lastSuccessAt: lastSuccess?.generatedAt ?? null,
    };
  }
}
