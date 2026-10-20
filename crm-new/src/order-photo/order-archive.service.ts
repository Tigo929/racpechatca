import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  buildOrderSnapshot,
  daysLeft,
  purgeAfterFrom,
  restoreBlock,
  restoreBlockMessage,
  restorePayload,
  retentionDays,
  SNAPSHOT_INCLUDE,
} from './order-archive';
import { nextOrderNumber, ORDER_NUMBER_LOCK } from './order-sequence';
import type { DtoArchiveQuery } from './dto/archive-query.dto';

/** Кто совершает действие. Имя — снимком: сотрудника могут уволить. */
export interface ArchiveActor {
  id: string;
  name?: string;
}

/**
 * Поля списка корзины. Снимок сюда НЕ попадает намеренно: у заказа на
 * двести позиций он весит сотни килобайт, а списку нужны только номер,
 * причина и срок.
 */
const LIST_SELECT = {
  id: true,
  deletedAt: true,
  reason: true,
  deletedById: true,
  deletedByName: true,
  orderId: true,
  numberOrder: true,
  status: true,
  sourceOrder: true,
  productCategory: true,
  totalOrder: true,
  orderCreatedAt: true,
  purgeAfter: true,
  purgedAt: true,
  restoredAt: true,
  restoredById: true,
  restoredByName: true,
} as const;

@Injectable()
export class OrderArchiveService {
  private readonly logger = new Logger(OrderArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Срок хранения снимка в днях. */
  retentionDays(): number {
    return retentionDays(
      this.config.get<string>('ORDER_ARCHIVE_RETENTION_DAYS'),
    );
  }

  /**
   * Складывает заказ в корзину: причина плюс снимок, из которого заказ
   * потом собирается обратно.
   *
   * Вызывается ИЗ транзакции удаления и до самого удаления: если удаление
   * упадёт, транзакция откатит и запись корзины. Обратный порядок оставил
   * бы удалённый заказ без объяснения и без снимка.
   */
  async capture(
    tx: Prisma.TransactionClient,
    orderId: string,
    reason: string,
    deletedBy?: ArchiveActor,
  ): Promise<void> {
    const order = await tx.orderPhoto.findUnique({
      where: { id: orderId },
      include: SNAPSHOT_INCLUDE,
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const deletedAt = new Date();
    const snapshot = buildOrderSnapshot(order);

    await tx.orderDeletion.create({
      data: {
        deletedAt,
        reason,
        deletedById: deletedBy?.id ?? null,
        deletedByName: deletedBy?.name ?? null,
        orderId,
        numberOrder: order.numberOrder,
        status: order.status,
        sourceOrder: order.sourceOrder,
        productCategory: order.productCategory,
        totalOrder: order.totalOrder ?? 0,
        orderCreatedAt: order.createdAt,
        // Ключ заявки с сайта: по нему приём заявок узнаёт повторную
        // доставку уже удалённой заявки и не заводит её заново.
        externalRequestId: order.externalRequestId ?? null,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        purgeAfter: purgeAfterFrom(deletedAt, this.retentionDays()),
      },
    });
  }

  /** Список корзины: что удалено, кем, почему и сколько дней осталось. */
  async list(query: DtoArchiveQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.OrderDeletionWhereInput = {
      ...(query.sourceOrder ? { sourceOrder: query.sourceOrder } : {}),
      ...(query.productCategory
        ? { productCategory: query.productCategory }
        : {}),
      // По умолчанию показываем только то, что ещё можно вернуть:
      // восстановленное и просроченное — это уже история, а не корзина.
      ...(query.includeHandled
        ? {}
        : { restoredAt: null, purgedAt: null, purgeAfter: { gt: new Date() } }),
      ...(search
        ? {
            OR: [
              { numberOrder: { contains: search, mode: 'insensitive' } },
              { reason: { contains: search, mode: 'insensitive' } },
              { deletedByName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.orderDeletion.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { deletedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.orderDeletion.count({ where }),
    ]);

    const now = new Date();
    return {
      data: rows.map((row) => {
        // Снимок в список не тянем, но знать, есть ли он, интерфейсу нужно:
        // от этого зависит, показывать ли кнопку возврата. Отсутствие
        // purgeAfter означает запись до появления корзины — снимка нет.
        const block = restoreBlock(
          {
            restoredAt: row.restoredAt,
            snapshot: row.purgeAfter ? {} : null,
            purgeAfter: row.purgeAfter,
            purgedAt: row.purgedAt,
          },
          now,
        );
        return {
          ...row,
          daysLeft: daysLeft(row.purgeAfter, now),
          canRestore: block === null,
          restoreBlockedReason: block ? restoreBlockMessage(block) : null,
        };
      }),
      meta: {
        page,
        limit,
        quantityElements: count,
        totalPages: Math.ceil(count / limit),
        retentionDays: this.retentionDays(),
      },
    };
  }

  /**
   * Возвращает заказ из корзины.
   *
   * Собирается заново по снимку: сам заказ, позиции, история статусов,
   * назначения и невыплаченные начисления. Запись корзины остаётся и
   * закрывается отметкой restoredAt — восстановление одноразовое.
   */
  async restore(id: string, by?: ArchiveActor) {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.orderDeletion.findUnique({ where: { id } });
      if (!record) throw new NotFoundException('Запись корзины не найдена');

      const block = restoreBlock(record, new Date());
      if (block) throw new BadRequestException(restoreBlockMessage(block));

      const payload = restorePayload(record.snapshot);
      const orderId = payload.order.id;
      if (typeof orderId !== 'string' || !orderId) {
        throw new BadRequestException(
          'Снимок заказа повреждён: в нём нет идентификатора.',
        );
      }

      const existing = await tx.orderPhoto.findUnique({
        where: { id: orderId },
        select: { id: true, numberOrder: true },
      });
      if (existing) {
        throw new ConflictException(
          `Заказ уже существует под номером ${existing.numberOrder} — восстанавливать нечего.`,
        );
      }

      const warnings: string[] = [];

      // Номер мог быть занят: после удаления счётчик месяца откатывается на
      // MAX, и следующий новый заказ забирает освободившийся номер. Тогда
      // выдаём свежий — отказывать из-за номера неправильно, заказ нужнее.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ORDER_NUMBER_LOCK})`;
      // Через Json снимок приходит как unknown: берём номер только если это
      // действительно строка, иначе считаем, что номера нет, и выдаём новый.
      const wantedNumber =
        typeof payload.order.numberOrder === 'string'
          ? payload.order.numberOrder
          : '';
      const numberTaken = wantedNumber
        ? await tx.orderPhoto.findUnique({
            where: { numberOrder: wantedNumber },
            select: { id: true },
          })
        : null;
      if (numberTaken || !wantedNumber) {
        payload.order.numberOrder = await nextOrderNumber(tx);
        warnings.push(
          `Номер ${wantedNumber} уже занят — заказ восстановлен под номером ${String(payload.order.numberOrder)}.`,
        );
      }

      // Ключ заявки с сайта уникален. Если сайт успел дослать ту же заявку
      // и она завелась заново, ключ занят — снимаем его с восстановленного
      // заказа, иначе возврат упал бы на уникальном индексе.
      const externalId = payload.order.externalRequestId;
      if (typeof externalId === 'string' && externalId) {
        const taken = await tx.orderPhoto.findUnique({
          where: { externalRequestId: externalId },
          select: { numberOrder: true },
        });
        if (taken) {
          payload.order.externalRequestId = null;
          warnings.push(
            `Заявка с сайта уже заведена заново как ${taken.numberOrder} — проверьте, нет ли дубля.`,
          );
        }
      }

      // Исполнитель или оформивший могли быть удалены за это время. Поля
      // необязательные, поэтому заказ возвращаем без них, а не падаем.
      for (const field of ['executorId', 'processedById'] as const) {
        const userId = payload.order[field];
        if (typeof userId !== 'string' || !userId) continue;
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!user) {
          payload.order[field] = null;
          warnings.push(
            `Сотрудник из поля ${field} больше не числится — поле оставлено пустым.`,
          );
        }
      }

      const order = await tx.orderPhoto.create({
        data: payload.order as unknown as Prisma.OrderPhotoUncheckedCreateInput,
      });

      if (payload.items.length > 0) {
        await tx.itemPhoto.createMany({
          data: payload.items as unknown as Prisma.ItemPhotoCreateManyInput[],
        });
      }
      if (payload.tshirtItems.length > 0) {
        await tx.itemTshirt.createMany({
          data: payload.tshirtItems as unknown as Prisma.ItemTshirtCreateManyInput[],
        });
      }
      if (payload.canvasItems.length > 0) {
        await tx.itemCanvas.createMany({
          data: payload.canvasItems as unknown as Prisma.ItemCanvasCreateManyInput[],
        });
      }
      if (payload.statusHistory.length > 0) {
        await tx.statusHistory.createMany({
          data: payload.statusHistory as unknown as Prisma.StatusHistoryCreateManyInput[],
        });
      }
      if (payload.assignments.length > 0) {
        await tx.orderAssignment.createMany({
          data: payload.assignments as unknown as Prisma.OrderAssignmentCreateManyInput[],
        });
      }

      // Начисления: только те, по которым не платили. Исполнитель мог быть
      // удалён — такое начисление пропускаем, оно требует живого сотрудника.
      let restoredAccruals = 0;
      for (const accrual of payload.accruals) {
        const executorId = accrual.executorId;
        if (typeof executorId !== 'string' || !executorId) continue;
        const executor = await tx.user.findUnique({
          where: { id: executorId },
          select: { id: true },
        });
        if (!executor) {
          warnings.push(
            'Начисление зарплаты не восстановлено: сотрудник больше не числится.',
          );
          continue;
        }
        await tx.salaryAccrual.create({
          data: accrual as unknown as Prisma.SalaryAccrualUncheckedCreateInput,
        });
        restoredAccruals += 1;
      }
      if (payload.skippedPaidAccruals > 0) {
        warnings.push(
          `Начислений с выплатами: ${payload.skippedPaidAccruals}. Они не восстановлены — выплаты уже прошли, пересоберите зарплату по заказу руками.`,
        );
      }

      await tx.orderDeletion.update({
        where: { id },
        data: {
          restoredAt: new Date(),
          restoredById: by?.id ?? null,
          restoredByName: by?.name ?? null,
          // Снимок больше не нужен: заказ снова в системе, а держать копию
          // персональных данных клиента без причины нельзя.
          snapshot: Prisma.DbNull,
        },
      });

      this.logger.log(
        `Заказ ${order.numberOrder} восстановлен из корзины (позиции: ${
          payload.items.length +
          payload.tshirtItems.length +
          payload.canvasItems.length
        }, начисления: ${restoredAccruals}) — ${by?.name ?? 'без автора'}`,
      );

      return {
        message: `Заказ ${order.numberOrder} восстановлен`,
        data: order,
        warnings,
      };
    });
  }

  /**
   * Чистит снимки, которым вышел срок.
   *
   * Сама запись остаётся навсегда: по причинам удаления видно, почему
   * заявки не доходят до заказа, и эта статистика не должна исчезать
   * вместе со снимком. Уходит только копия заказа с данными клиента.
   */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.orderDeletion.updateMany({
      // purgedAt пуст — ещё не чистили; purgeAfter в прошлом — срок вышел.
      // Записи до появления корзины (purgeAfter пуст) не попадают: у них и
      // чистить нечего.
      where: { purgedAt: null, purgeAfter: { lt: now } },
      data: { snapshot: Prisma.DbNull, purgedAt: now },
    });
    if (count > 0) {
      this.logger.log(
        `Корзина: вычищено снимков по сроку — ${count} (срок хранения ${this.retentionDays()} дн.)`,
      );
    }
    return count;
  }
}
