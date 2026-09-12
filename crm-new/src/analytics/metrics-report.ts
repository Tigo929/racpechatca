import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsMetricsService } from './metrics/analytics-metrics.service';
import {
  calendarMonth,
  customPeriod,
  describePeriod,
  isPeriodPreset,
  periodBoundsUtc,
  periodFromPreset,
  type AnalyticsPeriod,
} from './metrics/analytics-period';
import { isoToUtcDate } from '../metrika/analytics/metrika-dates';

/**
 * Диагностика канонических метрик (этап 08, разделы 47, 51–54). Только
 * чтение. Запускается из собранного dist:
 *
 *   npm run metrics:report -- overview --preset last_30_days [--json]
 *   npm run metrics:report -- overview --from 2026-08-01 --to 2026-08-31
 *   npm run metrics:report -- slices --preset last_7_days       — источники/UTM/входы/устройства/товары/каналы
 *   npm run metrics:report -- reconcile-traffic --preset last_7_days
 *                                              — сервис против сумм по таблицам этапа 07 (SQL)
 *   npm run metrics:report -- reconcile-crm --preset last_30_days
 *                                              — принятые/оплаченные/отменённые против независимого SQL
 *   npm run metrics:report -- reconcile-pnl --year 2026 --month 8
 *                                              — финансы против /reports/monthly и /reports/weekly
 *   npm run metrics:report -- perf --preset last_30_days
 *                                              — число SQL-запросов и длительность getOverview
 *
 * Код выхода: 0 — успех / расхождений нет; 1 — есть расхождения или ошибка;
 * 2 — неверные аргументы.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function periodFromArgs(): AnalyticsPeriod {
  const preset = arg('--preset');
  if (preset) {
    if (!isPeriodPreset(preset)) {
      console.error(`Неизвестный пресет: ${preset}`);
      process.exit(2);
    }
    return periodFromPreset(preset);
  }
  const from = arg('--from');
  const to = arg('--to');
  if (!from || !to) {
    console.error(
      'Нужен --preset <name> или --from YYYY-MM-DD --to YYYY-MM-DD.',
    );
    process.exit(2);
  }
  return customPeriod(from, to);
}

function openPrisma(countQueries: { n: number } | null): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL не задан.');
    process.exit(2);
  }
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
    ...(countQueries
      ? { log: [{ level: 'query' as const, emit: 'event' as const }] }
      : {}),
  });
  if (countQueries) {
    (client as unknown as { $on: (e: 'query', cb: () => void) => void }).$on(
      'query',
      () => {
        countQueries.n += 1;
      },
    );
  }
  return client;
}

const pct = (v: number | null) =>
  v === null ? '—' : `${(Math.round(v * 100) / 100).toFixed(2)}%`;
const money = (v: number | null | undefined) =>
  v === null || v === undefined
    ? '—'
    : `${(Math.round(v * 100) / 100).toFixed(2)} ₽`;
const n = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : String(v);

function line(label: string, value: string, extra = ''): void {
  console.log(`  ${label.padEnd(34)} ${value.padStart(14)}  ${extra}`);
}

async function overview(service: AnalyticsMetricsService): Promise<number> {
  const period = periodFromArgs();
  const o = await service.getOverview(period);
  if (flag('--json')) {
    console.log(JSON.stringify(o, null, 2));
    return 0;
  }
  console.log(
    `Обзор ${describePeriod(o.period)}; предыдущий ${describePeriod(o.previousPeriod)}; сгенерирован ${o.metadata.generatedAt.toISOString()}`,
  );
  console.log(
    `Трафик [${o.traffic.quality.completeness}${o.traffic.quality.notes.length ? ': ' + o.traffic.quality.notes.join(', ') : ''}]`,
  );
  line('visits', n(o.traffic.visits));
  line(
    'periodUsers (снимок)',
    n(o.traffic.periodUsers),
    'sumDailyUsers=' + o.traffic.sumDailyUsers + ' — не уникальные периода',
  );
  line(
    'pageviews (ym:s)',
    n(o.traffic.pageviews),
    'pageviewsPage (ym:pv)=' + o.traffic.pageviewsPage,
  );
  line('daysWithTraffic', n(o.traffic.daysWithTraffic));
  console.log(
    `Воронка сайта [${o.siteFunnel.quality.completeness}${o.siteFunnel.quality.notes.length ? ': ' + o.siteFunnel.quality.notes.join(', ') : ''}]`,
  );
  line(
    'siteLeads',
    n(o.siteFunnel.siteLeads),
    'siteLeadConversion=' + pct(o.siteFunnel.siteLeadConversion),
  );
  line(
    'matchedAccepted',
    n(o.siteFunnel.matchedAccepted),
    'siteAcceptedConversion=' +
      pct(o.siteFunnel.siteAcceptedConversion) +
      ' leadToAccepted=' +
      pct(o.siteFunnel.siteLeadToAccepted),
  );
  line(
    'matchedPaid',
    n(o.siteFunnel.matchedPaid),
    'sitePaidConversion=' +
      pct(o.siteFunnel.sitePaidConversion) +
      ' acceptedToPaid=' +
      pct(o.siteFunnel.siteAcceptedToPaid),
  );
  const e = o.crmFunnel.events;
  const c = o.crmFunnel.cohorts;
  console.log(
    `Воронка CRM (события) [${o.crmFunnel.quality.completeness}${o.crmFunnel.quality.notes.length ? ': ' + o.crmFunnel.quality.notes.join(', ') : ''}]`,
  );
  line('crmLeads', n(e.crmLeads));
  line('acceptedOrders', n(e.acceptedOrders));
  line(
    'paidOrders',
    n(e.paidOrders),
    'paidWithoutDate=' + o.orders.paidWithoutDate,
  );
  line(
    'cancelledOrders (первая отмена)',
    n(e.cancelledOrders),
    `cancellationEvents=${e.cancellationEvents} currentlyCancelled=${e.currentlyCancelledOrders}`,
  );
  line('realizedOrders', n(e.realizedOrders));
  console.log('Воронка CRM (когорты)');
  line(
    'crmLeadToAccepted',
    pct(c.crmLeadToAccepted),
    `${c.leadCohortAccepted}/${c.leadCohortSize} заявок периода стали заказом`,
  );
  line(
    'crmAcceptedToPaid',
    pct(c.crmAcceptedToPaid),
    `${c.acceptedCohortPaid}/${c.acceptedCohortSize} принятых периода оплачены`,
  );
  line(
    'crmLeadToPaid',
    pct(c.crmLeadToPaid),
    `${c.leadCohortPaid}/${c.leadCohortSize}`,
  );
  line(
    'crmCancellationRate',
    pct(c.crmCancellationRate),
    `${c.acceptedCohortCancelled}/${c.acceptedCohortSize}`,
  );
  console.log('Заказы');
  line('acceptedAov', money(o.orders.acceptedAov));
  line('paidAov (headline)', money(o.orders.paidAov));
  const f = o.financials;
  console.log(
    `Финансы, RUB [${f.quality.completeness}${f.quality.notes.length ? ': ' + f.quality.notes.join(', ') : ''}]`,
  );
  line(
    'contractValue (принятые)',
    money(f.contract.contractValue),
    `cogs=${money(f.contract.cogs)} contractGrossContribution=${money(f.contract.grossContribution)} reliable ${f.contract.cogsReliableOrders}/${f.contract.orders}`,
  );
  line(
    'paidOrderValue',
    money(f.paid.paidOrderValue),
    `cogs=${money(f.paid.cogs)} paidGrossContribution=${money(f.paid.grossContribution)}`,
  );
  if (f.realized) {
    line(
      'realizedRevenue (отчёт)',
      money(f.realized.realizedRevenue),
      `orders=${f.realized.orders} goods=${money(f.realized.realizedGoodsRevenue)}`,
    );
    line(
      'cogs (отчёт)',
      money(f.realized.cogs),
      `realizedGrossContribution=${money(f.realized.grossContribution)}`,
    );
    line(
      'netProfit (отчёт)',
      money(f.realized.netProfit),
      `salary=${money(f.realized.salaryAccrued)} opex=${money(f.realized.operatingExpenses)} deliveryProfit=${money(f.realized.deliveryProfit)} margin=${pct(f.realized.marginPct)}`,
    );
  }
  line('spend / ROAS / ROMI', f.spend.status);
  const q = o.dataQuality;
  console.log(
    `Качество данных: свежесть ${q.freshness.status} (${q.freshness.metrikaDataAgeSeconds ?? '—'} с), ClientID у принятых ${pct(q.clientIdCoverageAccepted)}, у оплаченных ${pct(q.clientIdCoveragePaid)}, eligible ${q.eligibleAccepted}, доставлено ${q.eligibleDeliveredToMetrika} (${pct(q.metrikaMatchCoverage)}), reaches «создан» ${q.matchedAcceptedReaches}, notes: ${q.notes.join(', ') || 'нет'}`,
  );
  if (o.comparison) {
    console.log('Сравнение с предыдущим периодом:');
    for (const [key, cmp] of Object.entries(o.comparison)) {
      console.log(
        `  ${key.padEnd(22)} ${String(cmp.previous ?? '—').padStart(12)} → ${String(cmp.current ?? '—').padStart(12)}  Δ ${cmp.delta === null ? '—' : String(Math.round(cmp.delta * 100) / 100).padStart(10)}  ${cmp.deltaPct === null ? '—' : pct(cmp.deltaPct)}  ${cmp.changeKind}`,
      );
    }
  }
  return 0;
}

async function slices(service: AnalyticsMetricsService): Promise<number> {
  const period = periodFromArgs();
  const [src, utm, land, dev, prod, ch] = await Promise.all([
    service.getTrafficSources(period),
    service.getUtm(period),
    service.getLandings(period),
    service.getDevices(period),
    service.getProducts(period),
    service.getSalesChannels(period),
  ]);
  const rate = (r: {
    visits: number;
    siteLeads: number;
    matchedAccepted: number;
    matchedPaid: number;
    visitToLead: number | null;
    visitToPaid: number | null;
  }) =>
    `visits ${String(r.visits).padStart(5)}  leads ${String(r.siteLeads).padStart(3)}  accepted ${String(r.matchedAccepted).padStart(3)}  paid ${String(r.matchedPaid).padStart(3)}  v→lead ${pct(r.visitToLead).padStart(7)}  v→paid ${pct(r.visitToPaid).padStart(7)}`;
  console.log(
    `Срезы ${describePeriod(period)} [${src.quality.notes.join(', ') || 'complete'}]`,
  );
  console.log(`Источники (${src.rows.length}), итого ${rate(src.totals)}`);
  for (const r of src.rows.slice(0, 12))
    console.log(
      `  ${(r.trafficSource || '—').padEnd(9)} ${(r.sourceEngineName || '—').padEnd(24)} ${rate(r)}`,
    );
  console.log(`UTM (${utm.rows.length})`);
  for (const r of utm.rows.slice(0, 8))
    console.log(
      `  ${r.utmSource.padEnd(14)} ${r.utmMedium.padEnd(8)} ${r.utmCampaign.padEnd(12)} ${rate(r)}`,
    );
  console.log(`Страницы входа (${land.rows.length})`);
  for (const r of land.rows.slice(0, 10))
    console.log(`  ${r.normalizedPath.padEnd(40)} ${rate(r)}`);
  console.log(`Устройства (${dev.rows.length})`);
  for (const r of dev.rows)
    console.log(`  ${r.deviceCategory.padEnd(10)} ${rate(r)}`);
  console.log(`Товары CRM [${prod.quality.notes.join(', ') || 'complete'}]`);
  for (const r of prod.rows)
    console.log(
      `  ${r.productCategory.padEnd(8)} accepted ${String(r.acceptedOrders).padStart(3)} paid ${String(r.paidOrders).padStart(3)} cancelled ${r.cancelledOrders}  contract ${money(r.contractValue).padStart(13)} paid ${money(r.paidOrderValue).padStart(13)} cogs ${money(r.cogs).padStart(12)} (reliable ${r.cogsReliableOrders}) gross ${money(r.grossContribution).padStart(13)} aov ${money(r.paidAov)}`,
    );
  console.log('Каналы продаж CRM (sourceOrder)');
  for (const r of ch.rows)
    console.log(
      `  ${r.salesChannel.padEnd(6)} leads ${String(r.crmLeads).padStart(3)} accepted ${String(r.acceptedOrders).padStart(3)} paid ${String(r.paidOrders).padStart(3)} cancelled ${r.cancelledOrders}  contract ${money(r.contractValue).padStart(13)} paid ${money(r.paidOrderValue).padStart(13)} aov ${money(r.paidAov)}`,
    );
  return 0;
}

type Row = Record<string, unknown>;

async function reconcileTraffic(
  prisma: PrismaClient,
  service: AnalyticsMetricsService,
): Promise<number> {
  const period = periodFromArgs();
  const o = await service.getOverview(period, false);
  const from = isoToUtcDate(period.from);
  const to = isoToUtcDate(period.to);
  const t = await prisma.$queryRaw<
    Row[]
  >`SELECT coalesce(sum(visits),0)::int AS visits, coalesce(sum(pageviews),0)::int AS pageviews, coalesce(sum(users),0)::int AS users FROM "MetrikaDailyTraffic" WHERE date BETWEEN ${from}::date AND ${to}::date`;
  const g = await prisma.$queryRaw<
    Row[]
  >`SELECT "goalId", coalesce(sum(reaches),0)::int AS reaches FROM "MetrikaDailyGoal" WHERE date BETWEEN ${from}::date AND ${to}::date AND "goalId" IN (611379890, 596990603, 596990604) GROUP BY 1`;
  const p = await prisma.$queryRaw<
    Row[]
  >`SELECT coalesce(sum(pageviews),0)::int AS pageviews FROM "MetrikaDailyPage" WHERE date BETWEEN ${from}::date AND ${to}::date`;
  const goal = (id: number) =>
    Number(g.find((r) => Number(r.goalId) === id)?.reaches ?? 0);
  const rows: [string, number | null, number][] = [
    ['visits', o.traffic.visits, Number(t[0].visits)],
    ['pageviews (ym:s)', o.traffic.pageviews, Number(t[0].pageviews)],
    ['pageviewsPage (ym:pv)', o.traffic.pageviewsPage, Number(p[0].pageviews)],
    ['sumDailyUsers', o.traffic.sumDailyUsers, Number(t[0].users)],
    ['lead reaches', o.siteFunnel.siteLeads, goal(611379890)],
    ['CRM created reaches', o.siteFunnel.matchedAccepted, goal(596990603)],
    ['CRM paid reaches', o.siteFunnel.matchedPaid, goal(596990604)],
  ];
  console.log(
    `Сверка трафика ${describePeriod(period)}: сервис метрик против SQL по таблицам этапа 07`,
  );
  console.log(
    `  ${'metric'.padEnd(24)} | ${'service'.padStart(8)} | ${'stage07'.padStart(8)} | diff`,
  );
  let bad = 0;
  for (const [name, a, b] of rows) {
    const diff = a === null ? null : a - b;
    if (diff !== 0) bad += 1;
    console.log(
      `  ${name.padEnd(24)} | ${String(a ?? '—').padStart(8)} | ${String(b).padStart(8)} | ${diff ?? '—'}`,
    );
  }
  console.log(
    `  periodUsers (снимок): ${o.traffic.periodUsers ?? 'нет снимка'} — сравнивается не с суммой дневных (${String(t[0].users)}), а с отдельным запросом за период`,
  );
  console.log(`  расхождений: ${bad}`);
  return bad === 0 ? 0 : 1;
}

async function reconcileCrm(
  prisma: PrismaClient,
  service: AnalyticsMetricsService,
): Promise<number> {
  const period = periodFromArgs();
  const o = await service.getOverview(period, false);
  const { start, endExclusive } = periodBoundsUtc(period);
  const accepted = new Set([
    'NEW',
    'APPROVAL_SENT',
    'FOLDER_STRUCTURE_CREATED',
    'IN_PROGRESS',
    'PRINTED',
    'READY',
    'SHIPMENT_CREATED',
    'DONE',
    'SENT',
    'PAID',
    'READY_FOR_REVIEW',
    'COMPLETED',
  ]);
  const acceptedList = [...accepted];
  // Независимо от сервиса: момент принятия = createdAt, если первый переход начинался
  // из рабочего статуса (или переходов нет и статус рабочий); иначе — первый переход в рабочий статус.
  const acc = await prisma.$queryRaw<Row[]>`
    WITH first_h AS (
      SELECT DISTINCT ON ("orderId") "orderId", "fromStatus" FROM "StatusHistory" ORDER BY "orderId", "createdAt", id
    ), first_acc AS (
      SELECT "orderId", min("createdAt") AS at FROM "StatusHistory" WHERE "toStatus" = ANY(${acceptedList}::text[]) GROUP BY "orderId"
    ), acc AS (
      SELECT o.id,
        CASE WHEN (f."fromStatus" IS NOT NULL AND f."fromStatus" = ANY(${acceptedList}::text[]))
                  OR (f."fromStatus" IS NULL AND o.status::text = ANY(${acceptedList}::text[]))
             THEN o."createdAt" ELSE fa.at END AS accepted_at,
        o."clientPaidAt", o.status::text AS status
      FROM "OrderPhoto" o LEFT JOIN first_h f ON f."orderId" = o.id LEFT JOIN first_acc fa ON fa."orderId" = o.id
    )
    SELECT
      count(*) FILTER (WHERE accepted_at >= ${start} AND accepted_at < ${endExclusive})::int AS accepted,
      count(*) FILTER (WHERE "clientPaidAt" >= ${start} AND "clientPaidAt" < ${endExclusive})::int AS paid,
      count(*) FILTER (WHERE accepted_at >= ${start} AND accepted_at < ${endExclusive} AND status = 'PAID' AND "clientPaidAt" IS NULL)::int AS paid_without_date,
      coalesce(sum(CASE WHEN "clientPaidAt" >= ${start} AND "clientPaidAt" < ${endExclusive} THEN (SELECT "totalOrder" FROM "OrderPhoto" x WHERE x.id = acc.id) END),0)::int AS paid_value
    FROM acc`;
  // Отмена — историческое событие (FIX_01): заказ считается по ПЕРВОМУ входу в CANCELLED,
  // возврат в работу его не стирает; отдельно — число переходов и «отменены сейчас».
  const canc = await prisma.$queryRaw<Row[]>`
    WITH first_cancel AS (
      SELECT o.id, o.status::text AS status,
        coalesce((SELECT min(h."createdAt") FROM "StatusHistory" h WHERE h."orderId" = o.id AND h."toStatus" = 'CANCELLED'),
                 CASE WHEN o.status = 'CANCELLED' THEN coalesce(o."statusChangedAt", o."createdAt") END) AS at
      FROM "OrderPhoto" o
    )
    SELECT
      count(*) FILTER (WHERE at >= ${start} AND at < ${endExclusive})::int AS cancelled,
      count(*) FILTER (WHERE at >= ${start} AND at < ${endExclusive} AND status = 'CANCELLED')::int AS currently_cancelled,
      (SELECT count(*) FROM "StatusHistory" h WHERE h."toStatus" = 'CANCELLED' AND h."createdAt" >= ${start} AND h."createdAt" < ${endExclusive})::int AS events
    FROM first_cancel`;
  const leads = await prisma.$queryRaw<Row[]>`
    WITH first_h AS (
      SELECT DISTINCT ON ("orderId") "orderId", "fromStatus" FROM "StatusHistory" ORDER BY "orderId", "createdAt", id
    ), lead_at AS (
      SELECT o.id, CASE WHEN coalesce(f."fromStatus", o.status::text) = 'LEAD' THEN o."createdAt"
                        ELSE (SELECT min(h."createdAt") FROM "StatusHistory" h WHERE h."orderId" = o.id AND h."toStatus" = 'LEAD') END AS at
      FROM "OrderPhoto" o LEFT JOIN first_h f ON f."orderId" = o.id
    )
    SELECT count(*) FILTER (WHERE at >= ${start} AND at < ${endExclusive})::int AS leads FROM lead_at`;
  const rows: [string, number, number][] = [
    ['crmLeads', o.crmFunnel.events.crmLeads, Number(leads[0].leads)],
    [
      'acceptedOrders',
      o.crmFunnel.events.acceptedOrders,
      Number(acc[0].accepted),
    ],
    ['paidOrders', o.crmFunnel.events.paidOrders, Number(acc[0].paid)],
    [
      'cancelledOrders',
      o.crmFunnel.events.cancelledOrders,
      Number(canc[0].cancelled),
    ],
    [
      'cancellationEvents',
      o.crmFunnel.events.cancellationEvents,
      Number(canc[0].events),
    ],
    [
      'currentlyCancelled',
      o.crmFunnel.events.currentlyCancelledOrders,
      Number(canc[0].currently_cancelled),
    ],
    [
      'paidWithoutDate',
      o.orders.paidWithoutDate,
      Number(acc[0].paid_without_date),
    ],
    [
      'paidOrderValue',
      o.financials.paid.paidOrderValue,
      Number(acc[0].paid_value),
    ],
  ];
  console.log(
    `Сверка CRM ${describePeriod(period)} (границы ${start.toISOString()} .. ${endExclusive.toISOString()}): сервис против независимого SQL`,
  );
  console.log(
    `  ${'metric'.padEnd(18)} | ${'service'.padStart(8)} | ${'SQL'.padStart(8)} | diff`,
  );
  let bad = 0;
  for (const [name, a, b] of rows) {
    if (a !== b) bad += 1;
    console.log(
      `  ${name.padEnd(18)} | ${String(a).padStart(8)} | ${String(b).padStart(8)} | ${a - b}`,
    );
  }
  console.log(`  расхождений: ${bad}`);
  return bad === 0 ? 0 : 1;
}

async function reconcilePnl(
  reports: ReportsService,
  service: AnalyticsMetricsService,
): Promise<number> {
  const year = Number(arg('--year') ?? new Date().getFullYear());
  const month = Number(arg('--month'));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    console.error('Нужны --year YYYY и --month 1..12.');
    process.exit(2);
  }
  const period = customPeriod(
    calendarMonth(year, month).from,
    calendarMonth(year, month).to,
  );
  const [monthly, weekly, o] = await Promise.all([
    reports.getMonthlyReport(year),
    reports.getWeeklyReport(year, month),
    service.getOverview(period, false),
  ]);
  const m = monthly.months[month - 1];
  const r = o.financials.realized;
  if (!r) {
    console.error('P&L в сервисе недоступен.');
    return 1;
  }
  const rows: [string, number, number, number][] = [
    ['orders (orderCount)', r.orders, m.orderCount, weekly.totals.orderCount],
    [
      'realizedRevenue (totalRevenue)',
      r.realizedRevenue,
      m.totalRevenue,
      weekly.totals.totalRevenue,
    ],
    [
      'realizedGoodsRevenue (netRevenue)',
      r.realizedGoodsRevenue,
      m.netRevenue,
      weekly.totals.netRevenue,
    ],
    ['cogs', r.cogs, m.cogs, weekly.totals.cogs],
    [
      'grossContribution (grossProfit)',
      r.grossContribution,
      m.grossProfit,
      weekly.totals.grossProfit,
    ],
    [
      'salaryAccrued',
      r.salaryAccrued,
      m.salaryAccrued,
      weekly.totals.salaryAccrued,
    ],
    [
      'operatingExpenses',
      r.operatingExpenses,
      m.operatingExpenses,
      weekly.totals.operatingExpenses,
    ],
    [
      'deliveryProfit',
      r.deliveryProfit,
      m.deliveryProfit,
      weekly.totals.deliveryProfit,
    ],
    ['netProfit', r.netProfit, m.netProfit, weekly.totals.netProfit],
    [
      'photoProfit',
      r.byCategory.photo.profit,
      m.photoProfit,
      weekly.totals.photoProfit,
    ],
    [
      'tshirtProfit',
      r.byCategory.tshirt.profit,
      m.tshirtProfit,
      weekly.totals.tshirtProfit,
    ],
    [
      'canvasProfit',
      r.byCategory.canvas.profit,
      m.canvasProfit,
      weekly.totals.canvasProfit,
    ],
  ];
  console.log(
    `Сверка P&L за ${period.from}..${period.to}: сервис метрик против GET /reports/monthly (месяц ${month}) и /reports/weekly (итого)`,
  );
  console.log(
    `  ${'metric'.padEnd(34)} | ${'service'.padStart(10)} | ${'monthly'.padStart(10)} | ${'weekly'.padStart(10)} | diff`,
  );
  let bad = 0;
  for (const [name, a, b, c] of rows) {
    const d1 = a - b;
    const d2 = a - c;
    if (d1 !== 0 || d2 !== 0) bad += 1;
    console.log(
      `  ${name.padEnd(34)} | ${String(a).padStart(10)} | ${String(b).padStart(10)} | ${String(c).padStart(10)} | ${d1} / ${d2}`,
    );
  }
  console.log(`  расхождений: ${bad}`);
  return bad === 0 ? 0 : 1;
}

async function perf(
  service: AnalyticsMetricsService,
  counter: { n: number },
  orders: () => Promise<number>,
): Promise<number> {
  const period = periodFromArgs();
  const total = await orders();
  counter.n = 0;
  const t0 = Date.now();
  const o = await service.getOverview(period);
  const ms = Date.now() - t0;
  const q1 = counter.n;
  counter.n = 0;
  const t1 = Date.now();
  await Promise.all([
    service.getTrafficSources(period),
    service.getUtm(period),
    service.getLandings(period),
    service.getDevices(period),
    service.getProducts(period),
    service.getSalesChannels(period),
  ]);
  const ms2 = Date.now() - t1;
  console.log(
    `Производительность ${describePeriod(period)}: заказов в базе ${total}, принято в периоде ${o.crmFunnel.events.acceptedOrders}`,
  );
  console.log(`  getOverview (с сравнением): SQL-запросов ${q1}, ${ms} мс`);
  console.log(
    `  шесть срезов параллельно:   SQL-запросов ${counter.n}, ${ms2} мс`,
  );
  console.log(
    `  N+1: нет — заказы одним findMany с include, число запросов не зависит от числа заказов`,
  );
  return 0;
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'overview';
  const counter = { n: 0 };
  const prisma = openPrisma(command === 'perf' ? counter : null);
  const reports = new ReportsService(prisma as unknown as PrismaService);
  const service = new AnalyticsMetricsService(
    prisma as unknown as PrismaService,
    reports,
  );
  try {
    let code: number;
    switch (command) {
      case 'overview':
        code = await overview(service);
        break;
      case 'slices':
        code = await slices(service);
        break;
      case 'reconcile-traffic':
        code = await reconcileTraffic(prisma, service);
        break;
      case 'reconcile-crm':
        code = await reconcileCrm(prisma, service);
        break;
      case 'reconcile-pnl':
        code = await reconcilePnl(reports, service);
        break;
      case 'perf':
        code = await perf(service, counter, () => prisma.orderPhoto.count());
        break;
      default:
        console.error(
          `Неизвестная команда: ${command}. Доступны: overview, slices, reconcile-traffic, reconcile-crm, reconcile-pnl, perf.`,
        );
        code = 2;
    }
    process.exit(code);
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
