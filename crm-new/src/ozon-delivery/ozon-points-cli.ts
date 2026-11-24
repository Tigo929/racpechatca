import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service';
import { OzonDeliveryClient } from './ozon-delivery.client';
import { OzonPointsService } from './ozon-points.service';

/**
 * Загрузка справочника пунктов Ozon — отдельной программой, не в CRM.
 *
 * Запускается в своём контейнере, поэтому её память не отнимает память у
 * CRM: 24.11.2026 загрузка внутри CRM роняла её каждые ~9 минут.
 *
 *   docker compose -f docker-compose.prod.yml run --rm --no-deps backend \
 *     node dist/src/ozon-delivery/ozon-points-cli.js
 *
 * На сервере — раз в сутки по cron (см. deploy/ozon-points.cron).
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL не задан');
    process.exit(2);
  }
  const client = new OzonDeliveryClient();
  if (!client.configured) {
    console.error('Нет ключей OZON_DELIVERY_CLIENT_ID / SECRET');
    process.exit(2);
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const service = new OzonPointsService(
      prisma as unknown as PrismaService,
      client,
    );
    /*
     * По умолчанию — полный проход с нуля (с гашением пропавших пунктов).
     * --resume: продолжить после самого большого id, сохранённого за
     * последние 20 часов — если прошлый запуск оборвался.
     */
    let from: string | undefined;
    if (process.argv.includes('--resume')) {
      const rows = await prisma.$queryRaw<{ max: number | null }[]>`
        SELECT MAX("id") AS max FROM "OzonPickupPoint"
        WHERE "updatedAt" > NOW() - INTERVAL '20 hours'`;
      const max = rows[0]?.max;
      if (max) from = String(max);
    }
    const result = await service.sync({ from });
    console.log(JSON.stringify(result));
    process.exitCode = result.total > 0 ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
