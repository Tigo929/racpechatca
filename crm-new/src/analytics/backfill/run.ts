import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import {
  addStats,
  BACKFILL_FIELDS,
  emptyStats,
  planOrder,
  type Conflict,
  type OrderSnapshot,
} from './plan';

/**
 * Исторический backfill аналитики — управляемая команда, не часть старта.
 *
 *   npm run analytics:backfill              — dry-run: только читает и считает
 *   npm run analytics:backfill -- --apply   — записывает
 *
 * Запускается из собранного dist (nest build), как и само приложение:
 * в боевом контейнере — `node dist/src/analytics/backfill/run.js`, ts-node
 * там нет, да и импорты сгенерированного клиента с `.js` он не находит.
 * Локально перед запуском — `npm run build`.
 *
 * По умолчанию ничего не меняет: пересчитать можно сколько угодно раз, а
 * запись — осознанное действие с отдельным флагом. В боевой базе запись
 * запускается только по команде владельца (этап 03, раздел 15).
 *
 * Читает заказы пачками по 100 в порядке создания; записи идут кусками
 * по 25 строк, каждый — своей транзакцией с запасом по времени. Таблица
 * маленькая (сотни строк), но при первом прогоне через SSH-туннель
 * транзакция на 100 обновлений не уложилась в 5 секунд по умолчанию
 * и откатилась целиком — отсюда куски и явный таймаут. Одна ошибка
 * откатывает только свой кусок, а не весь прогон. Что именно пишется
 * и почему — в plan.ts; здесь только ввод-вывод и счётчики.
 *
 * В вывод не попадают ни ClientID, ни адреса, ни тексты примечаний —
 * только количества и номера заказов с конфликтами: номер нужен, чтобы
 * открыть заказ в CRM и разобраться, а значения посмотрят там.
 */

const BATCH_SIZE = 100;
const WRITE_CHUNK = 25;
const WRITE_TIMEOUT_MS = 60_000;

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL не задан.');
    process.exit(2);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const startedAt = Date.now();

  const totals = emptyStats();
  const conflicts: Conflict[] = [];
  let scanned = 0;
  let ordersToChange = 0;
  let rowsChanged = 0;
  let utmAmbiguous = 0;
  let cursor: string | null = null;

  console.log(`Режим: ${apply ? 'APPLY — записываем' : 'DRY-RUN — только читаем'}`);

  try {
    for (;;) {
      const orders: OrderSnapshot[] = await prisma.orderPhoto.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          numberOrder: true,
          note: true,
          yandexClientId: true,
          yclid: true,
          conversionPageUrl: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          utmTerm: true,
          clientPaidAt: true,
          tshirtItems: { select: { designNote: true } },
          statusHistory: { select: { toStatus: true, createdAt: true } },
        },
      });
      if (orders.length === 0) break;
      cursor = orders[orders.length - 1]!.id;
      scanned += orders.length;

      const writes: { id: string; data: Record<string, unknown> }[] = [];
      for (const order of orders) {
        const plan = planOrder(order);
        addStats(totals, plan.stats);
        conflicts.push(...plan.conflicts);
        if (plan.utmAmbiguous) utmAmbiguous += 1;
        if (Object.keys(plan.patch).length > 0) {
          ordersToChange += 1;
          writes.push({ id: order.id, data: plan.patch });
        }
      }

      if (apply) {
        for (let i = 0; i < writes.length; i += WRITE_CHUNK) {
          const chunk = writes.slice(i, i + WRITE_CHUNK);
          await prisma.$transaction(
            chunk.map((w) => prisma.orderPhoto.update({ where: { id: w.id }, data: w.data })),
            { timeout: WRITE_TIMEOUT_MS },
          );
          rowsChanged += chunk.length;
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  const width = Math.max(...BACKFILL_FIELDS.map((f) => f.length));
  console.log('');
  console.log(`Заказов просмотрено: ${scanned}`);
  console.log(`Заказов с изменениями: ${ordersToChange}${apply ? ` (записано строк: ${rowsChanged})` : ' (dry-run, не записано)'}`);
  console.log('');
  console.log(`${'поле'.padEnd(width)}  найдено  запишем  уже есть  не разобрано  конфликты`);
  for (const f of BACKFILL_FIELDS) {
    const s = totals[f];
    console.log(
      `${f.padEnd(width)}  ${String(s.found).padStart(7)}  ${String(s.fill).padStart(7)}  ${String(s.alreadyStructured).padStart(8)}  ${String(s.parseFailures).padStart(12)}  ${String(s.conflicts).padStart(9)}`,
    );
  }
  console.log('');
  console.log(`UTM футболок с неоднозначной раскладкой (не записаны): ${utmAmbiguous}`);
  console.log(`Конфликтов всего: ${conflicts.length}`);
  for (const c of conflicts) {
    console.log(`  конфликт: заказ ${c.numberOrder} (${c.orderId.slice(0, 8)}…), поле ${c.field}`);
  }
  console.log(`Время: ${((Date.now() - startedAt) / 1000).toFixed(1)} с`);
}

main().catch((error) => {
  console.error('Backfill прерван:', error instanceof Error ? error.message : error);
  process.exit(1);
});
