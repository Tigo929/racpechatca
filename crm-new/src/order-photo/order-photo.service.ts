import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import DtoCreateOrder from './dto/create-order.dto';
import { calcOrderTotal } from './order-pricing';
import fullDate from 'src/utils/full-date';
import DtoAllOrdersforQuery from './dto/all-oreders-for-query.dto';
import UpdateStatus from './dto/update-status.dto';
import { DtoUpdateOrder } from './dto/update-order.dto';
import { DtoCreateLead } from './dto/create-lead.dto';
import { DtoAssignExecutor } from './dto/assign-executor.dto';
import {
  EnumCommunication,
  EnumRole,
  EnumStatus,
} from 'src/generated/prisma/enums';
import type { Prisma } from 'src/generated/prisma/client';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import { calculateSalarySnapshot } from 'src/salary/salary-calculation';

function buildCommunicationUrl(
  platform: EnumCommunication,
  raw: string,
): string {
  if (platform === EnumCommunication.TELEGRAM) {
    return `https://t.me/${raw.slice(1)}`;
  }
  return raw;
}

@Injectable()
export class OrderPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialIntegrity: OrderFinancialIntegrityService,
  ) {}

  async createOrder(dto: DtoCreateOrder) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1001)`;

      const now = new Date();
      const monthPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      const seqResult = await tx.$queryRaw<{ max: number }[]>`
        SELECT COALESCE(MAX(CAST(SPLIT_PART("numberOrder", '-', 2) AS INTEGER)), 0) AS max
        FROM "OrderPhoto"
        WHERE "numberOrder" LIKE ${monthPrefix + '%'}
      `;
      const lastSeq = Number(seqResult[0]?.max ?? 0);
      const lengthOrder = String(lastSeq + 1).padStart(3, '0');

      const isTshirt = dto.productCategory === 'TSHIRT';
      const itemsForTotal = isTshirt
        ? (dto.tshirtItems ?? [])
        : (dto.items ?? []);

      // Свободная цена: итог задан вручную; иначе считаем из позиций.
      const totalOrder =
        dto.customTotal != null
          ? dto.customTotal
          : calcOrderTotal(itemsForTotal, dto.deliveryCost);

      return tx.orderPhoto.create({
        data: {
          numberOrder: fullDate(lengthOrder),
          totalOrder,
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),

          ...(dto.status ? { status: dto.status } : {}),
          sourceOrder: dto.sourceOrder,
          communicationPlatform: dto.communicationPlatform,
          urlCommunication: buildCommunicationUrl(
            dto.communicationPlatform,
            dto.urlCommunication,
          ),
          deliveryMethod: dto.deliveryMethod,
          deliveryCost: dto.deliveryCost,
          note: dto.note,
          productCategory: dto.productCategory ?? 'PHOTO',
          items: isTshirt
            ? undefined
            : {
                create: (dto.items ?? []).map((e) => ({
                  formatPaper: e.formatPaper,
                  typePaper: e.typePaper,
                  quantity: e.quantity,
                  price: e.price,
                  pricePosition: e.price * e.quantity,
                })),
              },
          tshirtItems: isTshirt
            ? {
                create: (dto.tshirtItems ?? []).map((e) => {
                  const dc = e.designCost ?? 0;
                  return {
                    color: e.color,
                    size: e.size,
                    printLocation: e.printLocation,
                    quantity: e.quantity,
                    price: e.price,
                    pricePosition: e.price * e.quantity + dc,
                    designCost: dc,
                    designUrl: e.designUrl,
                    designNote: e.designNote,
                  };
                }),
              }
            : undefined,
        },
        include: { items: true, tshirtItems: true },
      });
    });
  }

  async createLead(dto: DtoCreateLead) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1001)`;

      const now = new Date();
      const monthPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      const seqResult = await tx.$queryRaw<{ max: number }[]>`
        SELECT COALESCE(MAX(CAST(SPLIT_PART("numberOrder", '-', 2) AS INTEGER)), 0) AS max
        FROM "OrderPhoto"
        WHERE "numberOrder" LIKE ${monthPrefix + '%'}
      `;
      const lastSeq = Number(seqResult[0]?.max ?? 0);
      const lengthOrder = String(lastSeq + 1).padStart(3, '0');

      const tgRaw = (dto.telegram ?? '').trim().replace(/^@/, '');
      const noteLines = [
        `🆕 Заявка с сайта`,
        `Имя: ${dto.name}`,
        `Телефон: ${dto.phone}`,
        tgRaw ? `Telegram: @${tgRaw}` : null,
        dto.description ? `Описание: ${dto.description}` : null,
      ].filter(Boolean);

      return tx.orderPhoto.create({
        data: {
          numberOrder: fullDate(lengthOrder),

          status: EnumStatus.LEAD,
          sourceOrder: 'LOCAL',
          communicationPlatform: tgRaw ? 'TELEGRAM' : 'MAX',
          urlCommunication: tgRaw ? `https://t.me/${tgRaw}` : dto.phone,
          deliveryMethod: 'PICKUP',
          deliveryCost: 0,
          totalOrder: 0,
          productCategory: dto.productCategory ?? 'TSHIRT',
          note: noteLines.join('\n'),
        },
      });
    });
  }

  async getAllOrders(
    query: DtoAllOrdersforQuery,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.OrderPhotoWhereInput = {
      // «Все» = только активные заказы. Закрытые/особые состояния (SENT, PAID, LEAD)
      // прячем — у каждого есть своя вкладка-фильтр.
      status: query.status ?? {
        notIn: [EnumStatus.SENT, EnumStatus.PAID, EnumStatus.LEAD],
      },
      sourceOrder: query.sourceOrder,
      productCategory: query.productCategory,
      ...(currentUserRole === 'EXECUTOR' ? { executorId: currentUserId } : {}),
    };

    const [orders, count] = await this.prisma.$transaction([
      this.prisma.orderPhoto.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: 'asc' },
        include: {
          items: true,
          tshirtItems: true,
          executor: { select: { id: true, username: true } },
        },
      }),
      this.prisma.orderPhoto.count({
        where,
      }),
    ]);
    return {
      data: orders,
      meta: {
        page,
        limit,
        quantityElements: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getOrderById(
    idOrder: string,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      include: {
        items: true,
        tshirtItems: true,
        executor: { select: { id: true, username: true } },
        accruals: {
          select: {
            id: true,
            status: true,
            salaryAmount: true,
            paidAmount: true,
            rateBasisPoints: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (
      currentUserRole === EnumRole.EXECUTOR &&
      order.executorId !== currentUserId
    ) {
      throw new ForbiddenException('Нет доступа к чужому заказу.');
    }
    return order;
  }

  async assignExecutor(
    orderId: string,
    dto: DtoAssignExecutor,
    adminId: string,
  ) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const isUnassign = !dto.executorId;

    let executor: { id: string; rateBasisPoints: number | null; isActive: boolean } | null = null;
    if (!isUnassign) {
      executor = await this.prisma.user.findUnique({
        where: { id: dto.executorId! },
      });
      if (!executor) throw new NotFoundException('Исполнитель не найден');
      if (!executor.isActive)
        throw new BadRequestException('Исполнитель деактивирован');
    }

    return this.prisma.$transaction(async (tx) => {
      // Если заказ в SENT — управляем начислением
      if (order.status === EnumStatus.SENT) {
        const oldAccrual = await tx.salaryAccrual.findFirst({
          where: { orderId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        });

        if (oldAccrual) {
          if (oldAccrual.paidAmount === 0) {
            await tx.salaryAccrual.delete({ where: { id: oldAccrual.id } });
          } else {
            await tx.salaryAccrual.update({
              where: { id: oldAccrual.id },
              data: { status: 'REVERSED' },
            });
          }
        }

        // Создаём начисление только при назначении (не при снятии)
        if (!isUnassign && executor && executor.rateBasisPoints !== null) {
          const snapshot = calculateSalarySnapshot(
            order.totalOrder,
            order.deliveryCost,
            executor.rateBasisPoints,
          );
          await tx.salaryAccrual.create({
            data: { orderId, executorId: dto.executorId!, ...snapshot },
          });
        }
      }

      await tx.orderPhoto.update({
        where: { id: orderId },
        data: { executorId: isUnassign ? null : dto.executorId },
      });

      if (!isUnassign) {
        await tx.orderAssignment.create({
          data: {
            orderId,
            executorId: dto.executorId!,
            assignedBy: adminId,
            note: dto.note,
          },
        });
      }

      return tx.orderPhoto.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          tshirtItems: true,
          executor: { select: { id: true, username: true } },
          accruals: {
            select: { id: true, status: true, salaryAmount: true, paidAmount: true, rateBasisPoints: true },
          },
        },
      });
    });
  }

  async updateStatusOrder(
    id: string,
    dto: UpdateStatus,
    userId: string,
    userRole: string,
  ) {
    const order = await this.getOrderById(id, userId, userRole);

    const isAdmin = userRole === 'ADMIN';

    const newStatus = dto.status;

    // Исполнитель может переводить только в READY_FOR_REVIEW, если назначен на этот заказ.
    if (!isAdmin) {
      if (newStatus !== 'READY_FOR_REVIEW') {
        throw new ForbiddenException(
          'Исполнитель может переводить заказ только в статус «Готов к проверке».',
        );
      }
      if (order.executorId !== userId) {
        throw new ForbiddenException(
          'Вы не назначены исполнителем этого заказа.',
        );
      }
    }

    // Только ADMIN может переводить в SENT, PAID, COMPLETED, CANCELLED
    if (
      (newStatus === 'SENT' ||
        newStatus === 'PAID' ||
        newStatus === 'COMPLETED' ||
        newStatus === 'CANCELLED') &&
      !isAdmin
    ) {
      throw new ForbiddenException(
        'Только администратор может устанавливать этот статус.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "OrderPhoto"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const lockedOrder = await tx.orderPhoto.findUnique({
        where: { id },
        include: {
          items: true,
          tshirtItems: true,
          executor: { select: { id: true, username: true } },
        },
      });
      if (!lockedOrder) throw new NotFoundException('Заказ не найден');

      // Записываем историю изменения статуса
      await tx.statusHistory.create({
        data: {
          orderId: id,

          fromStatus: lockedOrder.status,
          toStatus: newStatus,
          changedBy: userId,
        },
      });

      // При переводе в SENT создаём начисление зарплаты исполнителю
      if (newStatus === EnumStatus.SENT && isAdmin && lockedOrder.executorId) {
        const executor = await tx.user.findUnique({
          where: { id: lockedOrder.executorId },
        });

        if (executor && executor.rateBasisPoints !== null) {
          const existingAccrual = await tx.salaryAccrual.findFirst({
            where: { orderId: id, status: { not: 'REVERSED' } },
          });

          if (!existingAccrual) {
            const snapshot = calculateSalarySnapshot(
              lockedOrder.totalOrder,
              lockedOrder.deliveryCost,
              executor.rateBasisPoints,
            );

            await tx.salaryAccrual.create({
              data: {
                orderId: id,
                executorId: lockedOrder.executorId,
                ...snapshot,
              },
            });
          }
        }
      }

      // При переводе в PAID автоматически закрываем незакрытый долг по зарплате
      if (newStatus === EnumStatus.PAID && isAdmin) {
        const accrual = await tx.salaryAccrual.findFirst({
          where: { orderId: id, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        });

        if (accrual) {
          const remaining = accrual.salaryAmount - accrual.paidAmount;
          if (remaining > 0) {
            const payment = await tx.salaryPayment.create({
              data: {
                executorId: accrual.executorId,
                paidById: userId,
                amount: remaining,
                note: `Автовыплата при переводе заказа ${lockedOrder.numberOrder} в «Оплачен»`,
              },
            });
            await tx.salaryAccrual.update({
              where: { id: accrual.id },
              data: { paidAmount: accrual.salaryAmount, status: 'PAID' },
            });
            await tx.paymentAccrualLink.create({
              data: {
                paymentId: payment.id,
                accrualId: accrual.id,
                amount: remaining,
              },
            });
          }
        }
      }

      const updated = await tx.orderPhoto.update({
        where: { id },
        data: {
          status: dto.status,
          ...(newStatus === EnumStatus.COMPLETED
            ? { completedAt: lockedOrder.completedAt ?? new Date() }
            : {}),
        },
        include: {
          items: true,
          tshirtItems: true,
          executor: { select: { id: true, username: true } },
        },
      });

      return updated;
    });
  }

  async updateOrder(idOrder: string, dto: DtoUpdateOrder) {
    const order = await this.getOrderById(idOrder, '', EnumRole.ADMIN);
    const deliveryChanged = dto.deliveryCost !== undefined;
    if (deliveryChanged) {
      await this.financialIntegrity.assertOrderFinanciallyEditable(idOrder);
    }
    const updated = await this.prisma.orderPhoto.update({
      where: { id: idOrder },
      include: {
        items: true,
        tshirtItems: true,
        executor: { select: { id: true, username: true } },
      },
      data: {
        sourceOrder: dto.sourceOrder ?? order.sourceOrder,
        communicationPlatform:
          dto.communicationPlatform ?? order.communicationPlatform,
        urlCommunication: dto.urlCommunication
          ? buildCommunicationUrl(
              dto.communicationPlatform ?? order.communicationPlatform,
              dto.urlCommunication,
            )
          : order.urlCommunication,
        deliveryMethod: dto.deliveryMethod ?? order.deliveryMethod,
        deliveryCost: dto.deliveryCost ?? order.deliveryCost,
        totalOrder: calcOrderTotal(
          order.productCategory === 'TSHIRT' ? order.tshirtItems : order.items,
          dto.deliveryCost ?? order.deliveryCost,
        ),
        note: dto.note ?? order.note,
        isUrgent: dto.isUrgent !== undefined ? dto.isUrgent : order.isUrgent,
      },
    });
    // Доставка влияет на сумму → подгоняем невыплаченное начисление.
    if (deliveryChanged) {
      await this.financialIntegrity.recalcPendingAccrual(
        idOrder,
        updated.totalOrder,
        updated.deliveryCost,
      );
    }
    return updated;
  }

  async deleteOrder(idOrder: string) {
    await this.getOrderById(idOrder, '', EnumRole.ADMIN);

    return this.prisma.$transaction(async (tx) => {
      // Удаляем все начисления (любой статус) и их платёжные связи
      const accruals = await tx.salaryAccrual.findMany({
        where: { orderId: idOrder },
        select: { id: true },
      });
      if (accruals.length > 0) {
        const ids = accruals.map((a) => a.id);
        await tx.paymentAccrualLink.deleteMany({ where: { accrualId: { in: ids } } });
        await tx.salaryAccrual.deleteMany({ where: { id: { in: ids } } });
      }

      const deleted = await tx.orderPhoto.delete({
        where: { id: idOrder },
        include: { items: true, tshirtItems: true },
      });

      return { message: 'Заказ удалён успешно', data: deleted };
    });
  }

}
