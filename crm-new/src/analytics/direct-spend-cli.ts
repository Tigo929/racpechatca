import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service';
import { YandexMetrikaClient } from '../metrika/metrika-api.client';
import { metrikaConfigFromEnv } from '../metrika/metrika.config';
import { PgAdvisoryLock } from '../metrika/analytics/metrika-sync-lock';
import { DirectSpendSync, directSpendConfig } from './ads/direct-spend-sync';

async function main() {
  const config = directSpendConfig();
  const url = process.env.DATABASE_URL;
  const [from, to] = process.argv.slice(2);
  if (!config || !url || !from || !to)
    throw new Error(
      'Required: YANDEX_DIRECT_ANALYTICS_LOGIN, YANDEX_DIRECT_ANALYTICS_CAMPAIGNS, DATABASE_URL and ISO from/to arguments',
    );
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const service = new DirectSpendSync(
      prisma as unknown as PrismaService,
      new YandexMetrikaClient(metrikaConfigFromEnv()),
      new PgAdvisoryLock(url, 700_702),
      config,
    );
    console.log(JSON.stringify(await service.sync({ from, to })));
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Direct spend sync failed');
  process.exitCode = 1;
});
