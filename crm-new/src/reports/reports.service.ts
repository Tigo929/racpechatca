import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnumStatus } from 'src/generated/prisma/enums';

const MONTH_LABELS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const EXCLUDED_STATUSES: EnumStatus[] = [EnumStatus.LEAD, EnumStatus.CANCELLED];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyReport(year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    const [orders, expenses, salaryPayments] = await Promise.all([
      this.prisma.orderPhoto.findMany({
        where: {
          // Считаем выручку по дате отправки (когда деньги фактически получены).
          // Для старых заказов без sentAt — fallback на createdAt.
          OR: [
            { sentAt: { gte: startOfYear, lt: endOfYear } },
            { sentAt: null, createdAt: { gte: startOfYear, lt: endOfYear } },
          ],
          status: { in: [EnumStatus.SENT, EnumStatus.PAID] },
        },
        select: { sentAt: true, createdAt: true, totalOrder: true, deliveryCost: true, productCategory: true },
      }),
      this.prisma.expenseOrder.findMany({
        where: { createdAt: { gte: startOfYear, lt: endOfYear } },
        select: { createdAt: true, amount: true, category: true },
      }),
      this.prisma.salaryPayment.findMany({
        where: { createdAt: { gte: startOfYear, lt: endOfYear } },
        select: { createdAt: true, amount: true },
      }),
    ]);

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: MONTH_LABELS[i],
      orderCount: 0,
      totalRevenue: 0,
      deliveryCost: 0,
      netRevenue: 0,
      photoCount: 0,
      tshirtCount: 0,
      expensePhoto: 0,
      expenseTshirt: 0,
      expenseOther: 0,
      salaryPaid: 0,
      profit: 0,
    }));

    for (const order of orders) {
      const bucketDate = order.sentAt ?? order.createdAt;
      const m = months[bucketDate.getMonth()];
      const total = order.totalOrder ?? 0;
      const delivery = order.deliveryCost ?? 0;
      m.orderCount += 1;
      m.totalRevenue += total;
      m.deliveryCost += delivery;
      m.netRevenue += total - delivery;
      if (order.productCategory === 'PHOTO') m.photoCount += 1;
      else m.tshirtCount += 1;
    }

    for (const expense of expenses) {
      const m = months[expense.createdAt.getMonth()];
      if (expense.category === 'MATERIALS_PHOTO') m.expensePhoto += expense.amount;
      else if (expense.category === 'MATERIALS_TSHIRT') m.expenseTshirt += expense.amount;
      else m.expenseOther += expense.amount;
    }

    for (const payment of salaryPayments) {
      const m = months[payment.createdAt.getMonth()];
      m.salaryPaid += payment.amount;
    }

    for (const m of months) {
      m.profit = m.netRevenue - m.expensePhoto - m.expenseTshirt - m.expenseOther - m.salaryPaid;
    }

    const totals = months.reduce(
      (acc, m) => ({
        orderCount:    acc.orderCount    + m.orderCount,
        totalRevenue:  acc.totalRevenue  + m.totalRevenue,
        deliveryCost:  acc.deliveryCost  + m.deliveryCost,
        netRevenue:    acc.netRevenue    + m.netRevenue,
        photoCount:    acc.photoCount    + m.photoCount,
        tshirtCount:   acc.tshirtCount   + m.tshirtCount,
        expensePhoto:  acc.expensePhoto  + m.expensePhoto,
        expenseTshirt: acc.expenseTshirt + m.expenseTshirt,
        expenseOther:  acc.expenseOther  + m.expenseOther,
        salaryPaid:    acc.salaryPaid    + m.salaryPaid,
        profit:        acc.profit        + m.profit,
      }),
      {
        orderCount: 0, totalRevenue: 0, deliveryCost: 0, netRevenue: 0,
        photoCount: 0, tshirtCount: 0, expensePhoto: 0, expenseTshirt: 0,
        expenseOther: 0, salaryPaid: 0, profit: 0,
      },
    );

    return { year, months, totals };
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
}
