import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import type { GulianOrderPayload } from './gulian.service';
import { toGulianStatus } from './gulian-status';
import { calcGulianPayout } from './gulian-payout';
import {
  settlementPositions,
  type PartnerPayout,
} from 'src/partner/settlement-positions';
import { EnumStatus } from 'src/generated/prisma/enums';
import { ConfigService } from '@nestjs/config';

export type OrderForOutbox = {
  id: string;
  numberOrder: string;
  status: EnumStatus;
  createdAt: Date;
  updatedAt: Date;
  executorSentAt: Date | null;
  sourceRevision: number;
  partnerTgChatId: string | null;
  partnerTgMessageId: number | null;
  tshirtItems: {
    quantity: number;
    pricePosition: number;
    designCost: number;
    thermalCost: number;
    blankCost: number;
    clientItem: boolean;
  }[];
  /*
   * Свободные позиции тоже работа исполнителя: печать по изделию заказчика и
   * печать термотрансферов. Без них заказ без единой футболки не доезжал до
   * его CRM вовсе.
   */
  items?: {
    quantity: number;
    pricePosition: number;
    printOnClientItem: boolean;
    thermalCost: number;
    partnerPayout?: PartnerPayout | null;
    partnerRateBasisPoints?: number | null;
  }[];
};

@Injectable()
export class GulianOutboxService {
  private readonly logger = new Logger(GulianOutboxService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.baseUrl = (config.get<string>('PUBLIC_BASE_URL') ?? '').replace(/\/+$/, '');
  }

  async enqueue(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0] | PrismaService,
    order: OrderForOutbox,
    rateBasisPoints: number,
    cancelledZeroPayout = false,
  ): Promise<void> {
    const payout = cancelledZeroPayout
      ? {
          quantity:
            settlementPositions(order).reduce((s, p) => s + p.quantity, 0) || 1,
          totalPayoutKopecks: 0,
          unitPayoutKopecks: 0,
          mode: 'order_total' as const,
        }
      : calcGulianPayout(order, rateBasisPoints);

    const productionStatus = toGulianStatus(order.status, order.executorSentAt);
    const eventId = randomUUID();

    const payload: GulianOrderPayload = {
      externalOrderId: order.numberOrder,
      externalInternalId: order.id,
      sourceRevision: order.sourceRevision,
      quantity: payout.quantity,
      payoutCalculationMode: payout.mode,
      unitPayoutAmountKopecks: payout.unitPayoutKopecks,
      totalPayoutAmountKopecks: payout.totalPayoutKopecks,
      productionStatus,
      telegramChatId: order.partnerTgChatId,
      telegramMessageId: order.partnerTgMessageId != null ? String(order.partnerTgMessageId) : null,
      sourceUrl: `/orders/${order.id}`,
      createdAt: order.createdAt,
      updatedAt: new Date(),
    };

    await (tx as any).gulianOutbox.create({
      data: {
        id: randomUUID(),
        eventId,
        aggregateId: order.id,
        externalOrderId: order.numberOrder,
        sourceRevision: order.sourceRevision,
        payloadJson: payload as any,
        status: 'pending',
        nextAttemptAt: new Date(),
      },
    });

    this.logger.log(`Enqueued Gulian event ${eventId} for order ${order.numberOrder} (${productionStatus})`);
  }

  async getOutboxForOrder(orderId: string) {
    return this.prisma.gulianOutbox.findMany({
      where: { aggregateId: orderId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async retryFailed(orderId: string): Promise<number> {
    const result = await this.prisma.gulianOutbox.updateMany({
      where: { aggregateId: orderId, status: 'failed' },
      data: { status: 'pending', nextAttemptAt: new Date(), lastError: null },
    });
    return result.count;
  }
}