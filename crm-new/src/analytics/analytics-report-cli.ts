import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsMetricsService } from './metrics/analytics-metrics.service';
import { generateReport, lastCompleteDay } from './report/report-generate';

/**
 * Аналитический отчёт для внешнего ИИ (этап 15). Только чтение: ни одной
 * записи в базу, ни одного запроса к Яндексу — берутся уже собранные данные.
 *
 *   npm run analytics:report                      — 7 дней, последний полный день
 *   npm run analytics:report -- --period=30d      — другой размер текущего периода
 *   npm run analytics:report -- --until=2026-09-21 --period=7d
 *   npm run analytics:report -- --out /tmp/report — куда положить файлы
 *   npm run analytics:report -- --stdout          — напечатать markdown, ничего не сохраняя
 *
 * Итог: analytics-report.md (машинно-читаемый) и analytics-report.html
 * (та же модель, печатная версия — «Печать → Сохранить как PDF»).
 *
 * Код выхода: 0 — отчёт собран; 1 — ошибка; 2 — неверные аргументы.
 */

function arg(name: string): string | undefined {
  const withEq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (withEq) return withEq.slice(name.length + 1);
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseDays(value: string | undefined): number {
  if (!value) return 7;
  const m = /^(\d+)d?$/.exec(value.trim());
  if (!m) {
    console.error(
      `Неверный период: ${value}. Ожидается, например, 7d или 30d.`,
    );
    process.exit(2);
  }
  const days = Number(m[1]);
  if (days < 1 || days > 366) {
    console.error('Период должен быть от 1 до 366 дней.');
    process.exit(2);
  }
  return days;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL не задан.');
    process.exit(2);
  }
  const days = parseDays(arg('--period'));
  const until = arg('--until') ?? lastCompleteDay(new Date());
  const historyDays = parseDays(arg('--history') ?? '84');
  const toStdout = process.argv.includes('--stdout');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  const reports = new ReportsService(prisma as unknown as PrismaService);
  const metrics = new AnalyticsMetricsService(
    prisma as unknown as PrismaService,
    reports,
  );

  try {
    // Тот же путь, которым отчёт собирает кнопка в панели (этап 16):
    // командная строка и API обязаны давать одинаковый файл за один период.
    const report = await generateReport(
      { prisma: prisma as unknown as PrismaService, metrics, reports },
      { days, until, historyDays },
    );
    const markdown = report.markdown;

    if (toStdout) {
      process.stdout.write(markdown);
      process.exit(0);
    }

    const outRoot =
      arg('--out') ?? resolve(process.cwd(), '..', 'reports', 'analytics');
    const dir = join(outRoot, until);
    mkdirSync(dir, { recursive: true });
    const mdPath = join(dir, `analytics-report-${until}.md`);
    const htmlPath = join(dir, `analytics-report-${until}.html`);
    writeFileSync(mdPath, markdown, 'utf8');
    writeFileSync(htmlPath, report.html, 'utf8');

    console.log(`Отчёт за ${report.from}..${report.to}`);
    console.log(`  markdown: ${mdPath}`);
    console.log(
      `  печатная версия: ${htmlPath} (открыть в браузере → «Печать» → «Сохранить как PDF»)`,
    );
    console.log(
      `  сверка: сумма дневной выручки ${report.model.input.reconciliation.trendSumRealizedRevenue} против итога периода ${report.model.input.reconciliation.overviewRealizedRevenue}`,
    );
    process.exit(0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  );
  process.exit(1);
});
