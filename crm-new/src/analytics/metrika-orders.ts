import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service';
import { MetrikaApiError, YandexMetrikaClient } from '../metrika/metrika-api.client';
import { metrikaConfigFromEnv } from '../metrika/metrika.config';
import { costSettingsFrom } from '../reports/order-cogs';
import {
  buildSimpleOrdersCsv,
  formatCounterDateTime,
  isValidTimeZone,
} from '../metrika/orders/metrika-order-csv';
import { buildOrderSnapshot, maskClientId } from '../metrika/orders/metrika-order-payload';
import { normalizeMetrikaStatus } from '../metrika/orders/metrika-order-status';
import { MetrikaOrderOutboxService } from '../metrika/orders/metrika-order-outbox.service';
import { MetrikaOrderOutboxProcessorService } from '../metrika/orders/metrika-order-outbox-processor.service';

/**
 * Диагностика и ручное управление очередью заказов в Метрику (этап 06,
 * разделы 38–43). Запускается из собранного dist, как и остальные команды:
 *
 *   npm run metrika:orders -- status               — счётчики очереди, последние
 *                                                    строки, последние загрузки
 *                                                    в Метрике (только чтение)
 *   npm run metrika:orders -- preview --order <id> — что уйдёт по заказу:
 *                                                    снимок и файл, без отправки
 *   npm run metrika:orders -- send --order <id>    — то же, что preview
 *   npm run metrika:orders -- send --order <id> --live
 *                                                  — ОДИН реальный POST по заказу:
 *                                                    ставит ручную строку и сразу
 *                                                    обрабатывает её, минуя
 *                                                    рубильник расписания
 *   npm run metrika:orders -- requeue --order <id> | --all-failed
 *                                                  — вернуть failed-строки в очередь
 *
 * В выводе нет ни токена, ни полного ClientID (первые четыре цифры), ни
 * персональных данных: печатаются id заказов, статусы, суммы, коды ответов.
 *
 * Код выхода: 0 — успех; 1 — ошибка; 2 — не настроено / неверные аргументы.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function fmt(d: Date | null | undefined): string {
  return d ? d.toISOString().replace('T', ' ').slice(0, 19) : '—';
}

function openPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL не задан.');
    process.exit(2);
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

const ORDER_SELECT = {
  id: true,
  numberOrder: true,
  createdAt: true,
  status: true,
  yandexClientId: true,
  totalOrder: true,
  productCategory: true,
  items: {
    select: {
      formatPaper: true,
      quantity: true,
      pricePosition: true,
      printOnClientItem: true,
      thermalCost: true,
    },
  },
  tshirtItems: {
    select: {
      pricePosition: true,
      quantity: true,
      designCost: true,
      thermalCost: true,
      blankCost: true,
      clientItem: true,
    },
  },
  canvasItems: { select: { contractorCostPosition: true } },
  statusHistory: { select: { fromStatus: true, toStatus: true } },
} as const;

async function counterTimeZone(client: YandexMetrikaClient): Promise<{ name: string | null; offset: number | null; note: string }> {
  if (!client.isConfigured()) {
    return { name: null, offset: null, note: 'клиент не настроен — пояс счётчика неизвестен' };
  }
  try {
    const counter = await client.getCounter();
    const name = (counter.time_zone_name ?? '').trim();
    return {
      name: name && isValidTimeZone(name) ? name : null,
      offset: counter.time_zone_offset ?? null,
      note: name ? `из счётчика ${counter.id}` : 'счётчик не сообщил пояс',
    };
  } catch (e) {
    const msg = e instanceof MetrikaApiError ? e.humanMessage : String(e);
    return { name: null, offset: null, note: `счётчик не прочитан: ${msg}` };
  }
}

async function status(prisma: PrismaClient, client: YandexMetrikaClient): Promise<void> {
  const outbox = new MetrikaOrderOutboxService(prisma as unknown as PrismaService);
  const c = await outbox.counters();
  console.log('Очередь MetrikaOrderOutbox:');
  console.log(`  pending:    ${c.pending}`);
  console.log(`  processing: ${c.processing}`);
  console.log(`  delivered:  ${c.delivered}`);
  console.log(`  failed:     ${c.failed}`);
  console.log(`  skipped:    ${c.skipped}  (из них без ClientID: ${c.skippedNoClientId})`);
  console.log(`  last success: ${fmt(c.lastSuccessAt)}`);
  console.log(`  last failure: ${fmt(c.lastFailureAt)}`);

  const recent = await prisma.metrikaOrderOutbox.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: { order: { select: { numberOrder: true } } },
  });
  console.log('Последние строки:');
  for (const r of recent) {
    console.log(
      `  ${fmt(r.updatedAt)}  ${r.status.padEnd(10)} заказ ${r.order.numberOrder} → ${r.sentMetrikaStatus ?? r.targetMetrikaStatus}` +
        `, попыток ${r.attemptCount}` +
        (r.remoteUploadingId ? `, uploading ${r.remoteUploadingId} (${r.apiValidationStatus})` : '') +
        (r.skipReason ? `, пропуск: ${r.skipReason}` : '') +
        (r.lastError ? `, ошибка: ${r.lastError.slice(0, 120)}` : ''),
    );
  }
  if (recent.length === 0) console.log('  (пусто)');

  const tz = await counterTimeZone(client);
  console.log(`Часовой пояс счётчика: ${tz.name ?? '—'}${tz.offset !== null ? ` (смещение ${tz.offset} мин)` : ''} — ${tz.note}`);

  if (!client.isConfigured()) {
    console.log('Последние загрузки в Метрике: клиент не настроен (нет YANDEX_METRIKA_COUNTER_ID / YANDEX_METRIKA_OAUTH_TOKEN)');
    return;
  }
  try {
    const uploads = await client.getLastUploadings(10);
    console.log(`Последние загрузки в Метрике (${uploads.length}):`);
    for (const u of uploads) {
      console.log(
        `  ${u.datetime ?? '—'}  ${u.uploading_id}  ${u.api_validation_status ?? '—'}  строк: ${u.elements_count ?? '—'}  ${u.uploading_format ?? ''} ${u.uploading_source ?? ''}`,
      );
    }
    if (uploads.length === 0) console.log('  (загрузок ещё не было)');
  } catch (e) {
    const msg = e instanceof MetrikaApiError ? `${e.kind}, HTTP ${e.status}: ${e.humanMessage}` : String(e);
    console.log(`Последние загрузки в Метрике: не прочитаны (${msg})`);
  }
}

async function preview(prisma: PrismaClient, client: YandexMetrikaClient, orderId: string): Promise<boolean> {
  const order = await prisma.orderPhoto.findFirst({
    where: { OR: [{ id: orderId }, { numberOrder: orderId }] },
    select: ORDER_SELECT,
  });
  if (!order) {
    console.error(`Заказ ${orderId} не найден (id или номер).`);
    return false;
  }
  const settings = costSettingsFrom(await prisma.partnerSettings.findUnique({ where: { id: 'default' } }));
  const delivered = await prisma.metrikaOrderOutbox.count({ where: { orderId: order.id, status: 'delivered' } });
  const tz = await counterTimeZone(client);
  const zone = tz.name ?? 'UTC';

  console.log(`Заказ ${order.numberOrder} (${order.id})`);
  console.log(`  статус CRM:        ${order.status} → Метрика: ${normalizeMetrikaStatus(order.status) ?? '— (заявка)'}`);
  console.log(`  категория:         ${order.productCategory}`);
  console.log(`  создан (UTC):      ${fmt(order.createdAt)}`);
  console.log(`  пояс счётчика:     ${tz.name ?? 'неизвестен'} — ${tz.note}${tz.name ? '' : '; ниже дата показана в UTC'}`);
  console.log(`  create_date_time:  ${formatCounterDateTime(order.createdAt, zone)}`);
  console.log(`  ClientID:          ${order.yandexClientId ? maskClientId(order.yandexClientId) : 'нет'}`);
  console.log(`  totalOrder:        ${order.totalOrder}`);
  console.log(`  история:           ${order.statusHistory.map((h) => `${h.fromStatus ?? '—'}→${h.toStatus}`).join(', ') || '(пусто)'}`);
  console.log(`  доставлялся ранее: ${delivered > 0 ? 'да' : 'нет'}`);

  const snapshot = buildOrderSnapshot(order, settings, zone, delivered > 0);
  if (snapshot.kind === 'skip') {
    console.log(`Итог: НЕ отправляется — ${snapshot.reason}`);
    return false;
  }
  console.log(`Итог: отправляется как ${snapshot.status}, revenue ${snapshot.row.revenue}, cost ${snapshot.row.cost ?? 'пусто (ненадёжна)'}`);
  const csv = buildSimpleOrdersCsv([{ ...snapshot.row, clientId: maskClientId(snapshot.row.clientId) }]);
  console.log('CSV (ClientID скрыт):');
  for (const line of csv.trimEnd().split('\n')) console.log(`  ${line}`);
  return true;
}

async function send(prisma: PrismaClient, client: YandexMetrikaClient, orderId: string, live: boolean): Promise<number> {
  const ok = await preview(prisma, client, orderId);
  if (!live) {
    console.log('Режим: preview. Для реальной отправки добавьте --live (только по разрешению владельца).');
    return ok ? 0 : 1;
  }
  if (!ok) return 1;
  if (!client.isConfigured()) {
    console.error('Клиент не настроен — отправка невозможна.');
    return 2;
  }
  const order = await prisma.orderPhoto.findFirst({
    where: { OR: [{ id: orderId }, { numberOrder: orderId }] },
    select: { id: true, status: true },
  });
  const target = normalizeMetrikaStatus(order?.status);
  if (!order || !target) return 1;

  const outbox = new MetrikaOrderOutboxService(prisma as unknown as PrismaService);
  const processor = new MetrikaOrderOutboxProcessorService(
    prisma as unknown as PrismaService,
    client,
    { syncEnabled: true },
  );
  const { id } = await outbox.enqueueManual(order.id, target, 'manual');
  console.log(`Ручная строка очереди ${id} создана — отправляем…`);
  const outcome = await processor.processById(id);
  console.log(`Результат: ${JSON.stringify(outcome)}`);
  const row = await prisma.metrikaOrderOutbox.findUnique({ where: { id } });
  console.log(
    `Строка: status=${row?.status}, попыток=${row?.attemptCount}, uploading=${row?.remoteUploadingId ?? '—'}, validation=${row?.apiValidationStatus ?? '—'}, elements=${row?.elementsCount ?? '—'}, processedAt=${fmt(row?.processedAt)}, ошибка=${row?.lastError ?? '—'}`,
  );
  return outcome?.result === 'delivered' ? 0 : 1;
}

async function requeue(prisma: PrismaClient, orderId?: string, allFailed = false): Promise<number> {
  if (!orderId && !allFailed) {
    console.error('Укажите --order <id> или --all-failed.');
    return 2;
  }
  const outbox = new MetrikaOrderOutboxService(prisma as unknown as PrismaService);
  const count = await outbox.requeueFailed(orderId);
  console.log(`Возвращено в очередь: ${count}`);
  return 0;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const prisma = openPrisma();
  const client = new YandexMetrikaClient(metrikaConfigFromEnv());
  let code = 0;
  try {
    switch (command) {
      case 'status':
        await status(prisma, client);
        break;
      case 'preview': {
        const id = arg('--order');
        if (!id) {
          console.error('Нужен --order <id|номер>.');
          code = 2;
          break;
        }
        code = (await preview(prisma, client, id)) ? 0 : 1;
        break;
      }
      case 'send': {
        const id = arg('--order');
        if (!id) {
          console.error('Нужен --order <id|номер>.');
          code = 2;
          break;
        }
        code = await send(prisma, client, id, flag('--live'));
        break;
      }
      case 'requeue':
        code = await requeue(prisma, arg('--order'), flag('--all-failed'));
        break;
      default:
        console.error('Команды: status | preview --order <id> | send --order <id> [--live] | requeue --order <id> | requeue --all-failed');
        code = 2;
    }
  } catch (e) {
    const msg = e instanceof MetrikaApiError ? `${e.kind}, HTTP ${e.status}: ${e.humanMessage}` : e instanceof Error ? e.message : String(e);
    console.error(`Ошибка: ${msg}`);
    code = 1;
  } finally {
    await prisma.$disconnect();
  }
  process.exit(code);
}

void main();
