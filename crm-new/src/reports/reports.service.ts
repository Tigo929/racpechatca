import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnumStatus } from 'src/generated/prisma/enums';

const MONTH_LABELS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

/**
 * Единый принцип учёта (согласован с владельцем):
 *  - Выручка признаётся ПО ДАТЕ ОТПРАВКИ (статусы SENT/PAID), т.е. по факту
 *    завершения заказа. Для старых заказов без sentAt — fallback на createdAt.
 *  - Доставка — транзит (платит клиент, пересылается курьеру): вычитается из
 *    выручки и в прибыль не входит.
 *  - Чистая прибыль = Чистая выручка − Себестоимость материалов −
 *    Операционные расходы − Зарплата выплаченная.
 * Эта же методика применяется и к месячному, и к недельному отчёту.
 */

/** Сырые накопленные суммы за период (до вычисления производных метрик). */
interface PnlRaw {
  orderCount: number;
  photoCount: number;
  tshirtCount: number;
  totalRevenue: number; // оборот (сумма заказов, брутто)
  photoRevenue: number;
  tshirtRevenue: number;
  deliveryCost: number; // транзитная доставка
  materialsPhoto: number; // себестоимость — фотоматериалы
  materialsTshirt: number; // себестоимость — футболки/печать
  deliverySupplies: number; // операц. — упаковка/доставка
  equipment: number; // операц. — оборудование
  marketing: number; // операц. — реклама
  other: number; // операц. — прочее
  salaryPaid: number; // зарплата выплаченная
}

type OrderRow = {
  sentAt: Date | null;
  createdAt: Date;
  totalOrder: number | null;
  deliveryCost: number | null;
  productCategory: string;
};
type ExpenseRow = { createdAt: Date; amount: number; category: string };
type SalaryRow = { createdAt: Date; amount: number };

function emptyBucket(): PnlRaw {
  return {
    orderCount: 0,
    photoCount: 0,
    tshirtCount: 0,
    totalRevenue: 0,
    photoRevenue: 0,
    tshirtRevenue: 0,
    deliveryCost: 0,
    materialsPhoto: 0,
    materialsTshirt: 0,
    deliverySupplies: 0,
    equipment: 0,
    marketing: 0,
    other: 0,
    salaryPaid: 0,
  };
}

function addOrder(b: PnlRaw, order: OrderRow): void {
  const total = order.totalOrder ?? 0;
  b.orderCount += 1;
  b.totalRevenue += total;
  b.deliveryCost += order.deliveryCost ?? 0;
  if (order.productCategory === 'PHOTO') {
    b.photoCount += 1;
    b.photoRevenue += total;
  } else {
    b.tshirtCount += 1;
    b.tshirtRevenue += total;
  }
}

function addExpense(b: PnlRaw, e: ExpenseRow): void {
  switch (e.category) {
    case 'MATERIALS_PHOTO':
      b.materialsPhoto += e.amount;
      break;
    case 'MATERIALS_TSHIRT':
      b.materialsTshirt += e.amount;
      break;
    case 'DELIVERY_SUPPLIES':
      b.deliverySupplies += e.amount;
      break;
    case 'EQUIPMENT':
      b.equipment += e.amount;
      break;
    case 'MARKETING':
      b.marketing += e.amount;
      break;
    default:
      b.other += e.amount;
      break;
  }
}

function sumBuckets(buckets: PnlRaw[]): PnlRaw {
  return buckets.reduce((acc, b) => {
    (Object.keys(acc) as (keyof PnlRaw)[]).forEach((k) => {
      acc[k] += b[k];
    });
    return acc;
  }, emptyBucket());
}

/** Добавляет производные метрики (чистая выручка, прибыль, маржа, средний чек). */
function finalize(b: PnlRaw) {
  const netRevenue = b.totalRevenue - b.deliveryCost;
  const cogs = b.materialsPhoto + b.materialsTshirt;
  const grossProfit = netRevenue - cogs;
  const operatingExpenses =
    b.deliverySupplies + b.equipment + b.marketing + b.other;
  const totalExpenses = cogs + operatingExpenses; // все расходные ордера (без зарплаты)
  const netProfit = grossProfit - operatingExpenses - b.salaryPaid;
  const margin =
    b.totalRevenue > 0
      ? Math.round((netProfit / b.totalRevenue) * 1000) / 10
      : 0;
  const avgCheck =
    b.orderCount > 0 ? Math.round(b.totalRevenue / b.orderCount) : 0;
  return {
    ...b,
    netRevenue,
    cogs,
    operatingExpenses,
    totalExpenses,
    grossProfit,
    netProfit,
    margin,
    avgCheck,
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Тянет завершённые заказы (по дате отправки), расходы и зарплаты за период. */
  private async fetchPeriod(start: Date, endExclusive: Date) {
    const [orders, expenses, salaryPayments] = await Promise.all([
      this.prisma.orderPhoto.findMany({
        where: {
          OR: [
            { sentAt: { gte: start, lt: endExclusive } },
            { sentAt: null, createdAt: { gte: start, lt: endExclusive } },
          ],
          status: { in: [EnumStatus.SENT, EnumStatus.PAID] },
        },
        select: {
          sentAt: true,
          createdAt: true,
          totalOrder: true,
          deliveryCost: true,
          productCategory: true,
        },
      }),
      this.prisma.expenseOrder.findMany({
        where: { createdAt: { gte: start, lt: endExclusive } },
        select: { createdAt: true, amount: true, category: true },
      }),
      this.prisma.salaryPayment.findMany({
        where: { createdAt: { gte: start, lt: endExclusive } },
        select: { createdAt: true, amount: true },
      }),
    ]);
    return {
      orders: orders as OrderRow[],
      expenses: expenses as ExpenseRow[],
      salaryPayments: salaryPayments as SalaryRow[],
    };
  }

  async getMonthlyReport(year: number) {
    const start = new Date(year, 0, 1);
    const endExclusive = new Date(year + 1, 0, 1);
    const { orders, expenses, salaryPayments } = await this.fetchPeriod(
      start,
      endExclusive,
    );

    const buckets = Array.from({ length: 12 }, () => emptyBucket());

    for (const o of orders) {
      const d = o.sentAt ?? o.createdAt;
      addOrder(buckets[d.getMonth()], o);
    }
    for (const e of expenses) addExpense(buckets[e.createdAt.getMonth()], e);
    for (const p of salaryPayments)
      buckets[p.createdAt.getMonth()].salaryPaid += p.amount;

    const months = buckets.map((b, i) => ({
      month: i + 1,
      label: MONTH_LABELS[i],
      ...finalize(b),
    }));
    const totals = finalize(sumBuckets(buckets));

    return { year, months, totals };
  }

  async getWeeklyReport(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const endExclusive = new Date(year, month, 1);
    const { orders, expenses, salaryPayments } = await this.fetchPeriod(
      start,
      endExclusive,
    );

    const weekDefs = this.buildWeeks(year, month);
    const buckets = weekDefs.map(() => emptyBucket());
    const findWeek = (d: Date) =>
      weekDefs.findIndex((w) => d >= w.start && d < w.endExclusive);

    for (const o of orders) {
      const idx = findWeek(o.sentAt ?? o.createdAt);
      if (idx >= 0) addOrder(buckets[idx], o);
    }
    for (const e of expenses) {
      const idx = findWeek(e.createdAt);
      if (idx >= 0) addExpense(buckets[idx], e);
    }
    for (const p of salaryPayments) {
      const idx = findWeek(p.createdAt);
      if (idx >= 0) buckets[idx].salaryPaid += p.amount;
    }

    const weeks = weekDefs.map((w, i) => ({
      weekNum: w.weekNum,
      displayStart: w.displayStart,
      displayEnd: w.displayEnd,
      ...finalize(buckets[i]),
    }));
    const totals = finalize(sumBuckets(buckets));

    return { year, month, monthLabel: MONTH_LABELS[month - 1], weeks, totals };
  }

  async getAvailableYears() {
    const first = await this.prisma.orderPhoto.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const currentYear = new Date().getFullYear();
    const startYear = first ? first.createdAt.getFullYear() : currentYear;
    const years: number[] = [];
    for (let y = startYear; y <= currentYear; y++) years.push(y);
    return years.reverse();
  }

  /**
   * Воронка конверсии LEAD → заказ за год.
   * Показывает, сколько лидов пришло, сколько перешло в работу и сколько дошло
   * до оплаты — позволяет оценить качество обработки заявок с сайта.
   */
  async getFunnelReport(year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    const leads = await this.prisma.orderPhoto.findMany({
      where: {
        status: EnumStatus.LEAD,
        createdAt: { gte: startOfYear, lt: endOfYear },
      },
      select: { createdAt: true },
    });

    // Заказы, созданные из LEAD (проверяем StatusHistory: есть переход LEAD→NEW)
    const converted = await this.prisma.statusHistory.findMany({
      where: {
        fromStatus: EnumStatus.LEAD,
        toStatus: EnumStatus.NEW,
        createdAt: { gte: startOfYear, lt: endOfYear },
      },
      select: { orderId: true, createdAt: true },
    });

    // Из конвертированных — сколько дошло до SENT/PAID
    const paidFromLeads =
      converted.length > 0
        ? await this.prisma.orderPhoto.count({
            where: {
              id: { in: converted.map((c) => c.orderId) },
              status: { in: [EnumStatus.SENT, EnumStatus.PAID] },
            },
          })
        : 0;

    const totalLeads = leads.length;
    const totalConverted = converted.length;
    const conversionRate =
      totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0;
    const closeRate =
      totalConverted > 0
        ? Math.round((paidFromLeads / totalConverted) * 100)
        : 0;

    const byMonth = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: MONTH_LABELS[i],
      leads: 0,
      converted: 0,
    }));
    for (const l of leads) byMonth[l.createdAt.getMonth()].leads += 1;
    for (const c of converted) byMonth[c.createdAt.getMonth()].converted += 1;

    return {
      year,
      totalLeads,
      totalConverted,
      paidFromLeads,
      conversionRate,
      closeRate,
      byMonth,
    };
  }

  /** Разбивает месяц на недели пн–вс, обрезая крайние недели по границам месяца. */
  private buildWeeks(year: number, month: number) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0); // последний день месяца

    const dow = firstDay.getDay(); // 0=Вс…6=Сб
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const firstMonday = new Date(firstDay);
    firstMonday.setDate(firstDay.getDate() - daysFromMon);

    const pad = (n: number) => String(n).padStart(2, '0');
    const disp = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;

    const result: {
      weekNum: number;
      start: Date;
      endExclusive: Date;
      displayStart: string;
      displayEnd: string;
    }[] = [];
    const cur = new Date(firstMonday);
    let num = 1;

    while (cur <= lastDay) {
      const sun = new Date(cur);
      sun.setDate(cur.getDate() + 6);

      const clampStart = cur < firstDay ? new Date(firstDay) : new Date(cur);
      const clampEnd = sun > lastDay ? new Date(lastDay) : new Date(sun);

      const endExclusive = new Date(clampEnd);
      endExclusive.setDate(clampEnd.getDate() + 1);

      result.push({
        weekNum: num++,
        start: clampStart,
        endExclusive,
        displayStart: disp(clampStart),
        displayEnd: disp(clampEnd),
      });

      cur.setDate(cur.getDate() + 7);
    }

    return result;
  }
}
