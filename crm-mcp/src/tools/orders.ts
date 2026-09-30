/**
 * Фундамент «Заказы»: сколько пришло, сколько дошло до денег, где стоит.
 */

import { z } from 'zod';
import { read } from '../db.js';
import { resolvePeriod, sqlRange } from '../period.js';
import { answer, int, money, per, share, table } from '../format.js';
import {
  CATEGORY_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  label,
  orderedSql,
  paidSql,
} from '../statuses.js';
import { categorySchema, periodSchema, sourceSchema, type Tool } from './types.js';

export const ordersFunnel: Tool = {
  name: 'orders_funnel',
  title: 'Воронка заказов',
  description:
    'Путь заявки внутри CRM: обратился → стал заказом → оплачен, плюс отмены и конверсия каждого шага. ' +
    'Отвечает на «сколько обращений дошло до денег» и «где теряем». ' +
    'Кликов, показов и визитов тут нет — это site_traffic и ad_spend. ' +
    'Заказы, заведённые руками (Авито, маркетплейсы), в воронку попадают целиком: у них нет шага «обратился».',
  schema: { ...periodSchema, source: sourceSchema, category: categorySchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);
    const source = (args.source as string | undefined) ?? null;
    const category = (args.category as string | undefined) ?? null;

    const rows = await read<{
      zayavok: number;
      zakazov: number;
      oplacheno: number;
      otmeneno: number;
      v_rabote: number;
      ostalsya_lead: number;
      oborot: number;
      oborot_oplachen: number;
      skidki: number;
    }>(
      `SELECT count(*)::int                                          AS zayavok,
              count(*) FILTER (WHERE ${orderedSql()})::int           AS zakazov,
              count(*) FILTER (WHERE ${paidSql()})::int              AS oplacheno,
              count(*) FILTER (WHERE o.status = 'CANCELLED')::int    AS otmeneno,
              count(*) FILTER (WHERE o."closedAt" IS NULL AND o.status <> 'LEAD')::int AS v_rabote,
              count(*) FILTER (WHERE o.status = 'LEAD')::int         AS ostalsya_lead,
              COALESCE(sum(o."totalOrder"), 0)::int                  AS oborot,
              COALESCE(sum(o."totalOrder") FILTER (WHERE ${paidSql()}), 0)::int AS oborot_oplachen,
              COALESCE(sum(o."discountAmount"), 0)::int              AS skidki
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND ($3::text IS NULL OR o."sourceOrder"::text = $3)
          AND ($4::text IS NULL OR o."productCategory"::text = $4)`,
      [from, to, source, category],
    );

    const r = rows[0];
    if (!r || r.zayavok === 0) {
      return answer({
        title: 'Воронка заказов',
        period: period.label,
        summary: ['За период ни одной заявки не заведено.'],
      });
    }

    const title = [
      'Воронка заказов',
      source ? label(SOURCE_LABELS, source) : null,
      category ? label(CATEGORY_LABELS, category) : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return answer({
      title,
      period: period.label,
      table: table(
        ['шаг', 'штук', 'от предыдущего', 'от всех'],
        [
          ['Заявок заведено', int(r.zayavok), '—', '100 %'],
          ['Стали заказом', int(r.zakazov), share(r.zakazov, r.zayavok), share(r.zakazov, r.zayavok)],
          ['Оплачено', int(r.oplacheno), share(r.oplacheno, r.zakazov), share(r.oplacheno, r.zayavok)],
        ],
      ),
      summary: [
        `Осталось обращениями: ${int(r.ostalsya_lead)} · в работе: ${int(r.v_rabote)} · отменено: ${int(r.otmeneno)}`,
        `Сумма заказов: ${money(r.oborot)} · из них оплачено: ${money(r.oborot_oplachen)}`,
        `Средний чек заказа: ${per(r.oborot, r.zakazov)} · скидок дано: ${money(r.skidki)}`,
      ],
      note:
        'Период считается по дате создания заказа. Оплата приходит позже, поэтому по свежим дням доля оплаченных всегда занижена — это не падение конверсии.',
    });
  },
};

export const ordersByStatus: Tool = {
  name: 'orders_by_status',
  title: 'Что сейчас в работе',
  description:
    'Срез на сегодня: все незакрытые заказы по статусам, сколько из них стоят без движения и сколько денег в них заморожено. ' +
    'Отвечает на «что зависло» и «чем занята мастерская прямо сейчас». Период не принимает — это состояние, а не период.',
  schema: { source: sourceSchema, category: categorySchema },
  async run(args) {
    const source = (args.source as string | undefined) ?? null;
    const category = (args.category as string | undefined) ?? null;

    const rows = await read<{
      status: string;
      shtuk: number;
      zavislo: number;
      starshiy_dney: number;
      summa: number;
    }>(
      `SELECT o.status::text AS status,
              count(*)::int AS shtuk,
              count(*) FILTER (
                WHERE COALESCE(o."statusChangedAt", o."createdAt") < now() - interval '3 days'
              )::int AS zavislo,
              COALESCE(max(
                EXTRACT(day FROM now() - COALESCE(o."statusChangedAt", o."createdAt"))
              ), 0)::int AS starshiy_dney,
              COALESCE(sum(o."totalOrder"), 0)::int AS summa
         FROM "OrderPhoto" o
        WHERE o."closedAt" IS NULL
          AND ($1::text IS NULL OR o."sourceOrder"::text = $1)
          AND ($2::text IS NULL OR o."productCategory"::text = $2)
        GROUP BY o.status
        ORDER BY shtuk DESC`,
      [source, category],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Что сейчас в работе',
        period: 'срез на сейчас',
        summary: ['Незакрытых заказов нет — всё либо оплачено, либо отменено.'],
      });
    }

    const total = rows.reduce((s, r) => s + r.shtuk, 0);
    const stuck = rows.reduce((s, r) => s + r.zavislo, 0);
    const frozen = rows.reduce((s, r) => s + r.summa, 0);

    return answer({
      title: 'Что сейчас в работе',
      period: 'срез на сейчас',
      summary: [
        `Незакрытых заказов: ${int(total)} на ${money(frozen)}`,
        `Без движения дольше 3 дней: ${int(stuck)} (${share(stuck, total)})`,
      ],
      table: table(
        ['статус', 'штук', 'стоят >3 дн.', 'самый старый, дн.', 'сумма'],
        rows.map((r) => [
          label(STATUS_LABELS, r.status),
          int(r.shtuk),
          int(r.zavislo),
          int(r.starshiy_dney),
          money(r.summa),
        ]),
      ),
      note:
        '«Без движения» — от последней смены статуса, а не от создания заказа. У заказов, статус которых ни разу не меняли, отсчёт идёт от создания.',
    });
  },
};

export const ordersTimeline: Tool = {
  name: 'orders_timeline',
  title: 'Динамика заказов по дням',
  description:
    'Заявки, заказы, оплаты и сумма по дням или неделям — чтобы увидеть рост, провал и сезонность. ' +
    'Отвечает на «стало ли лучше после изменения» и «когда просело». ' +
    'Причин роста не знает: сопоставлять с рекламой — дело ad_spend и site_traffic.',
  schema: {
    ...periodSchema,
    source: sourceSchema,
    category: categorySchema,
    step: z
      .enum(['day', 'week'])
      .optional()
      .describe('Шаг: day (по умолчанию) или week. Для периода больше 60 дней берите week.'),
  },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);
    const source = (args.source as string | undefined) ?? null;
    const category = (args.category as string | undefined) ?? null;
    const step = args.step === 'week' ? 'week' : 'day';

    const rows = await read<{
      bucket: Date;
      zayavok: number;
      zakazov: number;
      oplacheno: number;
      summa: number;
    }>(
      `SELECT date_trunc('${step}', o."createdAt") AS bucket,
              count(*)::int AS zayavok,
              count(*) FILTER (WHERE ${orderedSql()})::int AS zakazov,
              count(*) FILTER (WHERE ${paidSql()})::int AS oplacheno,
              COALESCE(sum(o."totalOrder"), 0)::int AS summa
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND ($3::text IS NULL OR o."sourceOrder"::text = $3)
          AND ($4::text IS NULL OR o."productCategory"::text = $4)
        GROUP BY bucket
        ORDER BY bucket`,
      [from, to, source, category],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Динамика заказов',
        period: period.label,
        summary: ['За период заказов нет.'],
      });
    }

    const totalOrders = rows.reduce((s, r) => s + r.zakazov, 0);
    const totalSum = rows.reduce((s, r) => s + r.summa, 0);

    return answer({
      title: step === 'week' ? 'Динамика заказов по неделям' : 'Динамика заказов по дням',
      period: period.label,
      summary: [
        `Всего заказов: ${int(totalOrders)} на ${money(totalSum)}`,
        `Среднее за ${step === 'week' ? 'неделю' : 'день'}: ${(totalOrders / rows.length).toFixed(1)} заказов`,
      ],
      table: table(
        [step === 'week' ? 'неделя с' : 'день', 'заявок', 'заказов', 'оплачено', 'сумма'],
        rows.map((r) => [
          r.bucket.toISOString().slice(0, 10),
          int(r.zayavok),
          int(r.zakazov),
          int(r.oplacheno),
          money(r.summa),
        ]),
      ),
      note: 'Дни без заказов в таблице отсутствуют — это не пропуск данных, а отсутствие заказов.',
    });
  },
};

export const orderFind: Tool = {
  name: 'order_find',
  title: 'Найти заказ',
  description:
    'Найти заказ по номеру CRM, номеру заказа площадки, номеру отправления или ссылке на переписку. ' +
    'Отдаёт карточку кратко: статус, суммы, состав, исполнитель, происхождение. ' +
    'Контакты клиента, переписку и файлы макетов не отдаёт — за ними в CRM.',
  schema: {
    query: z
      .string()
      .min(2)
      .describe('Номер заказа CRM, номер заказа площадки, номер отправления или часть ссылки на переписку.'),
  },
  async run(args) {
    const q = String(args.query ?? '').trim();
    const rows = await read<{
      numberOrder: string;
      marketplaceOrderNumber: string | null;
      status: string;
      sourceOrder: string;
      productCategory: string;
      totalOrder: number;
      prepaidAmount: number | null;
      createdAt: Date;
      clientPaidAt: Date | null;
      pozitsiy: number;
      ispolnitel: string | null;
      oformil: string | null;
    }>(
      `SELECT o."numberOrder", o."marketplaceOrderNumber",
              o.status::text AS status, o."sourceOrder"::text AS "sourceOrder",
              o."productCategory"::text AS "productCategory",
              o."totalOrder", o."prepaidAmount", o."createdAt", o."clientPaidAt",
              (SELECT count(*) FROM "ItemPhoto" i WHERE i."orderId" = o.id)
              + (SELECT count(*) FROM "ItemTshirt" t WHERE t."orderId" = o.id)
              + (SELECT count(*) FROM "ItemCanvas" c WHERE c."orderId" = o.id) AS pozitsiy,
              e.username AS ispolnitel,
              m.username AS oformil
         FROM "OrderPhoto" o
         LEFT JOIN "User" e ON e.id = o."executorId"
         LEFT JOIN "User" m ON m.id = o."processedById"
        WHERE o."numberOrder" ILIKE $1
           OR o."marketplaceOrderNumber" ILIKE $1
           OR o."marketplacePostingNumber" ILIKE $1
           OR o."urlCommunication" ILIKE $1
        ORDER BY o."createdAt" DESC
        LIMIT 10`,
      [`%${q}%`],
    );

    if (rows.length === 0) {
      return answer({
        title: `Заказ «${q}»`,
        summary: [
          'Ничего не нашлось. Искал по номеру CRM, номеру заказа площадки, номеру отправления и ссылке на переписку.',
        ],
      });
    }

    return answer({
      title: `Найдено заказов: ${rows.length}`,
      table: table(
        ['номер', 'площадка №', 'статус', 'источник', 'товар', 'сумма', 'предоплата', 'поз.', 'создан', 'оплачен', 'исполнитель', 'оформил'],
        rows.map((r) => [
          r.numberOrder,
          r.marketplaceOrderNumber ?? '—',
          label(STATUS_LABELS, r.status),
          label(SOURCE_LABELS, r.sourceOrder),
          label(CATEGORY_LABELS, r.productCategory),
          money(r.totalOrder),
          r.prepaidAmount === null ? 'нет' : money(r.prepaidAmount),
          int(r.pozitsiy),
          r.createdAt.toISOString().slice(0, 10),
          r.clientPaidAt ? r.clientPaidAt.toISOString().slice(0, 10) : '—',
          r.ispolnitel ?? '—',
          r.oformil ?? '—',
        ]),
      ),
      note: rows.length === 10 ? 'Показаны первые 10 — уточните запрос, если нужен конкретный заказ.' : undefined,
    });
  },
};

export const orderTools = [ordersFunnel, ordersByStatus, ordersTimeline, orderFind];
