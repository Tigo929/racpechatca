import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service';
import { PgAdvisoryLock } from '../metrika/analytics/metrika-sync-lock';
import { rollingWindow } from '../metrika/analytics/metrika-dates';
import {
  DirectSearchQuerySync,
  directReportsConfig,
} from './ads/direct-search-query-sync';

/**
 * Поисковые запросы Директа → AdSearchQueryDaily. Отдельная программа в
 * своём контейнере (на сервере — таймер systemd), не внутри backend:
 *
 *   docker compose -f docker-compose.prod.yml run --rm --no-deps -T \
 *     -e YANDEX_DIRECT_REPORTS_TOKEN backend \
 *     node dist/src/analytics/direct-search-queries-cli.js [from to]
 *
 * Без дат — последние 35 дней: Директ дописывает клики и списания задним
 * числом, окно перекрывает их с запасом.
 */
async function main() {
  const config = directReportsConfig();
  const url = process.env.DATABASE_URL;
  const args = process.argv.slice(2);
  if (!config || !url)
    throw new Error(
      'Required: YANDEX_DIRECT_REPORTS_TOKEN, YANDEX_DIRECT_ANALYTICS_LOGIN, YANDEX_DIRECT_ANALYTICS_CAMPAIGNS, DATABASE_URL',
    );
  const range =
    args.length >= 2
      ? { from: args[0], to: args[1] }
      : rollingWindow(35, new Date());
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const sync = new DirectSearchQuerySync(
      prisma as unknown as PrismaService,
      new PgAdvisoryLock(url, 700_704),
      config,
    );
    console.log(JSON.stringify({ range, ...(await sync.sync(range)) }));
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : 'Direct search query sync failed',
  );
  process.exitCode = 1;
});
