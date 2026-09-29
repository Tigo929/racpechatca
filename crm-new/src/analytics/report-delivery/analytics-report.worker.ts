import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReportsService } from '../../reports/reports.service';
import { AnalyticsMetricsService } from '../metrics/analytics-metrics.service';
import { generateReport } from '../report/report-generate';
import { buildIdentity } from '../../health.controller';
import { utcDateToIso, addDays } from '../../metrika/analytics/metrika-dates';
import type { MetrikaPeriodSnapshotService } from '../../metrika/analytics/metrika-period-snapshot.service';
import { AnalyticsReportService } from './analytics-report.service';
import { scanReportContent } from './report-safety';
import {
  fileName,
  filePath,
  removeReportDir,
  writeAtomic,
} from './report-storage';

/**
 * Воркер очереди отчётов (этап 16).
 *
 * Работает в том же процессе, без брокера: ставить Redis ради нескольких
 * отчётов в неделю — лишняя инфраструктура на сервере с одним ядром. Защита
 * от параллельной работы двойная: флаг в процессе и захват строки в базе
 * (`updateMany` из QUEUED в GENERATING отдаёт ровно одному вызову).
 *
 * Отчёт становится READY только целиком: сначала генерация, потом проверка на
 * персональные данные и секреты, потом атомарная запись обоих файлов. Любая
 * ошибка на этом пути — FAILED с коротким понятным текстом, файлы за собой
 * убираются, недописанный отчёт пользователю не показывается.
 */

const POLL_MS = 10_000;

/**
 * Присмотр за очередью: вернуть брошенные заказы и убрать старое.
 * Раз в сутки достаточно — отчётов единицы в неделю, а восстановление после
 * перезапуска делается сразу на старте, не дожидаясь этого цикла.
 */
const HOUSEKEEPING_MS = 24 * 3600_000;

@Injectable()
export class AnalyticsReportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsReportWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private housekeeping: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: AnalyticsReportService,
    private readonly metrics: AnalyticsMetricsService,
    private readonly pnl: ReportsService,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly snapshots?: MetrikaPeriodSnapshotService,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test') return;
    // Перезапуск backend должен чинить очередь сам: заказ, брошенный на
    // середине прошлой жизнью процесса, возвращается в очередь здесь же.
    void this.maintenance();
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_MS);
    this.timer.unref?.();
    this.housekeeping = setInterval(() => {
      void this.maintenance();
    }, HOUSEKEEPING_MS);
    this.housekeeping.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.housekeeping) clearInterval(this.housekeeping);
  }

  /**
   * Присмотр за очередью: возврат брошенных заказов и уборка старых отчётов.
   * Не зависит от того, заказывал ли кто-то новый отчёт.
   */
  async maintenance(): Promise<{ recovered: number; removed: number }> {
    try {
      return await this.reports.maintenance();
    } catch (error) {
      this.logger.warn(
        `Присмотр за очередью отчётов не отработал — ${(error as Error).message.slice(0, 120)}`,
      );
      return { recovered: 0, removed: 0 };
    }
  }

  /**
   * Сборка отчёта генератором этапа 15. Отдельным методом — чтобы тесты
   * очереди не поднимали базу: их интересует поведение очереди и файлов,
   * а не формулы, у которых есть свои тесты.
   */
  protected async generate(options: {
    days: number;
    until: string;
    build: string | null;
  }): Promise<{ markdown: string; html: string }> {
    // Custom report windows are not necessarily one of the scheduled presets.
    // Refresh their unique-user snapshots in the background worker, never by
    // summing daily unique users or blocking the HTTP request.
    if (this.snapshots) {
      const currentFrom = addDays(options.until, 1 - options.days);
      const ranges = [
        { from: currentFrom, to: options.until },
        {
          from: addDays(currentFrom, -options.days),
          to: addDays(currentFrom, -1),
        },
        { from: addDays(options.until, -29), to: options.until },
      ];
      const seen = new Set<string>();
      for (const range of ranges) {
        const key = `${range.from}:${range.to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await this.snapshots.refreshRange(range);
      }
    }
    return generateReport(
      { prisma: this.prisma, metrics: this.metrics, reports: this.pnl },
      options,
    );
  }

  /** Один проход очереди: не более одного отчёта за раз. */
  async tick(): Promise<'idle' | 'busy' | 'done' | 'failed'> {
    if (this.busy) return 'busy';
    this.busy = true;
    try {
      const next = await this.prisma.analyticsReport.findFirst({
        where: { status: 'QUEUED' },
        orderBy: { requestedAt: 'asc' },
        select: { id: true },
      });
      if (!next) return 'idle';

      // Захват строки: если её уже забрал другой процесс, здесь будет 0.
      const claimed = await this.prisma.analyticsReport.updateMany({
        where: { id: next.id, status: 'QUEUED' },
        data: { status: 'GENERATING' },
      });
      if (claimed.count !== 1) return 'busy';

      return (await this.run(next.id)) ? 'done' : 'failed';
    } finally {
      this.busy = false;
    }
  }

  private async run(id: string): Promise<boolean> {
    const row = await this.prisma.analyticsReport.findUnique({
      where: { id },
      select: { dateFrom: true, dateTo: true },
    });
    if (!row) return false;

    const from = utcDateToIso(row.dateFrom);
    const to = utcDateToIso(row.dateTo);
    const days =
      Math.round(
        (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
          86_400_000,
      ) + 1;
    const build = buildIdentity(this.env).build;

    try {
      const report = await this.generate({ days, until: to, build });

      const safety = scanReportContent(report.markdown, report.html);
      if (!safety.ok) {
        throw new Error(
          `отчёт не прошёл проверку безопасности: ${safety.violations.join(', ')}`,
        );
      }

      const mdName = fileName('md', from, to);
      const htmlName = fileName('html', from, to);
      const mdSize = writeAtomic(
        filePath(id, mdName, this.env),
        report.markdown,
      );
      const htmlSize = writeAtomic(
        filePath(id, htmlName, this.env),
        report.html,
      );

      await this.prisma.analyticsReport.update({
        where: { id },
        data: {
          status: 'READY',
          generatedAt: new Date(),
          productionBuild: build,
          mdFilename: mdName,
          htmlFilename: htmlName,
          mdSizeBytes: mdSize,
          htmlSizeBytes: htmlSize,
          errorMessage: null,
        },
      });
      this.logger.log(
        `Отчёт ${id}: готов за ${from}..${to} (${mdSize} и ${htmlSize} байт)`,
      );
      await this.reports.applyRetention();
      return true;
    } catch (error) {
      const message = (error as Error).message ?? 'неизвестная ошибка';
      this.logger.error(`Отчёт ${id}: не сформирован — ${message}`);
      try {
        removeReportDir(id, this.env);
      } catch {
        // каталога могло и не быть — это не ошибка
      }
      await this.prisma.analyticsReport.update({
        where: { id },
        data: {
          status: 'FAILED',
          errorMessage: 'Не удалось сформировать отчёт',
          generatedAt: null,
          mdFilename: null,
          htmlFilename: null,
          mdSizeBytes: null,
          htmlSizeBytes: null,
        },
      });
      return false;
    }
  }
}
