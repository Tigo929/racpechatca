import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GulianService } from './gulian.service';
import type { GulianOrderPayload } from './gulian.service';

const RETRY_DELAYS_SECONDS = [60, 300, 900, 3600, 21600];

@Injectable()
export class GulianOutboxProcessorService implements OnModuleInit {
  private readonly logger = new Logger(GulianOutboxProcessorService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gulian: GulianService,
  ) {}

  onModuleInit() {
    if (!this.gulian.enabled) return;
    setInterval(() => this.process(), 30_000);
    setTimeout(() => this.process(), 5_000);
  }

  async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processOnce();
    } catch (err) {
      this.logger.error('Outbox processor error', err);
    } finally {
      this.running = false;
    }
  }

  private async processOnce(): Promise<void> {
    const items = await this.prisma.$queryRaw<{ id: string; eventId: string; payloadJson: unknown; attempts: number }[]>`
      UPDATE "GulianOutbox"
      SET "status" = 'processing', "lastAttemptAt" = now(), "updatedAt" = now()
      WHERE "id" IN (
        SELECT "id" FROM "GulianOutbox"
        WHERE "status" = 'pending' AND "nextAttemptAt" <= now()
        ORDER BY "nextAttemptAt"
        LIMIT 10
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "eventId", "payloadJson", "attempts"
    `;

    for (const item of items) {
      await this.processItem(item);
    }
  }

  private async processItem(item: { id: string; eventId: string; payloadJson: unknown; attempts: number }): Promise<void> {
    try {
      const payload = item.payloadJson as GulianOrderPayload;
      const response = await this.gulian.upsertOrder(item.eventId, payload);

      const isPermanentIgnore =
        response.result === 'stale' || response.result === 'ignored' || response.result === 'duplicate';

      await this.prisma.gulianOutbox.update({
        where: { id: item.id },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          responseCode: 200,
          responseBody: JSON.stringify(response),
          updatedAt: new Date(),
        },
      });

      if (response.result === 'created' || response.result === 'updated') {
        const p = payload as any;
        await this.prisma.orderPhoto.updateMany({
          where: { numberOrder: p.externalOrderId },
          data: {
            gulianSyncStatus: 'synced',
            gulianLastSyncedAt: new Date(),
            gulianAppliedRevision: response.appliedRevision ?? null,
            gulianSettlementOrderId: response.settlementOrderId ?? null,
            gulianSettlementOrderNumber: response.settlementOrderNumber ?? null,
            gulianPositionId: response.positionId ?? null,
            gulianLastError: null,
          },
        });
      }

      if (isPermanentIgnore) {
        await this.prisma.orderPhoto.updateMany({
          where: { numberOrder: (payload as any).externalOrderId },
          data: { gulianSyncStatus: response.result, gulianLastSyncedAt: new Date() },
        });
      }

      this.logger.log(`Delivered Gulian event ${item.eventId}: ${response.result}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as any).code as number | undefined;
      const attempts = item.attempts + 1;
      const delayIdx = Math.min(attempts - 1, RETRY_DELAYS_SECONDS.length - 1);
      const delaySec = RETRY_DELAYS_SECONDS[delayIdx];
      const maxAttempts = 20;
      const isFinal = attempts >= maxAttempts;

      await this.prisma.gulianOutbox.update({
        where: { id: item.id },
        data: {
          status: isFinal ? 'failed' : 'pending',
          attempts,
          nextAttemptAt: new Date(Date.now() + delaySec * 1000),
          lastError: message,
          responseCode: code ?? null,
          updatedAt: new Date(),
        },
      });

      await this.prisma.orderPhoto.updateMany({
        where: { numberOrder: (item.payloadJson as any).externalOrderId },
        data: {
          gulianSyncStatus: isFinal ? 'failed' : 'pending',
          gulianLastAttemptAt: new Date(),
          gulianLastError: message,
        },
      });

      this.logger.warn(`Gulian event ${item.eventId} attempt ${attempts} failed: ${message}`);
    }
  }
}