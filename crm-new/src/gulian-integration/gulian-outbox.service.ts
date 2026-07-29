import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import {
  EnumGulianOutboxStatus,
  EnumGulianSyncState,
  EnumProductCategory,
} from 'src/generated/prisma/enums';
import { PartnerSettingsService } from 'src/partner/partner-settings.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  buildGulianEvent,
  calculateGulianPayout,
  productionStatusFromOrderStatus,
  type GulianPayloadValidationError,
} from './gulian-payload';
import type {
  GulianProductionStatus,
  GulianUpsertEvent,
} from './gulian.types';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class GulianOutboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerSettings: PartnerSettingsService,
  ) {}

  async preview(orderId: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      include: { tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.productCategory !== EnumProductCategory.TSHIRT) {
      throw new BadRequestException('Исполнителю отправляются только футболки.');
    }
    if (!order.numberOrder?.trim()) {
      throw new BadRequestException('У заказа отсутствует номер.');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Отменённый заказ нельзя отправить исполнителю.');
    }
    const settings = await this.partnerSettings.get();
    try {
      return calculateGulianPayout(
        order.tshirtItems,
        settings.partnerRateBasisPoints,
      );
    } catch (error) {
      await this.recordAudit({
        orderId,
        action: 'dispatch_validation_failed',
        level: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Не удалось определить количество изделий',
      });
      throw new BadRequestException('Не удалось определить количество изделий');
    }
  }

  async enqueueCurrent(
    tx: Prisma.TransactionClient,
    params: {
      orderId: string;
      productionStatus: GulianProductionStatus;
      actor?: string;
      action: string;
      eventId?: string;
    },
  ) {
    const order = await tx.orderPhoto.findUnique({
      where: { id: params.orderId },
      include: { tshirtItems: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    const settings = await this.partnerSettings.get(tx);
    let event: GulianUpsertEvent;
    try {
      event = buildGulianEvent({
        order,
        partnerRateBasisPoints: settings.partnerRateBasisPoints,
        productionStatus: params.productionStatus,
        eventId: params.eventId,
      });
    } catch (error) {
      const validationError = error as GulianPayloadValidationError;
      await this.recordAudit(
        {
          orderId: params.orderId,
          actor: params.actor,
          action: 'outbox_validation_failed',
          level: 'error',
          message:
            validationError instanceof Error
              ? validationError.message
              : 'Не удалось сформировать событие Gulian',
        },
        tx,
      );
      throw new BadRequestException(
        validationError instanceof Error
          ? validationError.message
          : 'Не удалось сформировать событие Gulian',
      );
    }

    const outbox = await tx.gulianOutboxEvent.create({
      data: {
        eventId: event.event_id,
        eventType: event.event_type,
        aggregateId: order.id,
        externalOrderId: order.numberOrder,
        sourceRevision: order.sourceRevision,
        payloadJson: event as unknown as Prisma.InputJsonValue,
        status: EnumGulianOutboxStatus.PENDING,
        nextAttemptAt: new Date(),
      },
    });
    await tx.orderPhoto.update({
      where: { id: order.id },
      data: {
        gulianSyncState: EnumGulianSyncState.PENDING,
        gulianLastError: null,
      },
    });
    await this.recordAudit(
      {
        orderId: order.id,
        actor: params.actor,
        action: params.action,
        message: `Создано событие ${event.event_id}, revision ${order.sourceRevision}.`,
        details: {
          eventId: event.event_id,
          sourceRevision: order.sourceRevision,
          productionStatus: params.productionStatus,
        },
      },
      tx,
    );
    return { outbox, event };
  }

  async retry(orderId: string, actor?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "OrderPhoto" WHERE "id" = ${orderId} FOR UPDATE
      `;
      const order = await tx.orderPhoto.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Заказ не найден');
      const latest = await tx.gulianOutboxEvent.findFirst({
        where: { aggregateId: orderId },
        orderBy: { createdAt: 'desc' },
      });

      if (!latest) {
        const productionStatus = productionStatusFromOrderStatus(order.status);
        if (!productionStatus || !order.telegramMessageId) {
          throw new BadRequestException(
            'Сначала отправьте заказ исполнителю в Telegram.',
          );
        }
        return this.enqueueCurrent(tx, {
          orderId,
          productionStatus,
          actor,
          action: 'gulian_manual_enqueue',
        });
      }
      if (latest.status === EnumGulianOutboxStatus.DELIVERED) return latest;

      const retried = await tx.gulianOutboxEvent.update({
        where: { id: latest.id },
        data: {
          status: EnumGulianOutboxStatus.PENDING,
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: null,
        },
      });
      await tx.orderPhoto.update({
        where: { id: orderId },
        data: {
          gulianSyncState: EnumGulianSyncState.PENDING,
          gulianLastError: null,
        },
      });
      await this.recordAudit(
        {
          orderId,
          actor,
          action: 'gulian_manual_retry',
          message: `Событие ${latest.eventId} поставлено на повторную доставку.`,
        },
        tx,
      );
      return retried;
    });
  }

  async getLog(orderId: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    const [events, audit] = await Promise.all([
      this.prisma.gulianOutboxEvent.findMany({
        where: { aggregateId: orderId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.integrationAuditLog.findMany({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return { events, audit };
  }

  async recordAudit(
    params: {
      orderId?: string;
      action: string;
      level?: 'info' | 'warning' | 'error';
      actor?: string;
      message: string;
      details?: Prisma.InputJsonObject;
    },
    db: Db = this.prisma,
  ) {
    return db.integrationAuditLog.create({
      data: {
        orderId: params.orderId,
        action: params.action,
        level: params.level ?? 'info',
        actor: params.actor,
        message: params.message,
        details: params.details,
      },
    });
  }
}