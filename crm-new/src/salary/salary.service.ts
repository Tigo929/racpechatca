import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DtoCreatePayment } from './dto/create-payment.dto';
import { DtoCreatePaymentByAccruals } from './dto/create-payment-by-accruals.dto';

@Injectable()
export class SalaryService {
  constructor(private prisma: PrismaService) {}

  /** Сводка по всем исполнителям: начисления и долг. */
  async getSummary() {
    const executors = await this.prisma.user.findMany({
      where: { role: 'EXECUTOR' },
      orderBy: { createdAt: 'asc' },
      include: {
        salaryAccruals: {
          include: {
            order: {
              select: {
                numberOrder: true,
                productCategory: true,
                completedAt: true,
                totalOrder: true,
                deliveryCost: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        salaryPayments: {
          orderBy: { createdAt: 'desc' },
          include: {
            paidBy: { select: { id: true, username: true } },
          },
        },
      },
    });

    return executors.map((ex) => {
      const pending = ex.salaryAccruals.filter(
        (a) => a.status === 'PENDING' || a.status === 'PARTIALLY_PAID',
      );
      const closed = ex.salaryAccruals.filter(
        (a) => a.status === 'PAID' || a.status === 'SETTLED',
      );
      const totalDebt = pending.reduce(
        (s, a) => s + a.salaryAmount - a.paidAmount,
        0,
      );
      const totalPaid = ex.salaryPayments.reduce((s, p) => s + p.amount, 0);

      return {
        id: ex.id,
        username: ex.username,
        isActive: ex.isActive,
        rateBasisPoints: ex.rateBasisPoints,
        ratePercent:
          ex.rateBasisPoints === null
            ? null
            : (ex.rateBasisPoints / 100).toFixed(2),
        totalDebt,
        totalPaid,
        pendingAccruals: pending.map((a) => ({
          id: a.id,
          orderNumber: a.order.numberOrder,
          completedAt: a.order.completedAt,
          salaryBase: a.salaryBase,
          rateBasisPoints: a.rateBasisPoints,
          salaryAmount: a.salaryAmount,
          paidAmount: a.paidAmount,
          debt: a.salaryAmount - a.paidAmount,
          status: a.status,
        })),
        closedAccruals: closed.map((a) => ({
          id: a.id,
          orderNumber: a.order.numberOrder,
          completedAt: a.order.completedAt,
          salaryAmount: a.salaryAmount,
          paidAmount: a.paidAmount,
          status: a.status,
        })),
        recentPayments: ex.salaryPayments.slice(0, 5),
      };
    });
  }

  /** Список начислений по исполнителю (для детального просмотра). */
  async getAccruals(executorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: executorId },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    return this.prisma.salaryAccrual.findMany({
      where: { executorId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            numberOrder: true,
            productCategory: true,
            completedAt: true,
            totalOrder: true,
            deliveryCost: true,
          },
        },
        paymentLinks: {
          include: {
            payment: { select: { id: true, createdAt: true, amount: true } },
          },
        },
      },
    });
  }

  /**
   * Создаёт платёж и автоматически погашает PENDING-начисления (FIFO).
   * Если остаток платежа > долга — выбрасывает ошибку (не допускаем переплат).
   */
  async createPayment(dto: DtoCreatePayment, paidById: string) {
    return this.prisma.$transaction(async (tx) => {
      const executor = await tx.user.findUnique({
        where: { id: dto.executorId },
        select: { id: true },
      });
      if (!executor) throw new NotFoundException('Исполнитель не найден');

      const lockedRows = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "SalaryAccrual"
        WHERE "executorId" = ${dto.executorId}
          AND "status" IN ('PENDING', 'PARTIALLY_PAID')
        ORDER BY "createdAt" ASC, "id" ASC
        FOR UPDATE
      `;

      const pendingAccruals = lockedRows.length
        ? await tx.salaryAccrual.findMany({
            where: { id: { in: lockedRows.map(({ id }) => id) } },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          })
        : [];

      const totalDebt = pendingAccruals.reduce(
        (sum, accrual) => sum + accrual.salaryAmount - accrual.paidAmount,
        0,
      );

      if (dto.amount > totalDebt) {
        throw new BadRequestException(
          `Сумма платежа (${dto.amount} ₽) превышает долг (${totalDebt} ₽).`,
        );
      }

      const payment = await tx.salaryPayment.create({
        data: {
          executorId: dto.executorId,
          paidById,
          amount: dto.amount,
          note: dto.note,
        },
      });

      let remaining = dto.amount;

      for (const accrual of pendingAccruals) {
        if (remaining <= 0) break;

        const debt = accrual.salaryAmount - accrual.paidAmount;
        const toApply = Math.min(remaining, debt);
        const newPaid = accrual.paidAmount + toApply;
        const newStatus =
          newPaid >= accrual.salaryAmount ? 'PAID' : 'PARTIALLY_PAID';

        await tx.salaryAccrual.update({
          where: { id: accrual.id },
          data: { paidAmount: newPaid, status: newStatus },
        });

        await tx.paymentAccrualLink.create({
          data: {
            paymentId: payment.id,
            accrualId: accrual.id,
            amount: toApply,
          },
        });

        remaining -= toApply;
      }

      return tx.salaryPayment.findUnique({
        where: { id: payment.id },
        include: {
          paidBy: { select: { id: true, username: true } },
          accrualLinks: { include: { accrual: true } },
        },
      });
    });
  }

  /** История выплат по исполнителю. */
  async getPayments(executorId: string) {
    return this.prisma.salaryPayment.findMany({
      where: { executorId },
      orderBy: { createdAt: 'desc' },
      include: {
        paidBy: { select: { id: true, username: true } },
        accrualLinks: {
          include: {
            accrual: {
              include: {
                order: { select: { numberOrder: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Оплачивает конкретные начисления целиком (по списку ID).
   * Все выбранные accruals должны принадлежать executorId и быть PENDING/PARTIALLY_PAID.
   */
  async createPaymentByAccruals(
    dto: DtoCreatePaymentByAccruals,
    paidById: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const accruals = await tx.salaryAccrual.findMany({
        where: {
          id: { in: dto.accrualIds },
          executorId: dto.executorId,
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        include: {
          order: {
            select: {
              numberOrder: true,
              totalOrder: true,
              deliveryCost: true,
              createdAt: true,
              status: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

      if (accruals.length !== dto.accrualIds.length) {
        throw new BadRequestException(
          'Некоторые начисления не найдены или уже закрыты.',
        );
      }

      const totalAmount = accruals.reduce(
        (sum, a) => sum + a.salaryAmount - a.paidAmount,
        0,
      );

      if (totalAmount === 0) {
        throw new BadRequestException('Выбранные начисления уже закрыты.');
      }

      const payment = await tx.salaryPayment.create({
        data: {
          executorId: dto.executorId,
          paidById,
          amount: totalAmount,
          note: dto.note,
        },
      });

      for (const accrual of accruals) {
        const amount = accrual.salaryAmount - accrual.paidAmount;
        await tx.salaryAccrual.update({
          where: { id: accrual.id },
          data: { paidAmount: accrual.salaryAmount, status: 'PAID' },
        });
        await tx.paymentAccrualLink.create({
          data: { paymentId: payment.id, accrualId: accrual.id, amount },
        });

        // Переводим заказ в статус PAID
        if (accrual.order.status === 'SENT') {
          await tx.orderPhoto.update({
            where: { id: accrual.orderId },
            data: { status: 'PAID' },
          });
          await tx.statusHistory.create({
            data: {
              orderId: accrual.orderId,
              fromStatus: 'SENT',
              toStatus: 'PAID',
              changedBy: paidById,
            },
          });
        }
      }

      return {
        paymentId: payment.id,
        paidAt: payment.createdAt,
        totalAmount,
        accruals: accruals.map((a) => ({
          id: a.id,
          orderNumber: a.order.numberOrder,
          orderDate: a.order.createdAt,
          totalOrder: a.order.totalOrder,
          deliveryCost: a.order.deliveryCost,
          salaryBase: a.salaryBase,
          rateBasisPoints: a.rateBasisPoints,
          salaryAmount: a.salaryAmount - a.paidAmount,
        })),
      };
    });
  }
}
