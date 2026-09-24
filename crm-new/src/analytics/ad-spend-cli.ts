import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { parseSpendCsv } from './ads/ad-spend-import';

/**
 * Импорт рекламных расходов из выгрузки кабинета.
 *
 *   npm run ads:import -- --file /tmp/direct.csv            — разбор без записи
 *   npm run ads:import -- --file /tmp/direct.csv --apply    — записать в базу
 *   npm run ads:import -- --file /tmp/direct.csv --source YANDEX_DIRECT
 *
 * По умолчанию только разбор: владелец сначала смотрит, правильно ли поняли
 * его файл, и лишь потом пишет. Запись идемпотентна по (день, площадка,
 * кампания): повторная загрузка того же отчёта переписывает строки, а не
 * удваивает расход, — а это ровно то, что происходит, когда отчёт
 * выгружают за пересекающиеся периоды.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL не задан');
    process.exit(2);
  }
  const args = process.argv;
  const fileAt = args.indexOf('--file');
  const file = fileAt >= 0 ? args[fileAt + 1] : undefined;
  if (!file) {
    console.error('Укажите файл: --file /путь/к/отчёту.csv');
    process.exit(2);
  }
  const sourceAt = args.indexOf('--source');
  const source =
    (sourceAt >= 0 ? args[sourceAt + 1] : 'YANDEX_DIRECT') ?? 'YANDEX_DIRECT';
  const apply = args.includes('--apply');

  const parsed = parseSpendCsv(readFileSync(file, 'utf8'));
  const totalSpend = parsed.rows.reduce((s, r) => s + r.spend, 0);
  const days = new Set(parsed.rows.map((r) => r.date));
  console.log(
    JSON.stringify(
      {
        file,
        source,
        rows: parsed.rows.length,
        days: days.size,
        period:
          days.size > 0
            ? { from: [...days].sort()[0], to: [...days].sort().at(-1) }
            : null,
        totalSpend,
        campaigns: new Set(parsed.rows.map((r) => r.campaignId).filter(Boolean))
          .size,
        errors: parsed.errors.length,
      },
      null,
      2,
    ),
  );
  if (parsed.errors.length) {
    console.log(
      JSON.stringify({ errors: parsed.errors.slice(0, 20) }, null, 2),
    );
  }
  if (parsed.rows.length === 0) {
    console.error('Разобрать нечего — записывать не будем');
    process.exit(1);
  }
  if (!apply) {
    console.error(
      `Разбор: ${parsed.rows.length} строк на ${totalSpend} ₽; запись только с --apply`,
    );
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    let written = 0;
    for (const row of parsed.rows) {
      // Полночь UTC того же дня — так хранит даты вся остальная аналитика.
      const date = new Date(`${row.date}T00:00:00.000Z`);
      await prisma.adSpend.upsert({
        where: {
          date_source_campaignId: { date, source, campaignId: row.campaignId },
        },
        create: {
          date,
          source,
          campaignId: row.campaignId,
          campaignName: row.campaignName,
          spend: row.spend,
          clicks: row.clicks,
          impressions: row.impressions,
        },
        update: {
          campaignName: row.campaignName,
          spend: row.spend,
          clicks: row.clicks,
          impressions: row.impressions,
        },
      });
      written += 1;
    }
    console.error(`записано строк: ${written}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
