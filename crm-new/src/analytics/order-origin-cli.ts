import { writeFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  planOriginBackfill,
  snapshotOf,
  summaryOf,
  type OriginBackfillRow,
} from './backfill/order-origin-backfill';

/**
 * Историческая классификация происхождения заказов (этап 17).
 *
 *   npm run origin:backfill                       — dry-run: план, база не меняется
 *   npm run origin:backfill -- --apply            — запись; снимок «что было» обязателен
 *   npm run origin:backfill -- --apply --snapshot /tmp/origin.json
 *
 * Применение пишет ровно одно поле — `sourceOrder`, и только там, где
 * происхождение доказано. Конфликты не перетираются: они попадают в вывод и
 * разбираются человеком.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL не задан');
    process.exit(2);
  }
  const apply = process.argv.includes('--apply');
  const snapshotAt = process.argv.indexOf('--snapshot');
  const snapshotPath =
    snapshotAt >= 0 && process.argv[snapshotAt + 1]
      ? process.argv[snapshotAt + 1]
      : `order-origin-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const rows: OriginBackfillRow[] = await prisma.orderPhoto.findMany({
      select: {
        id: true,
        numberOrder: true,
        sourceOrder: true,
        externalRequestId: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const plan = planOriginBackfill(rows);
    console.log(JSON.stringify(summaryOf(plan), null, 2));
    if (plan.conflicts.length) {
      console.log(JSON.stringify({ conflicts: plan.conflicts }, null, 2));
    }

    if (!apply) {
      console.error(
        `dry-run: изменений предложено ${plan.changes.length}; запись только с --apply`,
      );
      return;
    }

    // Снимок пишется ДО первой записи: иначе откатывать будет нечем.
    writeFileSync(
      snapshotPath,
      JSON.stringify(
        { createdAt: new Date().toISOString(), rows: snapshotOf(plan) },
        null,
        2,
      ),
      'utf8',
    );
    console.error(`снимок прежних значений: ${snapshotPath}`);

    let updated = 0;
    for (const change of plan.changes) {
      await prisma.orderPhoto.update({
        where: { id: change.id },
        data: { sourceOrder: change.to },
      });
      updated += 1;
    }
    console.error(`применено изменений: ${updated}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
