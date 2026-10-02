/**
 * Фундамент «Производство»: кто что делает, сколько это занимает,
 * что ушло партнёру и что висит в согласованиях и задачах.
 */

import { read } from '../db.js';
import { resolvePeriod, sqlRange } from '../period.js';
import { answer, int, money, per, share, table } from '../format.js';
import { CATEGORY_LABELS, STATUS_LABELS, label, paidSql } from '../statuses.js';
import { categorySchema, periodSchema, type Tool } from './types.js';

export const productionLoad: Tool = {
  name: 'production_load',
  title: 'Загрузка исполнителей',
  description:
    'Кто сколько делает: заказы на исполнителе за период, что из них закрыто, что ещё в работе, на какую сумму. ' +
    'Отвечает на «кто везёт», «кто перегружен», «у кого заказы стоят». ' +
    'Зарплату не считает — это salary_summary. Качество работы не оценивает: числа говорят об объёме, не о переделках.',
  schema: { ...periodSchema, category: categorySchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);
    const category = (args.category as string | undefined) ?? null;

    const rows = await read<{
      ispolnitel: string;
      vsego: number;
      zakryto: number;
      v_rabote: number;
      zavislo: number;
      summa: number;
      sredniy_srok: number | null;
    }>(
      `SELECT COALESCE(u.username, 'не назначен') AS ispolnitel,
              count(*)::int AS vsego,
              count(*) FILTER (WHERE o."closedAt" IS NOT NULL)::int AS zakryto,
              count(*) FILTER (WHERE o."closedAt" IS NULL)::int AS v_rabote,
              count(*) FILTER (
                WHERE o."closedAt" IS NULL
                  AND COALESCE(o."statusChangedAt", o."createdAt") < now() - interval '3 days'
              )::int AS zavislo,
              COALESCE(sum(o."totalOrder"), 0)::int AS summa,
              round(avg(
                EXTRACT(epoch FROM (o."sentAt" - o."createdAt")) / 86400
              ) FILTER (WHERE o."sentAt" IS NOT NULL), 1)::float8 AS sredniy_srok
         FROM "OrderPhoto" o
         LEFT JOIN "User" u ON u.id = o."executorId"
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o.status NOT IN ('LEAD','CANCELLED')
          AND ($3::text IS NULL OR o."productCategory"::text = $3)
        GROUP BY ispolnitel
        ORDER BY vsego DESC`,
      [from, to, category],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Загрузка исполнителей',
        period: period.label,
        summary: ['За период заказов в производстве нет.'],
      });
    }

    const vsego = rows.reduce((s, r) => s + r.vsego, 0);

    return answer({
      title: 'Загрузка исполнителей',
      period: period.label,
      summary: [
        `Заказов в производстве: ${int(vsego)} · в работе сейчас: ${int(rows.reduce((s, r) => s + r.v_rabote, 0))}`,
      ],
      table: table(
        ['исполнитель', 'заказов', 'доля', 'закрыто', 'в работе', 'стоят >3 дн.', 'сумма', 'срок до отправки, дн.'],
        rows.map((r) => [
          r.ispolnitel,
          int(r.vsego),
          share(r.vsego, vsego),
          int(r.zakryto),
          int(r.v_rabote),
          int(r.zavislo),
          money(r.summa),
          r.sredniy_srok === null ? '—' : r.sredniy_srok.toFixed(1),
        ]),
      ),
      note:
        '«Не назначен» — заказы без исполнителя: либо ещё не распределены, либо фотопечать, которую делают сами. Срок до отправки считается только по заказам, которые уже отправлены.',
    });
  },
};

export const productionCycle: Tool = {
  name: 'production_cycle',
  title: 'Сколько идёт заказ',
  description:
    'Сроки по этапам: от заявки до отправки и от заявки до денег — среднее, медиана и худший случай, по категориям товара. ' +
    'Отвечает на «сколько реально идёт заказ» и «где мы дольше всего держим клиента». ' +
    'Считает только по заказам, которые этап уже прошли: незакрытые в среднее не входят, поэтому оно всегда оптимистичнее жизни.',
  schema: { ...periodSchema, category: categorySchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);
    const category = (args.category as string | undefined) ?? null;

    const rows = await read<{
      cat: string;
      otpravleno: number;
      srok_otpravki: number | null;
      mediana_otpravki: number | null;
      hudshiy_otpravki: number | null;
      oplacheno: number;
      srok_oplaty: number | null;
      mediana_oplaty: number | null;
    }>(
      `SELECT o."productCategory"::text AS cat,
              count(*) FILTER (WHERE o."sentAt" IS NOT NULL)::int AS otpravleno,
              round(avg(EXTRACT(epoch FROM (o."sentAt" - o."createdAt")) / 86400), 1)::float8 AS srok_otpravki,
              round(percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(epoch FROM (o."sentAt" - o."createdAt")) / 86400
              )::numeric, 1)::float8 AS mediana_otpravki,
              round(max(EXTRACT(epoch FROM (o."sentAt" - o."createdAt")) / 86400)::numeric, 1)::float8 AS hudshiy_otpravki,
              count(*) FILTER (WHERE o."clientPaidAt" IS NOT NULL)::int AS oplacheno,
              round(avg(EXTRACT(epoch FROM (o."clientPaidAt" - o."createdAt")) / 86400), 1)::float8 AS srok_oplaty,
              round(percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(epoch FROM (o."clientPaidAt" - o."createdAt")) / 86400
              )::numeric, 1)::float8 AS mediana_oplaty
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o.status NOT IN ('LEAD','CANCELLED')
          AND ($3::text IS NULL OR o."productCategory"::text = $3)
        GROUP BY cat
        ORDER BY otpravleno DESC`,
      [from, to, category],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Сколько идёт заказ',
        period: period.label,
        summary: ['За период нет заказов, по которым можно считать сроки.'],
      });
    }

    const num = (v: number | null) => (v === null ? '—' : v.toFixed(1));

    return answer({
      title: 'Сколько идёт заказ, дней',
      period: period.label,
      table: table(
        ['товар', 'отправлено', 'до отправки: среднее', 'медиана', 'худший', 'оплачено', 'до оплаты: среднее', 'медиана'],
        rows.map((r) => [
          label(CATEGORY_LABELS, r.cat),
          int(r.otpravleno),
          num(r.srok_otpravki),
          num(r.mediana_otpravki),
          num(r.hudshiy_otpravki),
          int(r.oplacheno),
          num(r.srok_oplaty),
          num(r.mediana_oplaty),
        ]),
      ),
      note:
        'Медиана честнее среднего: один заказ, провисевший месяц, поднимает среднее, но медиану почти не двигает. Расхождение между ними и есть мера того, насколько ровно идёт поток. Дата оплаты заполняется с 11.09.2026.',
    });
  },
};

export const partnerDispatch: Tool = {
  name: 'partner_dispatch',
  title: 'Отправки партнёру',
  description:
    'Заказы, отданные партнёру на печать: что ушло, что не ушло и с какой ошибкой, сколько прошло с отправки. ' +
    'Отвечает на «всё ли ушло в печать» и «что застряло на отправке». ' +
    'Ответ партнёра (принял ли, напечатал ли) в CRM не приходит — здесь видно только нашу сторону: факт отправки и её результат.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const rows = await read<{
      sync: string;
      shtuk: number;
      summa: number;
      posledniy: Date | null;
    }>(
      `SELECT COALESCE(o."partnerSyncStatus"::text, 'не отправлялся') AS sync,
              count(*)::int AS shtuk,
              COALESCE(sum(o."totalOrder"), 0)::int AS summa,
              max(o."partnerSyncAt") AS posledniy
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o."productCategory" = 'TSHIRT'
          AND o.status NOT IN ('LEAD','CANCELLED')
        GROUP BY sync
        ORDER BY shtuk DESC`,
      [from, to],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Отправки партнёру',
        period: period.label,
        summary: ['За период заказов на футболки нет — отправлять партнёру было нечего.'],
      });
    }

    const failed = await read<{
      numberOrder: string;
      status: string;
      error: string | null;
      when: Date | null;
    }>(
      `SELECT o."numberOrder", o.status::text AS status, o."partnerSyncError" AS error, o."partnerSyncAt" AS when
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o."partnerSyncStatus" = 'FAILED'
        ORDER BY o."partnerSyncAt" DESC NULLS LAST
        LIMIT 10`,
      [from, to],
    );

    const labels: Record<string, string> = {
      SENT: 'Отправлен партнёру',
      PENDING: 'Ждёт отправки',
      FAILED: 'Отправка не удалась',
      'не отправлялся': 'Не отправлялся',
    };

    const tables = [
      table(
        ['состояние', 'заказов', 'сумма', 'последняя отправка'],
        rows.map((r) => [
          labels[r.sync] ?? r.sync,
          int(r.shtuk),
          money(r.summa),
          r.posledniy ? r.posledniy.toISOString().slice(0, 16).replace('T', ' ') : '—',
        ]),
      ),
      failed.length
        ? 'Неудачные отправки:\n' +
          table(
            ['заказ', 'статус', 'когда', 'ошибка'],
            failed.map((f) => [
              f.numberOrder,
              label(STATUS_LABELS, f.status),
              f.when ? f.when.toISOString().slice(0, 16).replace('T', ' ') : '—',
              (f.error ?? '').slice(0, 80) || '—',
            ]),
          )
        : null,
    ].filter(Boolean) as string[];

    return answer({
      title: 'Отправки партнёру',
      period: period.label,
      table: tables.join('\n\n'),
      note: 'Только футболки: остальные категории партнёру не уходят.',
    });
  },
};

export const approvalsStatus: Tool = {
  name: 'approvals_status',
  title: 'Согласования макетов',
  description:
    'Согласования макетов футболок: сколько версий сделано, сколько ушло клиенту, сколько подтверждено и сколько попросили переделать. ' +
    'Отвечает на «сколько макетов переделываем» и «что ждёт ответа клиента». ' +
    'Число версий на заказ — прямая мера переделок: две версии и больше означают, что первый макет не подошёл.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const byStatus = await read<{ status: string; versiy: number; zakazov: number }>(
      `SELECT a.status::text AS status,
              count(*)::int AS versiy,
              count(DISTINCT a."orderId")::int AS zakazov
         FROM "PrintApproval" a
        WHERE a."createdAt" >= $1 AND a."createdAt" < $2
        GROUP BY a.status
        ORDER BY versiy DESC`,
      [from, to],
    );

    if (byStatus.length === 0) {
      return answer({
        title: 'Согласования макетов',
        period: period.label,
        summary: ['За период согласования не создавались.'],
      });
    }

    const rework = await read<{ vsego: number; s_peredelkoy: number; maks: number }>(
      `SELECT count(*)::int AS vsego,
              count(*) FILTER (WHERE versions > 1)::int AS s_peredelkoy,
              COALESCE(max(versions), 0)::int AS maks
         FROM (
           SELECT a."orderId", count(*)::int AS versions
             FROM "PrintApproval" a
            WHERE a."createdAt" >= $1 AND a."createdAt" < $2
            GROUP BY a."orderId"
         ) q`,
      [from, to],
    );

    const labels: Record<string, string> = {
      DRAFT: 'Черновик',
      READY: 'Готов, клиенту не ушёл',
      SENT: 'Ушёл клиенту, ждём ответа',
      APPROVED: 'Клиент подтвердил',
      CHANGES_REQUESTED: 'Клиент попросил переделать',
    };

    const w = rework[0];

    return answer({
      title: 'Согласования макетов',
      period: period.label,
      summary: w
        ? [
            `Заказов с согласованием: ${int(w.vsego)} · с переделкой (больше одной версии): ${int(w.s_peredelkoy)} (${share(w.s_peredelkoy, w.vsego)})`,
            `Больше всего версий на один заказ: ${int(w.maks)}`,
          ]
        : undefined,
      table: table(
        ['состояние версии', 'версий', 'заказов'],
        byStatus.map((r) => [labels[r.status] ?? r.status, int(r.versiy), int(r.zakazov)]),
      ),
      note:
        'Версии не удаляются: по ним видно, что именно подтвердил клиент. Поэтому «версий» больше, чем «заказов», — это нормально, а не двойной счёт.',
    });
  },
};

export const tasksOpen: Tool = {
  name: 'tasks_open',
  title: 'Задачи из планировщика',
  description:
    'Задачи сотрудникам и локальным агентам: сколько открыто, сколько просрочено, кто чем занят, сколько закрыто за период. ' +
    'Отвечает на «что висит» и «что просрочено». Это планировщик задач, а не заказы: заказы — в orders_by_status.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const open = await read<{
      ispolnitel: string;
      kind: string;
      otkryto: number;
      prosrocheno: number;
      bez_sroka: number;
      nagrada: number;
    }>(
      `SELECT COALESCE(u.username, CASE t."assigneeKind"::text
                                    WHEN 'CODEX' THEN 'локальный агент (codex)'
                                    WHEN 'CLOUD_CODE' THEN 'локальный агент (cloud code)'
                                    ELSE 'не назначена' END) AS ispolnitel,
              t."assigneeKind"::text AS kind,
              count(*)::int AS otkryto,
              count(*) FILTER (WHERE t.deadline IS NOT NULL AND t.deadline < now())::int AS prosrocheno,
              count(*) FILTER (WHERE t.deadline IS NULL)::int AS bez_sroka,
              COALESCE(sum(t."rewardAmount"), 0)::int AS nagrada
         FROM "Task" t
         LEFT JOIN "User" u ON u.id = t."assigneeId"
        WHERE t.status IN ('OPEN','IN_PROGRESS')
        GROUP BY ispolnitel, kind
        ORDER BY otkryto DESC`,
    );

    const closed = await read<{ zakryto: number; otmeneno: number; vyplacheno: number }>(
      `SELECT count(*) FILTER (WHERE t.status = 'DONE')::int AS zakryto,
              count(*) FILTER (WHERE t.status = 'CANCELLED')::int AS otmeneno,
              COALESCE(sum(t."rewardAmount") FILTER (WHERE t.status = 'DONE'), 0)::int AS vyplacheno
         FROM "Task" t
        WHERE t."completedAt" >= $1 AND t."completedAt" < $2`,
      [from, to],
    );

    const c = closed[0];
    const totalOpen = open.reduce((s, r) => s + r.otkryto, 0);
    const overdue = open.reduce((s, r) => s + r.prosrocheno, 0);

    if (totalOpen === 0 && (!c || c.zakryto === 0)) {
      return answer({
        title: 'Задачи из планировщика',
        period: period.label,
        summary: ['Открытых задач нет, за период ничего не закрывали.'],
      });
    }

    return answer({
      title: 'Задачи из планировщика',
      period: period.label,
      summary: [
        `Открыто сейчас: ${int(totalOpen)} · просрочено: ${int(overdue)} (${share(overdue, totalOpen)})`,
        c ? `Закрыто за период: ${int(c.zakryto)} · отменено: ${int(c.otmeneno)} · вознаграждений на ${money(c.vyplacheno)}` : '',
      ].filter(Boolean),
      table: totalOpen
        ? table(
            ['исполнитель', 'открыто', 'просрочено', 'без срока', 'вознаграждение'],
            open.map((r) => [
              r.ispolnitel,
              int(r.otkryto),
              int(r.prosrocheno),
              int(r.bez_sroka),
              money(r.nagrada),
            ]),
          )
        : undefined,
      note:
        'Открытые задачи — срез на сейчас, период применён только к закрытым. Задача без срока в чат не напоминает: она просто лежит в списке.',
    });
  },
};

export const productionTools = [
  productionLoad,
  productionCycle,
  partnerDispatch,
  approvalsStatus,
  tasksOpen,
];
