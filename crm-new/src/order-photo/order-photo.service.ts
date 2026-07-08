import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import DtoCreateOrder from './dto/create-order.dto';
import { calcItemPricePosition } from './order-pricing';
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
import { StockService } from 'src/stock/stock.service';
import { TelegramService } from 'src/telegram/telegram.service';

function buildCommunicationUrl(
  platform: EnumCommunication,
  raw: string,
): string {
  if (platform === EnumCommunication.TELEGRAM) {
    return `https://t.me/${raw.slice(1)}`;
  }
  return raw;
}

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** «25 июня» — формат срока без зависимости от ICU. */
function formatRuDate(d: Date): string {
  const date = new Date(d);
  return `${date.getDate()} ${RU_MONTHS[date.getMonth()]}`;
}

/** Экранируем спецсимволы для parse_mode=HTML в Telegram. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const DEFAULT_LIST_HIDDEN_STATUSES: EnumStatus[] = [
  EnumStatus.SENT,
  EnumStatus.PAID,
  EnumStatus.LEAD,
];

const CONTROL_CLOSED_STATUSES: EnumStatus[] = [
  EnumStatus.PAID,
  EnumStatus.SENT,
  EnumStatus.DONE,
  EnumStatus.COMPLETED,
  EnumStatus.CANCELLED,
];

const FINISHED_STATUSES: EnumStatus[] = [
  EnumStatus.PAID,
  EnumStatus.COMPLETED,
  EnumStatus.CANCELLED,
];

const READY_STATUSES: EnumStatus[] = [EnumStatus.READY, EnumStatus.DONE];

const REVIEW_WAITING_STATUSES: EnumStatus[] = [
  EnumStatus.SENT,
  EnumStatus.PAID,
];

@Injectable()
export class OrderPhotoService {
  private readonly logger = new Logger(OrderPhotoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialIntegrity: OrderFinancialIntegrityService,
    private readonly stock: StockService,
    private readonly telegram: TelegramService,
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

      const freePrice = dto.freePrice ?? false;

      // Позиции считаем независимо от категории: заказ может содержать и обычные
      // позиции, и свободные (произвольные «название — цена»). Свободная цена
      // позиции = её цене (кол-во не умножается).
      const photoCreate = (dto.items ?? []).map((e) => {
        const itemFree = e.isFreePrice ?? freePrice;
        return {
          formatPaper: e.formatPaper,
          typePaper: e.typePaper,
          quantity: e.quantity,
          price: e.price,
          isFreePrice: itemFree,
          pricePosition: calcItemPricePosition(e.price, e.quantity, 0, itemFree),
        };
      });
      const tshirtCreate = (dto.tshirtItems ?? []).map((e) => {
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
          clientItem: e.clientItem ?? false,
        };
      });

      // Сумма заказа = все позиции (фото + футболки) + доставка. customTotal — ручной итог.
      const positionsTotal =
        photoCreate.reduce((s, i) => s + i.pricePosition, 0) +
        tshirtCreate.reduce((s, i) => s + i.pricePosition, 0);
      const totalOrder =
        dto.customTotal != null ? dto.customTotal : positionsTotal + dto.deliveryCost;

      return tx.orderPhoto.create({
        data: {
          numberOrder: fullDate(lengthOrder),
          totalOrder,
          isFreePrice: freePrice,
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
          items: photoCreate.length ? { create: photoCreate } : undefined,
          tshirtItems: tshirtCreate.length ? { create: tshirtCreate } : undefined,
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

    const where = this.buildOrdersWhere(query, currentUserId, currentUserRole, {
      applyListStatusDefaults: true,
    });

    const [orders, count] = await this.prisma.$transaction([
      this.prisma.orderPhoto.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: [{ createdAt: 'asc' }],
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

  async getOrderStats(
    query: DtoAllOrdersforQuery,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const contextWhere = this.buildOrdersWhere(
      query,
      currentUserId,
      currentUserRole,
      { applyListStatusDefaults: false },
    );
    const listWhere = this.buildOrdersWhere(query, currentUserId, currentUserRole, {
      applyListStatusDefaults: true,
    });

    const [orders, matchingTotal] = await this.prisma.$transaction([
      this.prisma.orderPhoto.findMany({
        where: contextWhere,
        select: {
          status: true,
          productCategory: true,
          isUrgent: true,
          deadline: true,
          createdAt: true,
          totalOrder: true,
          clientReviewLeft: true,
        },
      }),
      this.prisma.orderPhoto.count({ where: listWhere }),
    ]);

    const byStatus = Object.values(EnumStatus).reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<EnumStatus, number>,
    );
    const byProduct: Record<'PHOTO' | 'TSHIRT', number> = {
      PHOTO: 0,
      TSHIRT: 0,
    };

    let activeCount = 0;
    let overdueCount = 0;
    let urgentCount = 0;
    let alertCount = 0;
    let readyCount = 0;
    let sentUnpaidAmount = 0;
    let reviewPendingCount = 0;

    for (const order of orders) {
      byStatus[order.status] += 1;
      byProduct[order.productCategory] += 1;

      if (!FINISHED_STATUSES.includes(order.status)) {
        activeCount += 1;
      }

      if (READY_STATUSES.includes(order.status)) {
        readyCount += 1;
      }

      if (order.status === EnumStatus.SENT) {
        sentUnpaidAmount += order.totalOrder ?? 0;
      }

      if (REVIEW_WAITING_STATUSES.includes(order.status) && !order.clientReviewLeft) {
        reviewPendingCount += 1;
      }

      const isControlClosed = CONTROL_CLOSED_STATUSES.includes(order.status);
      const isUrgent = order.isUrgent && !isControlClosed;
      const isOverdue =
        !isControlClosed &&
        this.daysLeft(order.deadline, order.createdAt) !== null &&
        this.daysLeft(order.deadline, order.createdAt)! <= 0;

      if (isUrgent) urgentCount += 1;
      if (isOverdue) overdueCount += 1;
      if (isUrgent || isOverdue) alertCount += 1;
    }

    const isAdmin = currentUserRole === EnumRole.ADMIN;

    return {
      contextTotal: orders.length,
      matchingTotal,
      activeCount,
      leadCount: byStatus.LEAD,
      newCount: byStatus.NEW,
      inProgressCount:
        byStatus.FOLDER_STRUCTURE_CREATED +
        byStatus.IN_PROGRESS +
        byStatus.PRINTED,
      readyCount,
      sentUnpaidCount: byStatus.SENT,
      sentUnpaidAmount: isAdmin ? sentUnpaidAmount : null,
      paidCount: byStatus.PAID,
      reviewPendingCount: isAdmin ? reviewPendingCount : null,
      overdueCount,
      urgentCount,
      alertCount,
      byStatus,
      byProduct,
    };
  }

  private buildOrdersWhere(
    query: DtoAllOrdersforQuery,
    currentUserId: string,
    currentUserRole: string,
    options: { applyListStatusDefaults: boolean },
  ): Prisma.OrderPhotoWhereInput {
    // Strip leading @ so "@username" matches "https://t.me/username".
    const searchTerm = query.search?.replace(/^@/, '').trim() || undefined;

    return {
      // When searching by contact/number, don't restrict by status: the order
      // might already be SENT/PAID/LEAD. Without search, the list hides closed
      // statuses by default; stats can opt out and count the whole context.
      ...(options.applyListStatusDefaults
        ? {
            status: query.status
              ? query.status
              : searchTerm
                ? undefined
                : { notIn: DEFAULT_LIST_HIDDEN_STATUSES },
          }
        : {}),
      sourceOrder: query.sourceOrder,
      productCategory: query.productCategory,
      ...(query.reviewLeft !== undefined
        ? { clientReviewLeft: query.reviewLeft === 'true' }
        : {}),
      ...(currentUserRole === EnumRole.EXECUTOR
        ? { executorId: currentUserId }
        : {}),
      ...(searchTerm
        ? {
            OR: [
              { numberOrder: { contains: searchTerm, mode: 'insensitive' } },
              { urlCommunication: { contains: searchTerm, mode: 'insensitive' } },
              { note: { contains: searchTerm, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private daysLeft(deadline: Date | null, createdAt: Date): number | null {
    const due = deadline
      ? new Date(deadline)
      : new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    return Math.round(
      (dueDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24),
    );
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

    let executor: { id: string; rateBasisPoints: number | null; isActive: boolean; telegramUsername: string | null } | null = null;
    if (!isUnassign) {
      executor = await this.prisma.user.findUnique({
        where: { id: dto.executorId! },
      });
      if (!executor) throw new NotFoundException('Исполнитель не найден');
      if (!executor.isActive)
        throw new BadRequestException('Исполнитель деактивирован');
    }

    const result = await this.prisma.$transaction(async (tx) => {
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

    if (!isUnassign && result) {
      if (executor?.telegramUsername) {
        const text = this.buildAssignmentMessage(result, executor.telegramUsername);
        this.telegram.sendToGroup(text).catch(() => {});
      } else {
        this.logger.warn(
          `Заказ ${result.numberOrder}: у исполнителя не задан Telegram-юзернейм — уведомление в группу пропущено`,
        );
      }
    }

    return result;
  }

  /** Текст уведомления в общую группу при назначении исполнителя на заказ. */
  private buildAssignmentMessage(
    order: {
      numberOrder: string;
      deadline: Date | null;
      productCategory: string;
      isFreePrice: boolean | null;
      note: string | null;
      items: { formatPaper: string; typePaper: string; quantity: number }[];
      tshirtItems: { color: string; size: string; quantity: number }[];
    },
    username: string,
  ): string {
    const handle = `@${username.replace(/^@/, '')}`;

    const lines: string[] = [];
    for (const i of order.items) {
      if (order.isFreePrice) {
        lines.push(`• ${escapeHtml(i.formatPaper)} × ${i.quantity} шт`);
      } else {
        const type = i.typePaper === 'GLOSS' ? 'Глянец' : 'Матт';
        lines.push(`• ${escapeHtml(i.formatPaper)} (${type}) × ${i.quantity} шт`);
      }
    }
    for (const i of order.tshirtItems) {
      lines.push(`• Футболка ${escapeHtml(i.color)}, р-р ${i.size} × ${i.quantity} шт`);
    }
    if (lines.length === 0) lines.push('• (позиции не добавлены)');

    const deadlineStr = order.deadline ? `до ${formatRuDate(order.deadline)}` : 'не указан';
    const category = order.productCategory === 'TSHIRT' ? 'Футболки' : 'Фотопечать';

    const noteBlock = order.note
      ? ['', '─────────────────', `📝 <b>Примечание:</b>`, `<i>${escapeHtml(order.note)}</i>`]
      : [];

    return [
      `🔔 ${handle}, вам назначена задача!`,
      '',
      `📋 Заказ: <b>${escapeHtml(order.numberOrder)}</b>`,
      `🏷 Категория: ${category}`,
      `⏳ Срок: ${deadlineStr}`,
      '',
      '📦 Состав заказа:',
      ...lines,
      ...noteBlock,
    ].join('\n');
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

    // Исполнитель может двигать рабочий поток в любом направлении до оплаты.
    // PAID закрывает деньги и остаётся админским действием; CANCELLED тоже
    // оставляем админским, потому что это выводит заказ из рабочего процесса.
    const ADMIN_ONLY_STATUSES: EnumStatus[] = [
      EnumStatus.PAID,
      EnumStatus.CANCELLED,
    ];
    if (!isAdmin) {
      if (order.executorId !== userId) {
        throw new ForbiddenException(
          'Вы не назначены исполнителем этого заказа.',
        );
      }
      if (ADMIN_ONLY_STATUSES.includes(newStatus)) {
        throw new ForbiddenException(
          'Этот статус может установить только администратор.',
        );
      }
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

      // Склад: списываем остаток при переходе в «Отправлен» (блок при нехватке),
      // возвращаем при уходе из «Отправлен».
      if (newStatus === EnumStatus.SENT && lockedOrder.status !== EnumStatus.SENT) {
        await this.stock.consumeForOrder(id, tx);
      } else if (
        lockedOrder.status === EnumStatus.SENT &&
        newStatus !== EnumStatus.SENT
      ) {
        const activeAccrual = await tx.salaryAccrual.findFirst({
          where: {
            orderId: id,
            status: { in: ['PENDING', 'SETTLED', 'PARTIALLY_PAID', 'PAID'] },
          },
        });
        if (activeAccrual) {
          if (activeAccrual.paidAmount > 0 || activeAccrual.status === 'PAID') {
            throw new ConflictException(
              'Нельзя вернуть заказ из «Отправлен»: по нему уже была выплата зарплаты.',
            );
          }
          await tx.salaryAccrual.delete({ where: { id: activeAccrual.id } });
        }
        await this.stock.returnForOrder(id, tx);
      }

      // При переводе в SENT создаём начисление зарплаты исполнителю.
      // Это должно работать и для админа, и для назначенного исполнителя:
      // пользователь двигает статус, а финансовая целостность остаётся серверной.
      if (newStatus === EnumStatus.SENT && lockedOrder.executorId) {
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
          ...(newStatus === EnumStatus.SENT && !lockedOrder.sentAt
            ? { sentAt: new Date() }
            : {}),
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
        // Сумма = все сохранённые pricePosition (фото + футболки) + доставка.
        totalOrder:
          order.items.reduce((s, i) => s + (i.pricePosition ?? 0), 0) +
          order.tshirtItems.reduce((s, i) => s + (i.pricePosition ?? 0), 0) +
          (dto.deliveryCost ?? order.deliveryCost),
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

  /** Отметить, оставил ли клиент отзыв (вручную из списка заказов). */
  async setReviewLeft(idOrder: string, value: boolean) {
    await this.getOrderById(idOrder, '', EnumRole.ADMIN);
    return this.prisma.orderPhoto.update({
      where: { id: idOrder },
      data: { clientReviewLeft: value },
      include: {
        items: true,
        tshirtItems: true,
        executor: { select: { id: true, username: true } },
      },
    });
  }

  async deleteOrder(idOrder: string) {
    await this.getOrderById(idOrder, '', EnumRole.ADMIN);

    return this.prisma.$transaction(async (tx) => {
      // Возвращаем списанный со склада остаток (если заказ был отправлен).
      await this.stock.returnForOrder(idOrder, tx);

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
