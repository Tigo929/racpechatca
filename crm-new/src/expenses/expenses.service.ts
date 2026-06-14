import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DtoCreateExpense } from './dto/create-expense.dto';

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
    const where = year
      ? {
          createdAt: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        }
      : undefined;

    return this.prisma.expenseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, username: true } } },
    });
  }

  async remove(id: string) {
    const expense = await this.prisma.expenseOrder.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Расходный ордер не найден');
    await this.prisma.expenseOrder.delete({ where: { id } });
  }
}
