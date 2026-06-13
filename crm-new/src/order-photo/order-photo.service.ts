import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import DtoCreateOrder from './dto/create-order.dto';
import calculatorTotalPrice from 'src/utils/caculator-total-price';
import fullDate from 'src/utils/full-date';
import DtoAllOrdersforQuery from './dto/all-oreders-for-query.dto';
import UpdateStatus from './dto/update-status.dto';
import { DtoUpdateOrder } from './dto/update-order.dto';
import { DtoCreateLead } from './dto/create-lead.dto';
import { DtoAssignExecutor } from './dto/assign-executor.dto';
import { EnumCommunication } from 'src/generated/prisma/enums';

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
  constructor(private prisma: PrismaService) {}

  async createOrder(dto: DtoCreateOrder) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1001)`;

      const now = new Date();
      const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const monthPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      const seqResult = await tx.$queryRaw<{ max: number }[]>`
        SELECT COALESCE(MAX(CAST(SPLIT_PART("numberOrder", '-', 2) AS INTEGER)), 0) AS max
        FROM "OrderPhoto"
        WHERE "numberOrder" LIKE ${monthPrefix + '%'}
      `;
      const lastSeq = Number(seqResult[0]?.max ?? 0);
      const lengthOrder = String(lastSeq + 1).padStart(3, '0');

      void datePrefix;

      const isTshirt = dto.productCategory === 'TSHIRT';
      const itemsForTotal = isTshirt
        ? (dto.tshirtItems ?? [])
        : (dto.items ?? []);

      return tx.orderPhoto.create({
        data: {
          numberOrder: fullDate(lengthOrder),
          totalOrder: calculatorTotalPrice(itemsForTotal, dto.deliveryCost),
          deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          status: 'LEAD' as any,
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

  async getAllOrders(query: DtoAllOrdersforQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [orders, count] = await this.prisma.$transaction([
      this.prisma.orderPhoto.findMany({
        where: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          status: (query.status ?? { notIn: ['SENT', 'LEAD'] }) as any,
          sourceOrder: query.sourceOrder,
          productCategory: query.productCategory,
        },
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
        where: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          status: (query.status ?? { notIn: ['SENT', 'LEAD'] }) as any,
          sourceOrder: query.sourceOrder,
          productCategory: query.productCategory,
        },
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

  async getOrderById(idOrder: string) {
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

    const executor = await this.prisma.user.findUnique({
      where: { id: dto.executorId },
    });
    if (!executor) throw new NotFoundException('Исполнитель не найден');
    if (!executor.isActive)
      throw new BadRequestException('Исполнитель деактивирован');

    return this.prisma.$transaction(async (tx) => {
      await tx.orderPhoto.update({
        where: { id: orderId },
        data: { executorId: dto.executorId },
      });
      await tx.orderAssignment.create({
        data: {
          orderId,
          executorId: dto.executorId,
          assignedBy: adminId,
          note: dto.note,
        },
      });
      return tx.orderPhoto.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          tshirtItems: true,
          executor: { select: { id: true, username: true } },
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
    const order = await this.getOrderById(id);

    const isAdmin = userRole === 'ADMIN';

    const newStatus = dto.status as any as string;

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

    // Только ADMIN может переводить в COMPLETED, CANCELLED
    if ((newStatus === 'COMPLETED' || newStatus === 'CANCELLED') && !isAdmin) {
      throw new ForbiddenException(
        'Только администратор может завершать или отменять заказ.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Записываем историю изменения статуса
      await tx.statusHistory.create({
        data: {
          orderId: id,

          fromStatus: order.status,
          toStatus: newStatus,
          changedBy: userId,
        },
      });

      // При переводе в COMPLETED создаём начисление зарплаты
      if (newStatus === 'COMPLETED' && isAdmin) {
        if (!order.executorId) {
          throw new BadRequestException(
            'Нельзя завершить заказ без назначенного исполнителя.',
          );
        }

        const executor = await tx.user.findUnique({
          where: { id: order.executorId },
        });
        if (!executor) throw new NotFoundException('Исполнитель не найден');

        const existingAccrual = await tx.salaryAccrual.findUnique({
          where: { orderId: id },
        });

        if (!existingAccrual) {
          const salaryBase =
            (order.totalOrder ?? 0) - (order.deliveryCost ?? 0);
          const rate = executor.rateBasisPoints;
          const salaryAmount = Math.round((salaryBase * rate) / 10000);

          await tx.salaryAccrual.create({
            data: {
              orderId: id,
              executorId: order.executorId,
              salaryBase,
              rateBasisPoints: rate,
              salaryAmount,
            },
          });
        }

        await tx.orderPhoto.update({
          where: { id },
          data: { completedAt: new Date() },
        });
      }

      const updated = await tx.orderPhoto.update({
        where: { id },
        data: { status: dto.status },
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
    const order = await this.getOrderById(idOrder);
    return this.prisma.orderPhoto.update({
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
        status: dto.status ?? order.status,
        totalOrder: calculatorTotalPrice(
          order.productCategory === 'TSHIRT' ? order.tshirtItems : order.items,
          dto.deliveryCost ?? order.deliveryCost,
        ),
        note: dto.note ?? order.note,
        isUrgent: dto.isUrgent !== undefined ? dto.isUrgent : order.isUrgent,
      },
    });
  }

  async deleteOrder(idOrder: string) {
    await this.getOrderById(idOrder);

    const activeAccruals = await this.prisma.salaryAccrual.count({
      where: {
        orderId: idOrder,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      },
    });
    if (activeAccruals > 0) {
      throw new BadRequestException(
        'Нельзя удалить заказ с незакрытыми начислениями зарплаты.',
      );
    }

    const deleted = await this.prisma.orderPhoto.delete({
      where: { id: idOrder },
      include: { items: true, tshirtItems: true },
    });

    return {
      message: 'Заказ удалён успешно',
      data: deleted,
    };
  }

  // ── Legacy salary summary (backward compat) ──────────────────────────────────

  private static readonly EMPLOYEE_RATE = 0.3;

  async getSalarySummary() {
    const rate = OrderPhotoService.EMPLOYEE_RATE;

    const orders = await this.prisma.orderPhoto.findMany({
      where: {
        productCategory: 'PHOTO',

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        status: { in: ['SENT', 'PAID'] } as any,
      },
      orderBy: { updatedAt: 'desc' },
      include: { items: true },
    });

    const mapOrder = (o: (typeof orders)[number]) => {
      const cleanTotal = (o.totalOrder ?? 0) - (o.deliveryCost ?? 0);
      const employeeShare = Math.round(cleanTotal * rate);
      const ownerShare = cleanTotal - employeeShare;
      return {
        id: o.id,
        numberOrder: o.numberOrder,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        status: o.status,
        totalOrder: o.totalOrder ?? 0,
        deliveryCost: o.deliveryCost ?? 0,
        cleanTotal,
        employeeShare,
        ownerShare,
      };
    };

    const toPay = orders.filter((o) => o.status === 'SENT').map(mapOrder);
    const paid = orders.filter((o) => o.status === 'PAID').map(mapOrder);

    const sum = (
      arr: ReturnType<typeof mapOrder>[],
      key: 'cleanTotal' | 'employeeShare' | 'ownerShare',
    ) => arr.reduce((acc, o) => acc + o[key], 0);

    return {
      ratePercent: Math.round(rate * 100),
      toPay,
      paid,
      summary: {
        toPayCount: toPay.length,
        toPayClean: sum(toPay, 'cleanTotal'),
        toPayEmployee: sum(toPay, 'employeeShare'),
        toPayOwner: sum(toPay, 'ownerShare'),
        paidCount: paid.length,
        paidClean: sum(paid, 'cleanTotal'),
        paidEmployee: sum(paid, 'employeeShare'),
        paidOwner: sum(paid, 'ownerShare'),
      },
    };
  }
}
