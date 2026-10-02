/**
 * Фундамент «Каналы»: откуда берутся заказы и что происходит на сайте.
 *
 * Здесь два разных источника правды, и путать их нельзя. Заказы по
 * источникам — из CRM: это факт, заведённый человеком или сайтом. Трафик
 * сайта — из локальных копий отчётов Метрики, которые CRM синхронизирует
 * по дням. Счётчик Метрики на сайте срабатывает только после согласия на
 * cookie, поэтому визитов в Метрике всегда меньше, чем заходов на сайт,
 * и сравнивать её визиты с кликами кабинета напрямую неверно. Об этом
 * сказано в ответе каждого инструмента, который читает Метрику: иначе
 * модель объяснит разрыв падением интереса, а не настройкой согласия.
 */

import { read } from '../db.js';
import { resolvePeriod, sqlRange } from '../period.js';
import { answer, int, money, per, share, table } from '../format.js';
import { SOURCE_LABELS, label, paidSql } from '../statuses.js';
import { limitSchema, periodSchema, readLimit, type Tool } from './types.js';

export const channelsSummary: Tool = {
  name: 'channels_summary',
  title: 'Заказы по источникам',
  description:
    'Все источники заказов рядом: Авито, Ozon, WB, сайт, самотёк — заявки, заказы, оплаты, выручка, средний чек, доля в выручке. ' +
    'Отвечает на «на чём мы живём» и «какой канал растёт». ' +
    'Расходов на канал не знает: комиссия площадок в CRM не хранится, реклама — в ad_spend.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const rows = await read<{
      src: string;
      zayavok: number;
      zakazov: number;
      oplacheno: number;
      vyruchka: number;
      summa_zakazov: number;
    }>(
      `SELECT o."sourceOrder"::text AS src,
              count(*)::int AS zayavok,
              count(*) FILTER (WHERE o.status NOT IN ('LEAD','CANCELLED'))::int AS zakazov,
              count(*) FILTER (WHERE ${paidSql()})::int AS oplacheno,
              COALESCE(sum(o."totalOrder") FILTER (WHERE ${paidSql()}), 0)::int AS vyruchka,
              COALESCE(sum(o."totalOrder") FILTER (WHERE o.status NOT IN ('LEAD','CANCELLED')), 0)::int AS summa_zakazov
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
        GROUP BY src
        ORDER BY summa_zakazov DESC`,
      [from, to],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Заказы по источникам',
        period: period.label,
        summary: ['За период заказов нет.'],
      });
    }

    const allOrders = rows.reduce((s, r) => s + r.zakazov, 0);
    const allSum = rows.reduce((s, r) => s + r.summa_zakazov, 0);

    return answer({
      title: 'Заказы по источникам',
      period: period.label,
      summary: [`Заказов: ${int(allOrders)} на ${money(allSum)} · средний чек: ${per(allSum, allOrders)}`],
      table: table(
        ['источник', 'заявок', 'заказов', 'сумма', 'доля', 'средний чек', 'оплачено', 'получено'],
        rows.map((r) => [
          label(SOURCE_LABELS, r.src),
          int(r.zayavok),
          int(r.zakazov),
          money(r.summa_zakazov),
          share(r.summa_zakazov, allSum),
          per(r.summa_zakazov, r.zakazov),
          int(r.oplacheno),
          money(r.vyruchka),
        ]),
      ),
      note:
        'Сайт — единственный источник, где заявка появляется без участия человека, поэтому у него есть шаг «обратился». У остальных заявка и заказ — одно и то же.',
    });
  },
};

export const siteTraffic: Tool = {
  name: 'site_traffic',
  title: 'Трафик сайта',
  description:
    'Визиты, посетители и достижения целей на сайте по дням — из локальной копии отчётов Метрики. ' +
    'Отвечает на «сколько людей было на сайте» и «сколько из них оставили заявку». ' +
    'Счётчик работает только после согласия на cookie, поэтому это нижняя граница, а не все заходы. ' +
    'Если за день синхронизации не было, дня в ответе не будет — это отсутствие данных, а не нулевой трафик.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });

    /**
     * Посетители за период НЕ суммируются: users в Метрике — уникальные
     * за день, один человек, заходивший трижды за неделю, попадёт в три дня.
     * Сумма дала бы число больше настоящего, и объяснить это в ответе было
     * бы нечем. Поэтому по посетителям отдаём среднее за день и говорим,
     * что уникальных за период здесь взять негде.
     */
    const totals = await read<{
      dney: number;
      visits: number;
      users_v_den: number | null;
      users_max: number;
      pageviews: number;
    }>(
      `SELECT count(*)::int AS dney,
              COALESCE(sum(t.visits), 0)::int AS visits,
              round(avg(t.users), 1)::float8 AS users_v_den,
              COALESCE(max(t.users), 0)::int AS users_max,
              COALESCE(sum(t.pageviews), 0)::int AS pageviews
         FROM "MetrikaDailyTraffic" t
        WHERE t.date >= $1::date AND t.date <= $2::date`,
      [period.from, period.to],
    );

    const t = totals[0];
    if (!t || t.dney === 0) {
      return answer({
        title: 'Трафик сайта',
        period: period.label,
        summary: [
          'За период нет ни одного дня с данными Метрики. Синхронизация могла не запускаться — цифры трафика брать неоткуда.',
        ],
      });
    }

    const goals = await read<{ goalName: string; reaches: number; goalVisits: number }>(
      `SELECT g."goalName",
              COALESCE(sum(g.reaches), 0)::int AS reaches,
              COALESCE(sum(g."goalVisits"), 0)::int AS "goalVisits"
         FROM "MetrikaDailyGoal" g
        WHERE g.date >= $1::date AND g.date <= $2::date
        GROUP BY g."goalName"
        ORDER BY "goalVisits" DESC
        LIMIT 12`,
      [period.from, period.to],
    );

    const sources = await read<{
      name: string;
      visits: number;
      leads: number;
      paid: number;
    }>(
      `SELECT CASE WHEN s."trafficSourceName" <> '' THEN s."trafficSourceName"
                   ELSE COALESCE(NULLIF(s."trafficSource", ''), 'не определён') END AS name,
              COALESCE(sum(s.visits), 0)::int AS visits,
              COALESCE(sum(s."leadReaches"), 0)::int AS leads,
              COALESCE(sum(s."orderPaidReaches"), 0)::int AS paid
         FROM "MetrikaDailySource" s
        WHERE s.date >= $1::date AND s.date <= $2::date
        GROUP BY name
        ORDER BY visits DESC
        LIMIT 12`,
      [period.from, period.to],
    );

    const parts: string[] = [
      `Визитов: ${int(t.visits)} · просмотров: ${int(t.pageviews)} · страниц за визит: ${(t.pageviews / Math.max(t.visits, 1)).toFixed(1)}`,
      `Посетителей в среднем за день: ${t.users_v_den === null ? '—' : t.users_v_den.toFixed(1)} · лучший день: ${int(t.users_max)}`,
      `Данные есть за ${int(t.dney)} дней из периода.`,
    ];

    const tables = [
      sources.length
        ? 'Источники трафика:\n' +
          table(
            ['источник', 'визитов', 'доля', 'заявок', 'оплат', 'визит → заявка'],
            sources.map((s) => [
              s.name,
              int(s.visits),
              share(s.visits, t.visits),
              int(s.leads),
              int(s.paid),
              share(s.leads, s.visits),
            ]),
          )
        : null,
      goals.length
        ? 'Цели:\n' +
          table(
            ['цель', 'достижений', 'целевых визитов', 'от всех визитов'],
            goals.map((g) => [
              g.goalName,
              int(g.reaches),
              int(g.goalVisits),
              share(g.goalVisits, t.visits),
            ]),
          )
        : null,
    ].filter(Boolean) as string[];

    return answer({
      title: 'Трафик сайта',
      period: period.label,
      summary: parts,
      table: tables.join('\n\n'),
      note:
        'Посетители за период не складываются из дней: в Метрике это уникальные за день, и один человек за неделю попадёт в несколько дней. Уникальных за период здесь взять негде — за ними в интерфейс Метрики. ' +
        'Заявки в Метрике и заявки в CRM — два разных счёта: в Метрике это достижения цели в визитах, давших согласие на cookie, в CRM — заведённые заказы. Метрика всегда занижена; расхождение нормально, вопрос только в его размере.',
    });
  },
};

export const siteLandings: Tool = {
  name: 'site_landings',
  title: 'Страницы входа',
  description:
    'С каких страниц люди заходят на сайт и какие из них дают заявки — визиты, заявки, конверсия по страницам входа. ' +
    'Отвечает на «какая страница работает, а какая только собирает трафик». ' +
    'Это страница входа, а не страница, с которой отправлена заявка. Ограничение то же: только визиты с согласием на cookie.',
  schema: { ...periodSchema, limit: limitSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const limit = readLimit(args);

    const rows = await read<{
      path: string;
      visits: number;
      leads: number;
      created: number;
      paid: number;
    }>(
      `SELECT l."normalizedPath" AS path,
              COALESCE(sum(l.visits), 0)::int AS visits,
              COALESCE(sum(l."leadReaches"), 0)::int AS leads,
              COALESCE(sum(l."orderCreatedReaches"), 0)::int AS created,
              COALESCE(sum(l."orderPaidReaches"), 0)::int AS paid
         FROM "MetrikaDailyLanding" l
        WHERE l.date >= $1::date AND l.date <= $2::date
        GROUP BY path
        ORDER BY visits DESC
        LIMIT $3`,
      [period.from, period.to, limit],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Страницы входа',
        period: period.label,
        summary: ['За период нет данных по страницам входа — синхронизация Метрики за эти дни не проходила.'],
      });
    }

    const visits = rows.reduce((s, r) => s + r.visits, 0);
    const leads = rows.reduce((s, r) => s + r.leads, 0);

    return answer({
      title: 'Страницы входа',
      period: period.label,
      summary: [
        `Показаны ${rows.length} страниц: ${int(visits)} визитов, ${int(leads)} заявок, конверсия ${share(leads, visits)}`,
      ],
      table: table(
        ['страница', 'визитов', 'заявок', 'конверсия', 'заказов', 'оплат'],
        rows.map((r) => [
          r.path || '/',
          int(r.visits),
          int(r.leads),
          share(r.leads, r.visits),
          int(r.created),
          int(r.paid),
        ]),
      ),
      note:
        'По страницам с десятком визитов конверсия ничего не значит — разница в один заказ меняет её в разы. Сравнивать стоит страницы с сотнями визитов.',
    });
  },
};

export const channelTools = [channelsSummary, siteTraffic, siteLandings];
