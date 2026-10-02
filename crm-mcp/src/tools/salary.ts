/**
 * Фундамент «Зарплата»: что начислено, что выплачено, что мы должны людям.
 *
 * Начисление и выплата в CRM — разные события, связанные многие-ко-многим
 * (одной выплатой закрывают несколько начислений). Поэтому «сколько
 * начислено» и «сколько выплачено» считаются по своим таблицам, а долг —
 * как разница внутри начисления (salaryAmount − paidAmount), а не как
 * разность двух сумм за период: выплата за прошлый месяц иначе обнулила бы
 * долг текущего.
 */

import { read } from '../db.js';
import { resolvePeriod, sqlRange } from '../period.js';
import { answer, int, money, per, share, table } from '../format.js';
import { ACCRUAL_STATUS_LABELS, label } from '../statuses.js';
import { periodSchema, type Tool } from './types.js';

const KIND_LABELS: Record<string, string> = {
  EXECUTOR: 'Исполнителю за производство',
  MANAGER: 'Менеджеру за оформление',
  BONUS: 'Премия от администратора',
};

export const salarySummary: Tool = {
  name: 'salary_summary',
  title: 'Начислено и выплачено',
  description:
    'Зарплата за период: кому сколько начислено, за что, сколько из этого выплачено. ' +
    'Отвечает на «сколько ушло людям» и «какая доля чека уходит в зарплату». ' +
    'Начисление создаётся при переходе заказа в определённый статус, поэтому дата начисления и дата заказа могут попасть в разные периоды. ' +
    'Непогашенный долг здесь не считается — это salary_debt: выплата за прошлый месяц исказила бы долг текущего.',
  schema: { ...periodSchema },
  async run(args) {
    const period = resolvePeriod(args as { from?: string; to?: string });
    const [from, to] = sqlRange(period);

    const byPerson = await read<{
      chelovek: string;
      nachisleniy: number;
      baza: number;
      nachisleno: number;
      vyplacheno: number;
      za_dizayn: number;
    }>(
      `SELECT u.username AS chelovek,
              count(*)::int AS nachisleniy,
              COALESCE(sum(a."salaryBase"), 0)::int AS baza,
              COALESCE(sum(a."salaryAmount"), 0)::int AS nachisleno,
              COALESCE(sum(a."paidAmount"), 0)::int AS vyplacheno,
              COALESCE(sum(round(a."designBase" * a."designRateBasisPoints" / 10000.0)), 0)::int AS za_dizayn
         FROM "SalaryAccrual" a
         JOIN "User" u ON u.id = a."executorId"
        WHERE a."createdAt" >= $1 AND a."createdAt" < $2
          AND a.status <> 'REVERSED'
        GROUP BY u.username
        ORDER BY nachisleno DESC`,
      [from, to],
    );

    if (byPerson.length === 0) {
      return answer({
        title: 'Начислено и выплачено',
        period: period.label,
        summary: ['За период начислений не было.'],
      });
    }

    const byKind = await read<{ kind: string; shtuk: number; summa: number }>(
      `SELECT a.kind::text AS kind, count(*)::int AS shtuk, COALESCE(sum(a."salaryAmount"), 0)::int AS summa
         FROM "SalaryAccrual" a
        WHERE a."createdAt" >= $1 AND a."createdAt" < $2
          AND a.status <> 'REVERSED'
        GROUP BY a.kind
        ORDER BY summa DESC`,
      [from, to],
    );

    const payments = await read<{ vyplat: number; summa: number }>(
      `SELECT count(*)::int AS vyplat, COALESCE(sum(p.amount), 0)::int AS summa
         FROM "SalaryPayment" p
        WHERE p."createdAt" >= $1 AND p."createdAt" < $2`,
      [from, to],
    );

    const nachisleno = byPerson.reduce((s, r) => s + r.nachisleno, 0);
    const baza = byPerson.reduce((s, r) => s + r.baza, 0);
    const p = payments[0];

    return answer({
      title: 'Начислено и выплачено',
      period: period.label,
      summary: [
        `Начислено: ${money(nachisleno)} по ${int(byPerson.reduce((s, r) => s + r.nachisleniy, 0))} начислениям`,
        `Доля зарплаты в базе начисления: ${share(nachisleno, baza)} (база — чек без доставки)`,
        p ? `Выплат за период: ${int(p.vyplat)} на ${money(p.summa)}` : '',
      ].filter(Boolean),
      table: [
        table(
          ['человек', 'начислений', 'база', 'начислено', 'из них за дизайн', 'выплачено', 'ставка факт.'],
          byPerson.map((r) => [
            r.chelovek,
            int(r.nachisleniy),
            money(r.baza),
            money(r.nachisleno),
            money(r.za_dizayn),
            money(r.vyplacheno),
            share(r.nachisleno, r.baza),
          ]),
        ),
        'За что начислено:\n' +
          table(
            ['вид', 'начислений', 'сумма'],
            byKind.map((r) => [label(KIND_LABELS, r.kind), int(r.shtuk), money(r.summa)]),
          ),
      ].join('\n\n'),
      note:
        'Выплаты за период могут закрывать начисления прошлых месяцев, поэтому «выплачено» и «начислено» за один период не обязаны совпадать. Отменённые начисления исключены. ' +
        'Внимание при сравнении с P&L-отчётом CRM: там зарплата берётся по заказам, которые отчёт признал в периоде, а здесь — по дате самого начисления. ' +
        'Числа законно расходятся (за сентябрь 2026 — 30 102 ₽ здесь против 36 008 ₽ в отчёте): заказ, признанный в сентябре, мог получить начисление в августе. ' +
        'Для вопроса «кому и сколько мы начислили» верно это число, для сверки с прибылью — отчётное.',
    });
  },
};

export const salaryDebt: Tool = {
  name: 'salary_debt',
  title: 'Сколько мы должны людям',
  description:
    'Срез на сейчас: невыплаченный остаток по каждому человеку и самое старое непогашенное начисление. ' +
    'Отвечает на «сколько нужно на выплаты» и «кому мы задолжали дольше всех». Период не принимает — долг не бывает «за период».',
  schema: {},
  async run() {
    const rows = await read<{
      chelovek: string;
      nachisleniy: number;
      nachisleno: number;
      vyplacheno: number;
      dolg: number;
      staroe_dney: number;
    }>(
      `SELECT u.username AS chelovek,
              count(*)::int AS nachisleniy,
              COALESCE(sum(a."salaryAmount"), 0)::int AS nachisleno,
              COALESCE(sum(a."paidAmount"), 0)::int AS vyplacheno,
              COALESCE(sum(a."salaryAmount" - a."paidAmount"), 0)::int AS dolg,
              COALESCE(max(EXTRACT(day FROM now() - a."createdAt")), 0)::int AS staroe_dney
         FROM "SalaryAccrual" a
         JOIN "User" u ON u.id = a."executorId"
        WHERE a.status IN ('PENDING','PARTIALLY_PAID')
          AND a."salaryAmount" > a."paidAmount"
        GROUP BY u.username
        ORDER BY dolg DESC`,
    );

    if (rows.length === 0) {
      return answer({
        title: 'Сколько мы должны людям',
        period: 'срез на сейчас',
        summary: ['Непогашенных начислений нет — по зарплате рассчитались полностью.'],
      });
    }

    const dolg = rows.reduce((s, r) => s + r.dolg, 0);

    const byStatus = await read<{ status: string; shtuk: number; summa: number }>(
      `SELECT a.status::text AS status, count(*)::int AS shtuk,
              COALESCE(sum(a."salaryAmount" - a."paidAmount"), 0)::int AS summa
         FROM "SalaryAccrual" a
        WHERE a.status IN ('PENDING','PARTIALLY_PAID')
        GROUP BY a.status`,
    );

    return answer({
      title: 'Сколько мы должны людям',
      period: 'срез на сейчас',
      summary: [`Долг по зарплате: ${money(dolg)} перед ${rows.length} людьми`],
      table: [
        table(
          ['человек', 'начислений', 'начислено', 'выплачено', 'долг', 'самое старое, дн.'],
          rows.map((r) => [
            r.chelovek,
            int(r.nachisleniy),
            money(r.nachisleno),
            money(r.vyplacheno),
            money(r.dolg),
            int(r.staroe_dney),
          ]),
        ),
        byStatus.length
          ? 'По состоянию начисления:\n' +
            table(
              ['состояние', 'начислений', 'остаток'],
              byStatus.map((r) => [label(ACCRUAL_STATUS_LABELS, r.status), int(r.shtuk), money(r.summa)]),
            )
          : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      note:
        'Начисления со статусом «Закрыто зачётом» и «Отменено» в долг не входят: по ним расчёт уже произошёл или начисление отменили.',
    });
  },
};

export const salaryTools = [salarySummary, salaryDebt];
