import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service';
import {
  MetrikaApiError,
  YandexMetrikaClient,
} from '../metrika/metrika-api.client';
import {
  metrikaAnalyticsSyncEnabledFromEnv,
  metrikaConfigFromEnv,
} from '../metrika/metrika.config';
import {
  crmCoverage,
  dataQuality,
  datasetStates,
  reconcile,
  registryForReading,
} from '../metrika/analytics/metrika-analytics-inspect';
import {
  MetrikaAnalyticsSyncService,
  type SyncSummary,
} from '../metrika/analytics/metrika-analytics-sync.service';
import {
  assertRange,
  isIsoDate,
  rollingWindow,
  type DateRange,
} from '../metrika/analytics/metrika-dates';
import { resolveCanonicalGoals } from '../metrika/analytics/metrika-goal-registry';
import {
  ALL_DATASETS,
  DATASET_SPECS,
  isDataset,
  type MetrikaDataset,
} from '../metrika/analytics/metrika-query-catalog';
import {
  MetrikaReportFetcher,
  type FetchedQuery,
} from '../metrika/analytics/metrika-report-fetcher';
import { MetrikaPeriodSnapshotService } from '../metrika/analytics/metrika-period-snapshot.service';
import { PgAdvisoryLock } from '../metrika/analytics/metrika-sync-lock';
import { PrismaMetrikaSyncStore } from '../metrika/analytics/metrika-sync-store';

/**
 * Синхронизация отчётов Метрики в локальные таблицы и её проверка
 * (этап 07, разделы 22, 24–26, 29). Запускается из собранного dist:
 *
 *   npm run metrika:sync -- --from 2026-09-06 --to 2026-09-12
 *                                            — синхронизировать все наборы за период
 *   npm run metrika:sync -- --from … --to … --dataset traffic --dataset goals
 *                                            — только указанные наборы
 *   npm run metrika:sync -- status           — состояние таблиц и последние запуски (без API)
 *   npm run metrika:sync -- verify           — живая read-only проверка каждого запроса
 *                                              каталога за последние 3 дня; в базу не пишет
 *   npm run metrika:sync -- reconcile --from … --to …
 *                                            — локальные суммы против прямого запроса к API
 *   npm run metrika:sync -- quality --from … --to …
 *                                            — отчёт о качестве локальных данных (без API)
 *   npm run metrika:sync -- coverage --from … --to …
 *                                            — заказы CRM против целей «CRM: Заказ создан/оплачен»
 *   npm run metrika:sync -- snapshots [--from … --to …] [--list]
 *                                            — снимки периодов (уникальные за период; этап 08):
 *                                              восемь пресетов или произвольный период
 *
 * Токен не печатается никогда; в выводе — даты, числа, коды источников,
 * пути страниц. Ручной запуск работает независимо от рубильника
 * расписания YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED, но под той же
 * блокировкой: рядом с идущей синхронизацией он честно скажет LOCKED.
 *
 * Код выхода: 0 — успех; 1 — ошибка или провал части наборов; 2 — не
 * настроено / неверные аргументы.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  });
  return out;
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

function rangeFromArgs(): DateRange {
  const from = arg('--from');
  const to = arg('--to');
  if (!from || !to || !isIsoDate(from) || !isIsoDate(to)) {
    console.error('Нужны --from YYYY-MM-DD и --to YYYY-MM-DD.');
    process.exit(2);
  }
  const range = { from, to };
  assertRange(range);
  return range;
}

function datasetsFromArgs(): MetrikaDataset[] | undefined {
  const given = args('--dataset');
  if (given.length === 0) return undefined;
  const bad = given.filter((d) => !isDataset(d));
  if (bad.length > 0) {
    console.error(
      `Неизвестные наборы: ${bad.join(', ')}. Доступны: ${ALL_DATASETS.join(', ')}.`,
    );
    process.exit(2);
  }
  return given as MetrikaDataset[];
}

function requireConfigured(client: YandexMetrikaClient): void {
  if (!client.isConfigured()) {
    console.error(
      'Клиент Метрики не настроен: нужны YANDEX_METRIKA_COUNTER_ID и YANDEX_METRIKA_OAUTH_TOKEN.',
    );
    process.exit(2);
  }
}

function printSummary(s: SyncSummary): void {
  console.log(
    `Синхронизация ${s.range.from}..${s.range.to} (${s.trigger}), запуск ${s.batchId}: ${s.status}`,
  );
  if (s.error) console.log(`  ${s.error}`);
  if (s.goals) {
    const r = s.goals.resolution;
    console.log(
      `  целей в счётчике: ${s.goals.total}; канонические не найдены: ${r.missing.length ? r.missing.join(', ') : 'нет'}` +
        (r.drift.length
          ? `; расхождение с манифестом: ${r.drift.map((d) => `${d.key} ${d.expected}→${d.actual}`).join(', ')}`
          : ''),
    );
  }
  for (const d of s.datasets) {
    console.log(
      `  ${d.dataset.padEnd(9)} ${d.status.padEnd(8)} получено ${String(d.rowsReceived).padStart(5)}, записано ${String(d.rowsStored).padStart(5)}, ` +
        `запросов ${d.requests}, sampled=${d.sampled} share=${d.sampleShare} lag=${d.dataLag ?? '—'} accuracy=${d.accuracy}, ${d.durationMs} мс` +
        (d.error ? `\n            ошибка: ${d.error}` : ''),
    );
  }
  console.log(
    `  запросов к API всего: ${s.requests}; длительность ${s.durationMs} мс`,
  );
}

async function runSync(
  prisma: PrismaClient,
  client: YandexMetrikaClient,
): Promise<number> {
  requireConfigured(client);
  const range = rangeFromArgs();
  const datasets = datasetsFromArgs();
  const service = new MetrikaAnalyticsSyncService(
    new PrismaMetrikaSyncStore(prisma as unknown as PrismaService),
    client,
    new PgAdvisoryLock(process.env.DATABASE_URL as string),
  );
  const summary = await service.sync({ range, datasets, trigger: 'cli' });
  printSummary(summary);
  return summary.status === 'SUCCESS' ? 0 : 1;
}

async function status(
  prisma: PrismaClient,
  client: YandexMetrikaClient,
): Promise<number> {
  console.log(
    `Расписание (YANDEX_METRIKA_ANALYTICS_SYNC_ENABLED): ${metrikaAnalyticsSyncEnabledFromEnv() ? 'включено' : 'выключено'}; клиент: ${client.isConfigured() ? 'настроен' : 'не настроен'}`,
  );
  const states = await datasetStates(prisma);
  console.log('Наборы:');
  for (const s of states) {
    console.log(
      `  ${s.dataset.padEnd(9)} строк ${String(s.rows).padStart(6)}  даты ${s.minDate ?? '—'}..${s.maxDate ?? '—'}`,
    );
    if (s.lastRun) {
      const r = s.lastRun;
      console.log(
        `            последний запуск: ${r.status} ${fmt(r.startedAt)} → ${fmt(r.finishedAt)} UTC, ${r.range.from}..${r.range.to}, ` +
          `записано ${r.rowsStored}, запросов ${r.requestCount}, sampled=${r.sampled ?? '—'}, ${r.trigger}` +
          (r.lastError ? `\n            ошибка: ${r.lastError}` : ''),
      );
    } else {
      console.log('            запусков ещё не было');
    }
  }
  const recent = await prisma.metrikaSyncRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10,
  });
  console.log('Последние запуски:');
  for (const r of recent) {
    console.log(
      `  ${fmt(r.startedAt)}  ${r.status.padEnd(7)} ${r.dataset.padEnd(9)} ${r.dateFrom.toISOString().slice(0, 10)}..${r.dateTo.toISOString().slice(0, 10)}  ` +
        `строк ${r.rowsStored}/${r.rowsReceived}  запросов ${r.requestCount}  ${r.trigger}` +
        (r.lastError ? `  ошибка: ${r.lastError.slice(0, 100)}` : ''),
    );
  }
  if (recent.length === 0) console.log('  (пусто)');
  return 0;
}

async function verify(client: YandexMetrikaClient): Promise<number> {
  requireConfigured(client);
  const range = rollingWindow(3);
  const goals = await client.getGoals();
  const resolution = resolveCanonicalGoals(goals);
  const ctx = { goals, registry: resolution.registry };
  console.log(
    `Живая проверка каталога за ${range.from}..${range.to} (только чтение, в базу не пишется)`,
  );
  console.log(
    `Целей в счётчике: ${goals.length}; канонические не найдены: ${resolution.missing.length ? resolution.missing.join(', ') : 'нет'}`,
  );
  const r = resolution.registry;
  console.log(
    `  lead=${r.canonicalLeadGoalId} photo=${r.photoLeadGoalId} canvas=${r.canvasLeadGoalId} tshirt=${r.tshirtLeadGoalId} form_error=${r.formErrorGoalId} ` +
      `crm_created=${r.crmOrderCreatedGoalId} crm_paid=${r.crmOrderPaidGoalId} crm_cancelled=${r.crmOrderCancelledGoalId} crm_spam=${r.crmOrderSpamGoalId} thanks=${r.legacyThanksGoalId}`,
  );
  const fetcher = new MetrikaReportFetcher(client);
  let failed = 0;
  for (const dataset of ALL_DATASETS) {
    const spec = DATASET_SPECS[dataset];
    try {
      const queries = spec.queries(ctx);
      const fetched: FetchedQuery[] = [];
      for (const q of queries) fetched.push(await fetcher.fetch(q, range));
      const rows = spec.parse(fetched, ctx);
      const received = fetched.reduce((s, f) => s + f.rows.length, 0);
      const requests = fetched.reduce((s, f) => s + f.meta.requests, 0);
      const sampled = fetched.some((f) => f.meta.sampled);
      console.log(
        `OK   ${dataset.padEnd(9)} запросов ${requests}, измерения [${queries[0].dimensions.join(', ')}], метрик ${queries.map((q) => q.metrics.length).join('+')}, ` +
          `строк API ${received} → локальных ${rows.length}, sampled=${sampled}`,
      );
      const sample = rows
        .slice(0, 3)
        .map((row) => JSON.stringify(row))
        .join('\n       ');
      if (sample) console.log(`       ${sample}`);
    } catch (e) {
      failed += 1;
      const msg =
        e instanceof MetrikaApiError
          ? `${e.kind}, HTTP ${e.status}: ${e.humanMessage}`
          : e instanceof Error
            ? e.message
            : String(e);
      console.log(`FAIL ${dataset.padEnd(9)} ${msg}`);
    }
  }
  return failed === 0 ? 0 : 1;
}

async function reconcileCmd(
  prisma: PrismaClient,
  client: YandexMetrikaClient,
): Promise<number> {
  requireConfigured(client);
  const range = rangeFromArgs();
  const { registry, source } = await registryForReading(client);
  const res = await reconcile(prisma, client, range, registry);
  console.log(
    `Сверка локальных таблиц с прямым запросом к Reports API за ${range.from}..${range.to} (цели: ${source})`,
  );
  console.log(
    `  ${'metric'.padEnd(40)} | ${'local'.padStart(8)} | ${'direct API'.padStart(10)} | difference`,
  );
  let mismatches = 0;
  for (const l of res.lines) {
    const diff = l.difference === null ? '—' : String(l.difference);
    if (l.difference !== null && l.difference !== 0) mismatches += 1;
    console.log(
      `  ${l.metric.padEnd(40)} | ${String(l.local ?? '—').padStart(8)} | ${String(l.direct ?? '—').padStart(10)} | ${diff}`,
    );
  }
  console.log(
    `  справочно: уникальных посетителей за период по API — ${res.directUsersPeriod ?? '—'} (не сумма дневных)`,
  );
  console.log(
    `  sampled в прямых запросах: ${res.sampled}; запросов: ${res.requests}; расхождений: ${mismatches}`,
  );
  return mismatches === 0 ? 0 : 1;
}

async function qualityCmd(
  prisma: PrismaClient,
  client: YandexMetrikaClient,
): Promise<number> {
  const range = rangeFromArgs();
  const { registry, source } = await registryForReading(
    client.isConfigured() ? client : null,
  );
  const q = await dataQuality(prisma, range, registry);
  console.log(
    `Качество локальных данных за ${range.from}..${range.to} (цели: ${source})`,
  );
  console.log(
    `  даты с трафиком:        ${q.earliestDate ?? '—'}..${q.latestDate ?? '—'}`,
  );
  console.log(
    `  строк по наборам:       ${ALL_DATASETS.map((d) => `${d} ${q.rowsPerDataset[d]}`).join(', ')}`,
  );
  console.log(
    `  семплированные запуски: ${q.sampledRuns.length ? q.sampledRuns.map((r) => `${r.dataset} ${r.range.from}..${r.range.to} (${r.sampleShare})`).join('; ') : 'нет'}`,
  );
  console.log(
    `  дней без трафика:       ${q.zeroTrafficDays.length}${q.zeroTrafficDays.length ? ` (${q.zeroTrafficDays[0]}..${q.zeroTrafficDays[q.zeroTrafficDays.length - 1]})` : ''}`,
  );
  console.log(
    `  источник не определён:  строк ${q.emptySourceRows.rows}, визитов ${q.emptySourceRows.visits}`,
  );
  console.log(
    `  без UTM:                строк ${q.emptyUtmRows.rows}, визитов ${q.emptyUtmRows.visits} из ${q.emptyUtmRows.totalVisits}`,
  );
  console.log('  топ источников:');
  for (const s of q.topSources)
    console.log(
      `    ${s.source.padEnd(10)} ${s.engine.padEnd(24)} ${s.visits}`,
    );
  console.log('  топ UTM-кампаний:');
  if (q.topUtmCampaigns.length === 0) console.log('    (визитов с UTM нет)');
  for (const u of q.topUtmCampaigns)
    console.log(`    ${u.source} / ${u.medium} / ${u.campaign}  ${u.visits}`);
  console.log('  топ страниц входа:');
  for (const l of q.topLandings)
    console.log(`    ${l.path.padEnd(40)} ${l.visits}`);
  console.log(`  lead_submitted:         ${q.leadReaches ?? '—'}`);
  console.log(`  CRM: Заказ создан:      ${q.orderCreatedReaches ?? '—'}`);
  console.log(`  CRM: Заказ оплачен:     ${q.orderPaidReaches ?? '—'}`);
  console.log(
    `  ошибки API (FAILED):    ${q.failedRuns.length ? q.failedRuns.map((f) => `${f.dataset} ${fmt(f.startedAt)}: ${f.error ?? '—'}`).join('; ') : 'нет'}`,
  );
  return 0;
}

async function coverageCmd(
  prisma: PrismaClient,
  client: YandexMetrikaClient,
): Promise<number> {
  const range = rangeFromArgs();
  const { registry, source } = await registryForReading(
    client.isConfigured() ? client : null,
  );
  const c = await crmCoverage(prisma, range, registry);
  console.log(
    `Покрытие заказов CRM целями Метрики за ${range.from}..${range.to} по московским суткам (цели: ${source})`,
  );
  console.log(
    `  CRM accepted (стали заказом):     ${c.crmAccepted}  из них с ClientID ${c.crmAcceptedWithClientId}, созданы до включения воркера ${c.crmAcceptedBeforeLive}, контрольный тест ${c.crmAcceptedControlledTest}, доставлены очередью ${c.crmAcceptedDeliveredToMetrika}`,
  );
  console.log(
    `  Metrika «CRM: Заказ создан»:      ${c.metrikaOrderCreated ?? '—'}`,
  );
  console.log(
    `  CRM PAID (clientPaidAt):          ${c.crmPaid}  из них с ClientID ${c.crmPaidWithClientId}, оплачены до включения воркера ${c.crmPaidBeforeLive}`,
  );
  console.log(
    `  Metrika «CRM: Заказ оплачен»:     ${c.metrikaOrderPaid ?? '—'}`,
  );
  console.log(`  строк очереди delivered за период: ${c.outboxDelivered}`);
  return 0;
}

/**
 * Снимки периодов (этап 08): без аргументов — восемь пресетов; с --from/--to —
 * произвольный период (так снимок для нестандартных дат создаётся
 * контролируемо, а не из запроса интерфейса). `--list` — что уже есть.
 */
async function snapshotsCmd(
  prisma: PrismaClient,
  client: YandexMetrikaClient,
): Promise<number> {
  const service = new MetrikaPeriodSnapshotService(
    prisma as unknown as PrismaService,
    client,
  );
  if (flag('--list')) {
    const rows = await service.list();
    console.log(`Снимки периодов в базе: ${rows.length}`);
    for (const r of rows) {
      console.log(
        `  ${r.range.from}..${r.range.to}  users ${String(r.users).padStart(5)}  visits ${String(r.visits).padStart(5)}  pageviews ${String(r.pageviews).padStart(6)}  sampled=${r.sampled}  ${fmt(r.fetchedAt)} UTC  ${r.preset ?? '(произвольный)'}`,
      );
    }
    return 0;
  }
  requireConfigured(client);
  const outcomes =
    arg('--from') && arg('--to')
      ? [await service.refreshRange(rangeFromArgs())]
      : await service.refreshPresets();
  let failed = 0;
  for (const o of outcomes) {
    if (o.status === 'FAILED') failed += 1;
    console.log(
      `  ${(o.preset ?? 'custom').padEnd(17)} ${o.range.from}..${o.range.to}  ${o.status.padEnd(7)} users ${String(o.users ?? '—').padStart(5)}  visits ${String(o.visits ?? '—').padStart(5)}  pageviews ${String(o.pageviews ?? '—').padStart(6)}  sampled=${o.sampled ?? '—'}  запросов ${o.requests}` +
        (o.error ? `  ошибка: ${o.error}` : ''),
    );
  }
  console.log(
    `Снимков обновлено: ${outcomes.length - failed}/${outcomes.length}; запросов к API: ${outcomes.reduce((s, o) => s + o.requests, 0)}`,
  );
  return failed === 0 ? 0 : 1;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

async function main(): Promise<void> {
  const command = process.argv[2]?.startsWith('--')
    ? 'sync'
    : (process.argv[2] ?? 'sync');
  const client = new YandexMetrikaClient(metrikaConfigFromEnv());
  if (command === 'verify') {
    process.exit(await verify(client));
  }
  const prisma = openPrisma();
  try {
    let code: number;
    switch (command) {
      case 'sync':
        code = await runSync(prisma, client);
        break;
      case 'status':
        code = await status(prisma, client);
        break;
      case 'reconcile':
        code = await reconcileCmd(prisma, client);
        break;
      case 'quality':
        code = await qualityCmd(prisma, client);
        break;
      case 'coverage':
        code = await coverageCmd(prisma, client);
        break;
      case 'snapshots':
        code = await snapshotsCmd(prisma, client);
        break;
      default:
        console.error(
          `Неизвестная команда: ${command}. Доступны: sync (по умолчанию), status, verify, reconcile, quality, coverage, snapshots.`,
        );
        code = 2;
    }
    process.exit(code);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof MetrikaApiError) {
    console.error(
      `Метрика: ошибка (${error.kind}, HTTP ${error.status}): ${error.humanMessage}`,
    );
  } else {
    console.error(
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error),
    );
  }
  process.exit(1);
});
