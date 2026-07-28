import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DtoCreateExpense } from './dto/create-expense.dto';

function yearRange(year?: number) {
  return year
    ? {
        createdAt: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      }
    : undefined;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: DtoCreateExpense, createdById: string) {
    return this.prisma.expenseOrder.create({
      data: { ...dto, createdById },
      include: { createdBy: { select: { id: true, username: true } } },
    });
  }

  async findAll(year?: number) {
    const where = yearRange(year);

    const [expenses, salaryPayments] = await Promise.all([
      this.prisma.expenseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, username: true } },
          // Номер заказа нужен для разбивки «Вознаграждение партнёру» в отчёте.
          order: { select: { id: true, numberOrder: true } },
        },
      }),
      this.prisma.salaryPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          executor: { select: { id: true, username: true } },
          paidBy: { select: { id: true, username: true } },
        },
      }),
    ]);

    const manualRows = expenses.map((expense) => ({
      ...expense,
      kind: 'EXPENSE_ORDER' as const,
    }));

    const salaryRows = salaryPayments.map((payment) => ({
      id: `salary-${payment.id}`,
      kind: 'SALARY_PAYMENT' as const,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      category: 'SALARY' as const,
      amount: payment.amount,
      note: payment.note,
      createdBy: payment.paidBy,
      salaryPaymentId: payment.id,
      salaryExecutor: payment.executor,
      order: null,
    }));

    return [...manualRows, ...salaryRows].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async remove(id: string) {
    const expense = await this.prisma.expenseOrder.findUnique({
      where: { id },
    });
    if (!expense) throw new NotFoundException('Расходный ордер не найден');
    await this.prisma.expenseOrder.delete({ where: { id } });
  }
}
