import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { DtoCreatePayment } from './dto/create-payment.dto';
import { DtoCreatePaymentByAccruals } from './dto/create-payment-by-accruals.dto';
import { DtoCreateBonus } from './dto/create-bonus.dto';

@Injectable()
export class SalaryService {
  constructor(private prisma: PrismaService) {}

  /** Сводка по всем получателям зарплаты: исполнители и менеджеры по оформлению. */
  async getSummary() {
    const executors = await this.prisma.user.findMany({
      where: { role: { in: ['EXECUTOR', 'ORDER_MANAGER'] } },
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
                urlCommunication: true,
                communicationPlatform: true,
                status: true,
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
        (a) =>
          // Премия к заказу не привязана — она в долге с момента начисления.
          (a.kind === 'BONUS' || a.order?.status === EnumStatus.SENT) &&
          (a.status === 'PENDING' || a.status === 'PARTIALLY_PAID') &&
          a.paidAmount < a.salaryAmount,
      );
      const closed = ex.salaryAccruals.filter(
        (a) =>
          a.status === 'PAID' ||
          a.status === 'SETTLED' ||
          a.paidAmount >= a.salaryAmount,
      );
      const totalDebt = pending.reduce(
        (s, a) => s + a.salaryAmount - a.paidAmount,
        0,
      );
      const totalPaid = ex.salaryPayments.reduce((s, p) => s + p.amount, 0);

      return {
        id: ex.id,
        username: ex.username,
        role: ex.role,
        isActive: ex.isActive,
        rateBasisPoints: ex.rateBasisPoints,
        ratePercent:
          ex.rateBasisPoints === null
            ? null
            : (ex.rateBasisPoints / 100).toFixed(2),
        // Ставка премии за дизайн — только у менеджера по оформлению.
        designRateBasisPoints: ex.designRateBasisPoints,
        totalDebt,
        totalPaid,
        pendingAccruals: pending.map((a) => ({
          id: a.id,
          orderNumber: a.order?.numberOrder ?? null,
          completedAt: a.order?.completedAt ?? null,
          urlCommunication: a.order?.urlCommunication ?? null,
          communicationPlatform: a.order?.communicationPlatform ?? null,
          kind: a.kind,
          // За что премия — показываем в списке начислений.
          note: a.note,
          createdAt: a.createdAt,
          salaryBase: a.salaryBase,
          rateBasisPoints: a.rateBasisPoints,
          designBase: a.designBase,
          designRateBasisPoints: a.designRateBasisPoints,
          salaryAmount: a.salaryAmount,
          paidAmount: a.paidAmount,
          debt: a.salaryAmount - a.paidAmount,
          status: a.status,
        })),
        closedAccruals: closed.map((a) => ({
          id: a.id,
          orderNumber: a.order?.numberOrder ?? null,
          completedAt: a.order?.completedAt ?? null,
          kind: a.kind,
          note: a.note,
          createdAt: a.createdAt,
          salaryAmount: a.salaryAmount,
          paidAmount: a.paidAmount,
          status: a.status,
        })),
        recentPayments: ex.salaryPayments.slice(0, 5),
      };
    });
  }

  /**
   * Личный баланс исполнителя.
   *
   * Намеренно отдаёт только агрегаты и историю выплат — без сумм по отдельным
   * заказам. Зарплата считается как (чек − доставка) × ставка, и свою ставку
   * исполнитель знает: показав начисление за конкретный заказ, мы бы раскрыли
   * его чек в обход StripPricesInterceptor.
   */
  async getMyBalance(executorId: string) {
    const [accruals, payments] = await Promise.all([
      this.prisma.salaryAccrual.findMany({
        where: {
          executorId,
          status: { not: 'REVERSED' },
          // Долг по заказам считаем с момента отгрузки. Премии к заказу не
          // привязаны — они попадают в долг сразу, как только начислены.
          OR: [{ order: { status: EnumStatus.SENT } }, { kind: 'BONUS' }],
        },
        select: { salaryAmount: true, paidAmount: true, status: true },
      }),
      this.prisma.salaryPayment.findMany({
        where: { executorId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, amount: true, note: true },
      }),
    ]);

    const pending = accruals.filter(
      (a) =>
        (a.status === 'PENDING' || a.status === 'PARTIALLY_PAID') &&
        a.paidAmount < a.salaryAmount,
    );

    return {
      // Сколько сейчас должны: заказы отгружены (SENT), зарплата ещё не выдана.
      totalDebt: pending.reduce((s, a) => s + a.salaryAmount - a.paidAmount, 0),
      pendingOrders: pending.length,
      // Сколько выдано за всё время — сумма фактических выплат, а не начислений.
      totalPaid: payments.reduce((s, p) => s + p.amount, 0),
      payments,
    };
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
        SELECT "SalaryAccrual"."id"
        FROM "SalaryAccrual"
        LEFT JOIN "OrderPhoto" ON "OrderPhoto"."id" = "SalaryAccrual"."orderId"
        WHERE "SalaryAccrual"."executorId" = ${dto.executorId}
          AND "SalaryAccrual"."status" IN ('PENDING', 'PARTIALLY_PAID')
          -- Премия без заказа тоже подлежит выплате наравне с начислениями.
          AND ("OrderPhoto"."status" = ${EnumStatus.SENT}
               OR "SalaryAccrual"."kind" = 'BONUS')
        ORDER BY "SalaryAccrual"."createdAt" ASC, "SalaryAccrual"."id" ASC
        FOR UPDATE OF "SalaryAccrual"
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
      // Блокируем выбранные начисления до проверки статуса — иначе два
      // параллельных запроса (двойной клик) оплатят одни и те же начисления
      // дважды. Тот же приём, что в createPayment.
      await tx.$queryRaw`
        SELECT "id" FROM "SalaryAccrual"
        WHERE "id" IN (${Prisma.join(dto.accrualIds)})
        ORDER BY "createdAt" ASC, "id" ASC
        FOR UPDATE
      `;
      const accruals = await tx.salaryAccrual.findMany({
        where: {
          id: { in: dto.accrualIds },
          executorId: dto.executorId,
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          order: { status: EnumStatus.SENT },
        },
        include: {
          order: {
            select: {
              numberOrder: true,
              totalOrder: true,
              deliveryCost: true,
              createdAt: true,
              status: true,
              urlCommunication: true,
              communicationPlatform: true,
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
        // Премия к заказу не привязана — двигать нечего.
        // Заказ переводим в PAID только если он ещё не PAID (идемпотентно).
        if (accrual.orderId && accrual.order && accrual.order.status !== 'PAID') {
          await tx.orderPhoto.update({
            where: { id: accrual.orderId },
            data: { status: 'PAID' },
          });
          await tx.statusHistory.create({
            data: {
              orderId: accrual.orderId,
              fromStatus: accrual.order.status,
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
          orderNumber: a.order?.numberOrder ?? null,
          orderDate: a.order?.createdAt ?? a.createdAt,
          totalOrder: a.order?.totalOrder ?? 0,
          deliveryCost: a.order?.deliveryCost ?? 0,
          kind: a.kind,
          note: a.note,
          salaryBase: a.salaryBase,
          rateBasisPoints: a.rateBasisPoints,
          salaryAmount: a.salaryAmount - a.paidAmount,
        })),
      };
    });
  }

  /**
   * Ручная премия сотруднику от администратора. Это обычное начисление
   * (kind=BONUS), просто вне заказа: поэтому оно само собой попадает в долг,
   * закрывается выплатами по тем же правилам и видно сотруднику в «Моей
   * зарплате» — отдельной ветки учёта для премий не заводим.
   *
   * База и ставка нулевые: сумма назначена вручную, процент считать не от чего.
   */
  async createBonus(dto: DtoCreateBonus, createdById: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.executorId },
      select: { id: true, isActive: true, role: true },
    });
    if (!user) throw new NotFoundException('Сотрудник не найден');
    if (!user.isActive) {
      throw new BadRequestException('Нельзя начислить премию уволенному сотруднику');
    }

    return this.prisma.salaryAccrual.create({
      data: {
        executorId: dto.executorId,
        kind: 'BONUS',
        note: dto.note.trim(),
        createdById,
        salaryBase: 0,
        rateBasisPoints: 0,
        salaryAmount: dto.amount,
        status: 'PENDING',
      },
    });
  }

  /** Удалить ошибочно начисленную премию. Выплаченную — уже нельзя. */
  async deleteBonus(id: string) {
    const accrual = await this.prisma.salaryAccrual.findUnique({
      where: { id },
      select: { id: true, kind: true, paidAmount: true, status: true },
    });
    if (!accrual) throw new NotFoundException('Начисление не найдено');
    if (accrual.kind !== 'BONUS') {
      throw new BadRequestException(
        'Удалять можно только премии: начисления по заказам пересчитываются автоматически',
      );
    }
    if (accrual.paidAmount > 0 || accrual.status === 'PAID') {
      throw new BadRequestException(
        'Премия уже выплачена — удалить нельзя, иначе разойдётся история выплат',
      );
    }
    await this.prisma.salaryAccrual.delete({ where: { id } });
    return { ok: true };
  }
}
