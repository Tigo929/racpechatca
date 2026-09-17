import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  RETENTION_APPLY_ENV,
  RetentionService,
} from './retention/retention.service';

/**
 * CLI политики хранения журналов аналитики (этап 13, раздел 13).
 *
 *   npm run analytics:retention                    — dry-run: план в JSON, ничего не удаляется
 *   npm run analytics:retention -- --apply         — удаление; требует ещё ANALYTICS_RETENTION_APPLY=1
 *
 * На production применение — только отдельным rollout; во время implementation
 * этапа 13 команда запускается исключительно в dry-run.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL не задан');
    process.exit(2);
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  const service = new RetentionService(prisma);
  try {
    if (process.argv.includes('--apply')) {
      const result = await service.apply({ confirm: true });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const plan = await service.plan();
    console.log(JSON.stringify(plan, null, 2));
    console.error(
      `dry-run: под правила подпадает строк — ${plan.totalRows}; удаление только с --apply и ${RETENTION_APPLY_ENV}=1`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
