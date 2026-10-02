/**
 * Фундамент «Деньги»: из чего сложился чек, что записано в расходы,
 * сколько внесено предоплатой и сколько ещё должны.
 *
 * Чего здесь намеренно нет — прибыли. Себестоимость в CRM считает одна
 * функция (reports/order-cogs.ts), её же результат уходит в Метрику, и
 * равенство держится тестами. Повторить эту математику в SQL означало бы
 * завести вторую формулу прибыли: она разойдётся с отчётом на округлении
 * или на следующей правке правил, и владелец получит два разных ответа на
 * вопрос «сколько я заработал». Поэтому здесь — записанные факты: чек и его
 * части, проведённые расходы, предоплаты. Прибыль — в отчёте CRM.
 */

import { z } from 'zod';
import { read } from '../db.js';
import { resolvePeriod, sqlRange } from '../period.js';
import { answer, int, money, per, share, table } from '../format.js';
import {
  CATEGORY_LABELS,
  EXPENSE_LABELS,
  SOURCE_LABELS,
  label,
  paidSql,
} from '../statuses.js';
import { categorySchema, periodSchema, sourceSchema, type Tool } from './types.js';

/**
 * Что именно считать выручкой — три разных ответа на один вопрос.
 *
 * `report` повторяет правило P&L-отчёта CRM буква в букву, и это единственный
 * режим, число которого сойдётся с отчётом владельца. Правило там непростое:
 * выручка признаётся, когда заказ отдан клиенту ИЛИ оплачен, период режется
 * по дате признания (первая непустая из оплаты, завершения, смены статуса,
 * отправки, создания), а футболки с маркетплейса исключены целиком — деньги
 * по ним считает площадка.
 *
 * Два других режима проще и нужны для других вопросов: `created` показывает
 * всё заведённое за период (сколько наработали менеджеры), `paid` — только
 * деньги, дошедшие в этот период.
 *
 * Держать три режима приходится потому, что владелец сравнивает ответ агента
 * с отчётом, и расхождение он воспримет как ошибку, а не как другой вопрос.
 * Правило отчёта живёт в crm-new/src/reports/reports.service.ts
 * (recognitionDate и fetchPeriod); если оно поменяется там, поменять надо и здесь.
 */
const basisSchema = z
  .enum(['report', 'created', 'paid'])
  .optional()
  .describe(
    'report — как в P&L-отчёте CRM: выручка признаётся, когда заказ отдан клиенту или оплачен; ' +
      'единственный режим, который сойдётся с отчётом владельца. Берите его, когда спрашивают «сколько выручки». ' +
      'created (по умолчанию) — всё заведённое за период по дате создания заказа. ' +
      'paid — только оплаченные, по дате первой оплаты (заполняется с 11.09.2026).',
  );

/** Статусы, на которых отчёт признаёт выручку. SENT — только у фотопечати. */
const REPORT_REVENUE_STATUS = `(
  o.status IN ('PAID','COMPLETED','DONE','SHIPMENT_CREATED')
  OR (o.status = 'SENT' AND o."productCategory" = 'PHOTO')
)`;

/** Дата признания выручки в отчёте: первая непустая из пяти. */
const RECOGNITION_DATE = `COALESCE(o."clientPaidAt", o."completedAt", o."statusChangedAt", o."sentAt", o."createdAt")`;

/** Футболки с маркетплейса в P&L владельца не входят: деньги считает площадка. */
const REPORT_EXCLUDE_MARKETPLACE = `NOT (o."productCategory" = 'TSHIRT' AND o."isMarketplacePrint" = true)`;

export const revenueSummary: Tool = {
  name: 'revenue_summary',
  title: 'Из чего сложился чек',
  description:
    'Сумма заказов за период и её части: товар, доставка, разработка дизайна, срочность, скидки. ' +
    'Разбивка по категориям товара. Отвечает на «сколько выручки», «средний чек», «сколько отдали скидками». ' +
    'Чтобы число совпало с P&L-отчётом владельца, нужен basis=report — там своё правило признания выручки. ' +
    'Прибыли и себестоимости не считает: единственная верная формула живёт в отчёте CRM. Отменённые заказы исключены.',
  schema: { ...periodSchema, source: sourceSchema, category: categorySchema, basis: basisSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);
    const source = (args.source as string | undefined) ?? null;
    const category = (args.category as string | undefined) ?? null;
    const raw = args.basis;
    const basis = raw === 'paid' ? 'paid' : raw === 'report' ? 'report' : 'created';

    const dateColumn =
      basis === 'paid' ? 'o."clientPaidAt"' : basis === 'report' ? RECOGNITION_DATE : 'o."createdAt"';
    const paidFilter =
      basis === 'paid'
        ? `AND ${paidSql()}`
        : basis === 'report'
          ? `AND ${REPORT_REVENUE_STATUS} AND ${REPORT_EXCLUDE_MARKETPLACE}`
          : '';

    const rows = await read<{
      cat: string;
      zakazov: number;
      chek: number;
      dostavka: number;
      dizayn: number;
      srochnost: number;
      skidka: number;
    }>(
      `SELECT o."productCategory"::text AS cat,
              count(*)::int AS zakazov,
              COALESCE(sum(o."totalOrder"), 0)::int AS chek,
              COALESCE(sum(o."deliveryCost"), 0)::int AS dostavka,
              COALESCE(sum(o."designDevelopmentCost"), 0)::int AS dizayn,
              COALESCE(sum(o."urgencyFee"), 0)::int AS srochnost,
              COALESCE(sum(o."discountAmount"), 0)::int AS skidka
         FROM "OrderPhoto" o
        WHERE ${dateColumn} >= $1 AND ${dateColumn} < $2
          AND o.status NOT IN ('LEAD','CANCELLED')
          ${paidFilter}
          AND ($3::text IS NULL OR o."sourceOrder"::text = $3)
          AND ($4::text IS NULL OR o."productCategory"::text = $4)
        GROUP BY cat
        ORDER BY chek DESC`,
      [from, to, source, category],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Из чего сложился чек',
        period: period.label,
        summary: [
          basis === 'paid'
            ? 'За период нет заказов с датой оплаты. Если период раньше 11.09.2026 — дата оплаты тогда не заполнялась, спросите с basis=created.'
            : basis === 'report'
              ? 'За период отчёт не признаёт выручку ни по одному заказу: ни один не отдан клиенту и не оплачен.'
              : 'За период нет заказов.',
        ],
      });
    }

    const sum = (key: keyof (typeof rows)[number]) =>
      rows.reduce((s, r) => s + (r[key] as number), 0);
    const zakazov = sum('zakazov');
    const chek = sum('chek');
    const dostavka = sum('dostavka');
    const dizayn = sum('dizayn');
    const srochnost = sum('srochnost');
    const skidka = sum('skidka');
    /** Товар = чек минус всё, что не товар, плюс возвращённая скидка. */
    const tovar = chek - dostavka - dizayn - srochnost + skidka;

    return answer({
      title:
        basis === 'report'
          ? 'Выручка как в P&L-отчёте CRM'
          : basis === 'paid'
            ? 'Выручка (по дате оплаты)'
            : 'Выставлено (по дате заказа)',
      period: period.label,
      summary: [
        `Заказов: ${int(zakazov)} · сумма: ${money(chek)} · средний чек: ${per(chek, zakazov)}`,
        `Товар: ${money(tovar)} · доставка: ${money(dostavka)} · дизайн: ${money(dizayn)} · срочность: ${money(srochnost)}`,
        `Скидок дано: ${money(skidka)} (${share(skidka, tovar + dizayn)} от товара с дизайном)`,
      ],
      table: table(
        ['товар', 'заказов', 'сумма', 'средний чек', 'доставка', 'дизайн', 'срочность', 'скидки'],
        rows.map((r) => [
          label(CATEGORY_LABELS, r.cat),
          int(r.zakazov),
          money(r.chek),
          per(r.chek, r.zakazov),
          money(r.dostavka),
          money(r.dizayn),
          money(r.srochnost),
          money(r.skidka),
        ]),
      ),
      note:
        'Чек = товар + доставка + дизайн + срочность − скидка. «Доставка» здесь — то, что заплатил клиент, а не то, что заплатили перевозчику: разница между ними остаётся у нас и в себестоимость не входит. ' +
        (basis === 'report'
          ? 'Правило признания — как в отчёте: заказ отдан клиенту или оплачен, период по дате признания (оплата, иначе завершение, иначе смена статуса, иначе отправка, иначе создание); футболки с маркетплейса исключены. Это число сходится с отчётом владельца.'
          : 'Внимание: это НЕ то число, что показывает P&L-отчёт владельца — там своё правило признания выручки. Если сравниваете с отчётом, спросите с basis=report.'),
    });
  },
};

export const orderCosts: Tool = {
  name: 'order_costs',
  title: 'Проведённые расходы',
  description:
    'Расходы, записанные в CRM за период, по видам: материалы, вознаграждение партнёру, подрядчик по холстам, реклама, прочее. ' +
    'Отвечает на «куда ушли деньги» и «сколько отдали партнёру». ' +
    'Это проведённые расходы, а НЕ себестоимость заказов и НЕ прибыль: часть себестоимости (бумага, заготовки) в расходы строкой не попадает, ' +
    'она считается по заказу в P&L-отчёте CRM. Сравнивать эти суммы с выручкой как прибыль нельзя.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const rows = await read<{
      category: string;
      shtuk: number;
      summa: number;
      s_zakazom: number;
    }>(
      `SELECT e.category::text AS category,
              count(*)::int AS shtuk,
              COALESCE(sum(e.amount), 0)::int AS summa,
              count(*) FILTER (WHERE e."orderId" IS NOT NULL)::int AS s_zakazom
         FROM "ExpenseOrder" e
        WHERE e."createdAt" >= $1 AND e."createdAt" < $2
        GROUP BY e.category
        ORDER BY summa DESC`,
      [from, to],
    );

    if (rows.length === 0) {
      return answer({
        title: 'Проведённые расходы',
        period: period.label,
        summary: ['За период расходы не проводились.'],
      });
    }

    const total = rows.reduce((s, r) => s + r.summa, 0);

    return answer({
      title: 'Проведённые расходы',
      period: period.label,
      summary: [`Всего проведено: ${money(total)} в ${int(rows.reduce((s, r) => s + r.shtuk, 0))} записях`],
      table: table(
        ['вид расхода', 'записей', 'сумма', 'доля', 'из них привязано к заказу'],
        rows.map((r) => [
          label(EXPENSE_LABELS, r.category),
          int(r.shtuk),
          money(r.summa),
          share(r.summa, total),
          int(r.s_zakazom),
        ]),
      ),
      note:
        'Вознаграждение партнёру и подрядчик по холстам создаются автоматически при переходе заказа в «Оплачен» — они привязаны к заказу. Остальное заводится руками.',
    });
  },
};

export const prepayments: Tool = {
  name: 'prepayments',
  title: 'Предоплаты и остатки',
  description:
    'Сколько клиенты внесли предоплатой и сколько ещё должны по незакрытым заказам. ' +
    'Отвечает на «сколько денег уже на руках» и «с кого добрать остаток». ' +
    'Показывает и заказы без отметки о предоплате — по ним CRM считает ориентир 50 %, но фактическая сумма не зафиксирована.',
  schema: { ...periodSchema, source: sourceSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);
    const source = (args.source as string | undefined) ?? null;

    const totals = await read<{
      zakazov: number;
      s_predoplatoy: number;
      bez_otmetki: number;
      vneseno: number;
      summa_zakazov: number;
      ostatok: number;
    }>(
      `SELECT count(*)::int AS zakazov,
              count(*) FILTER (WHERE o."prepaidAmount" IS NOT NULL)::int AS s_predoplatoy,
              count(*) FILTER (WHERE o."prepaidAmount" IS NULL)::int AS bez_otmetki,
              COALESCE(sum(o."prepaidAmount"), 0)::int AS vneseno,
              COALESCE(sum(o."totalOrder"), 0)::int AS summa_zakazov,
              COALESCE(sum(
                GREATEST(o."totalOrder" - COALESCE(o."prepaidAmount", 0), 0)
              ), 0)::int AS ostatok
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o.status NOT IN ('LEAD','CANCELLED')
          AND NOT ${paidSql()}
          AND ($3::text IS NULL OR o."sourceOrder"::text = $3)`,
      [from, to, source],
    );

    const t = totals[0];
    if (!t || t.zakazov === 0) {
      return answer({
        title: 'Предоплаты и остатки',
        period: period.label,
        summary: ['За период нет неоплаченных заказов — по всем деньги получены полностью.'],
      });
    }

    const worst = await read<{
      numberOrder: string;
      sourceOrder: string;
      status: string;
      totalOrder: number;
      prepaidAmount: number | null;
      ostatok: number;
      dney: number;
    }>(
      `SELECT o."numberOrder", o."sourceOrder"::text AS "sourceOrder", o.status::text AS status,
              o."totalOrder", o."prepaidAmount",
              GREATEST(o."totalOrder" - COALESCE(o."prepaidAmount", 0), 0)::int AS ostatok,
              EXTRACT(day FROM now() - o."createdAt")::int AS dney
         FROM "OrderPhoto" o
        WHERE o."createdAt" >= $1 AND o."createdAt" < $2
          AND o.status NOT IN ('LEAD','CANCELLED')
          AND NOT ${paidSql()}
          AND ($3::text IS NULL OR o."sourceOrder"::text = $3)
        ORDER BY ostatok DESC
        LIMIT 10`,
      [from, to, source],
    );

    return answer({
      title: 'Предоплаты и остатки',
      period: period.label,
      summary: [
        `Неоплаченных заказов: ${int(t.zakazov)} на ${money(t.summa_zakazov)}`,
        `Внесено предоплатой: ${money(t.vneseno)} · осталось получить: ${money(t.ostatok)}`,
        `Предоплата зафиксирована у ${int(t.s_predoplatoy)} заказов, не зафиксирована у ${int(t.bez_otmetki)}`,
      ],
      table: table(
        ['заказ', 'источник', 'статус', 'сумма', 'внесено', 'остаток', 'дней с создания'],
        worst.map((r) => [
          r.numberOrder,
          label(SOURCE_LABELS, r.sourceOrder),
          r.status,
          money(r.totalOrder),
          r.prepaidAmount === null ? 'не отмечено' : money(r.prepaidAmount),
          money(r.ostatok),
          int(r.dney),
        ]),
      ),
      note:
        'Там, где предоплата не отмечена, остаток равен всей сумме заказа — деньги могли прийти, но в CRM этого нет. Такой остаток не долг, а незаполненное поле.',
    });
  },
};

export const moneyTools = [revenueSummary, orderCosts, prepayments];
