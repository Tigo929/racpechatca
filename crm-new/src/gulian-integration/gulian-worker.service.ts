import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  EnumGulianOutboxStatus,
  EnumGulianSyncState,
} from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { GulianClient } from './gulian-client';
import { GulianOutboxService } from './gulian-outbox.service';
import type {
  GulianHttpResponse,
  GulianItemResult,
  GulianUpsertEvent,
} from './gulian.types';

const TERMINAL_RESULTS = new Set([
  'created',
  'updated',
  'duplicate',
  'unchanged',
  'stale',
]);
const RESPONSE_LIMIT = 32_000;

function retryDelayMinutes(attempts: number): number {
  const schedule = [1, 5, 15, 60, 360];
  return schedule[Math.min(Math.max(attempts - 1, 0), schedule.length - 1)];
}

function errorText(error: unknown): string {
  if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
    return 'Gulian CRM не ответил до истечения timeout.';
  }
  return error instanceof Error ? error.message : String(error);
}

function isRetryableHttp(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

@Injectable()
export class GulianWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GulianWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: GulianClient,
    private readonly outbox: GulianOutboxService,
  ) {}

  onModuleInit() {
    if (!this.client.enabled || process.env.NODE_ENV === 'test') return;
    this.startupTimer = setTimeout(() => void this.runOnce(), 1_000);
    this.startupTimer.unref?.();
    this.timer = setInterval(
      () => void this.runOnce(),
      this.client.scanIntervalSeconds * 1_000,
    );
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  async runOnce(): Promise<number> {
    if (!this.client.enabled || this.running) return 0;
    this.running = true;
    try {
      await this.recoverStuck();
      const events = await this.claimDueEvents();
      if (events.length === 0) return 0;
      const payloads = events.map(
        (event) => event.payloadJson as unknown as GulianUpsertEvent,
      );
      let response: GulianHttpResponse;
      try {
        response = await this.client.send(payloads);
      } catch (error) {
        const message = errorText(error);
        const permanent = /BASE_URL|SECRET/.test(message);
        await Promise.all(
          events.map((event) =>
            this.markFailure(event, message, permanent, null, null),
          ),
        );
        return events.length;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        const message = `Gulian HTTP ${response.statusCode}: ${
          response.rawBody.slice(0, 1_000) || 'без тела'
        }`;
        await Promise.all(
          events.map((event) =>
            this.markFailure(
              event,
              message,
              !isRetryableHttp(response.statusCode),
              response.statusCode,
              response.rawBody,
            ),
          ),
        );
        return events.length;
      }

      const results = this.extractResults(response, events.length);
      await Promise.all(
        events.map((event, index) =>
          this.applyItemResult(event, results[index], response),
        ),
      );
      return events.length;
    } finally {
      this.running = false;
    }
  }

  private async recoverStuck(): Promise<void> {
    const cutoff = new Date(
      Date.now() - Math.max(this.client.timeoutSeconds * 3, 60) * 1_000,
    );
    await this.prisma.gulianOutboxEvent.updateMany({
      where: {
        status: EnumGulianOutboxStatus.PROCESSING,
        lastAttemptAt: { lt: cutoff },
      },
      data: {
        status: EnumGulianOutboxStatus.FAILED,
        nextAttemptAt: new Date(),
        lastError: 'Предыдущая доставка прервалась; событие возвращено в очередь.',
      },
    });
  }

  private async claimDueEvents() {
    const now = new Date();
    const candidates = await this.prisma.gulianOutboxEvent.findMany({
      where: {
        OR: [
          {
            status: EnumGulianOutboxStatus.PENDING,
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
          },
          {
            status: EnumGulianOutboxStatus.FAILED,
            nextAttemptAt: { lte: now },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: this.client.bulkSize,
    });
    if (candidates.length === 0) return [];
    const ids = candidates.map((event) => event.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.gulianOutboxEvent.updateMany({
        where: {
          id: { in: ids },
          status: {
            in: [
              EnumGulianOutboxStatus.PENDING,
              EnumGulianOutboxStatus.FAILED,
            ],
          },
        },
        data: {
          status: EnumGulianOutboxStatus.PROCESSING,
          attempts: { increment: 1 },
          lastAttemptAt: now,
          nextAttemptAt: null,
        },
      });
      await tx.orderPhoto.updateMany({
        where: { id: { in: [...new Set(candidates.map((e) => e.aggregateId))] } },
        data: {
          gulianSyncState: EnumGulianSyncState.PROCESSING,
          gulianLastAttemptAt: now,
        },
      });
    });
    return this.prisma.gulianOutboxEvent.findMany({
      where: { id: { in: ids }, status: EnumGulianOutboxStatus.PROCESSING },
      orderBy: { createdAt: 'asc' },
    });
  }

  private extractResults(
    response: GulianHttpResponse,
    count: number,
  ): Array<GulianItemResult | null> {
    if (count === 1) {
      return [
        response.json && typeof response.json === 'object'
          ? (response.json as GulianItemResult)
          : null,
      ];
    }
    const body = response.json as { results?: GulianItemResult[] } | null;
    if (!Array.isArray(body?.results)) return Array(count).fill(null);
    const byIndex = new Map<number, GulianItemResult>();
    body.results.forEach((result, index) =>
      byIndex.set(Number.isInteger(result.index) ? result.index! : index, result),
    );
    return Array.from({ length: count }, (_, index) => byIndex.get(index) ?? null);
  }

  private async applyItemResult(
    event: Awaited<ReturnType<GulianWorkerService['claimDueEvents']>>[number],
    result: GulianItemResult | null,
    response: GulianHttpResponse,
  ): Promise<void> {
    if (!result?.result) {
      await this.markFailure(
        event,
        'Gulian вернул успешный HTTP без результата элемента.',
        false,
        response.statusCode,
        response.rawBody,
      );
      return;
    }
    if (TERMINAL_RESULTS.has(result.result)) {
      await this.markDelivered(event, result, response, false);
      return;
    }
    if (
      result.result === 'ignored' &&
      result.reason === 'settlement_already_paid'
    ) {
      await this.markDelivered(event, result, response, true);
      return;
    }
    await this.markFailure(
      event,
      `Gulian отклонил событие: ${result.reason ?? result.message ?? result.result}`,
      true,
      response.statusCode,
      response.rawBody,
    );
  }

  private async markDelivered(
    event: Awaited<ReturnType<GulianWorkerService['claimDueEvents']>>[number],
    result: GulianItemResult,
    response: GulianHttpResponse,
    rejectedPaid: boolean,
  ): Promise<void> {
    const now = new Date();
    const responseBody = response.rawBody.slice(0, RESPONSE_LIMIT);
    await this.prisma.$transaction(async (tx) => {
      await tx.gulianOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: EnumGulianOutboxStatus.DELIVERED,
          deliveredAt: now,
          nextAttemptAt: null,
          lastError: null,
          responseCode: response.statusCode,
          responseBody,
        },
      });
      await tx.orderPhoto.update({
        where: { id: event.aggregateId },
        data: {
          gulianSyncState: rejectedPaid
            ? EnumGulianSyncState.REJECTED_PAID
            : EnumGulianSyncState.DELIVERED,
          gulianLastSyncedAt: now,
          gulianLastError: rejectedPaid
            ? 'Расчётный заказ Gulian уже оплачен. Количество и финансовые данные не были изменены.'
            : null,
          gulianSettlementOrderNumber:
            result.settlement_order_number ?? undefined,
          gulianSettlementOrderId: result.settlement_order_id ?? undefined,
          gulianPositionId: result.position_id ?? undefined,
          gulianAppliedRevision:
            result.applied_revision ?? event.sourceRevision,
        },
      });
      await this.outbox.recordAudit(
        {
          orderId: event.aggregateId,
          action: rejectedPaid
            ? 'gulian_rejected_after_payment'
            : 'gulian_delivered',
          level: rejectedPaid ? 'warning' : 'info',
          message: rejectedPaid
            ? 'Gulian отклонил финансовое изменение после оплаты расчёта.'
            : `Gulian: ${result.result}, revision ${result.applied_revision ?? event.sourceRevision}.`,
          details: {
            eventId: event.eventId,
            result: result.result,
            reason: result.reason ?? null,
          },
        },
        tx,
      );
    });
  }

  private async markFailure(
    event: Awaited<ReturnType<GulianWorkerService['claimDueEvents']>>[number],
    message: string,
    permanent: boolean,
    responseCode: number | null,
    responseBody: string | null,
  ): Promise<void> {
    const exhausted = event.attempts >= this.client.maxAttempts;
    const terminal = permanent || exhausted;
    const delay = retryDelayMinutes(event.attempts);
    const nextAttemptAt = terminal
      ? null
      : new Date(Date.now() + delay * 60_000);
    await this.prisma.$transaction(async (tx) => {
      await tx.gulianOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: EnumGulianOutboxStatus.FAILED,
          nextAttemptAt,
          lastError: message,
          responseCode,
          responseBody: responseBody?.slice(0, RESPONSE_LIMIT) ?? null,
        },
      });
      await tx.orderPhoto.update({
        where: { id: event.aggregateId },
        data: {
          gulianSyncState: EnumGulianSyncState.ERROR,
          gulianLastError: message,
        },
      });
      await this.outbox.recordAudit(
        {
          orderId: event.aggregateId,
          action: terminal ? 'gulian_delivery_failed' : 'gulian_delivery_retry',
          level: 'error',
          message: terminal
            ? `${message} Повторы остановлены.`
            : `${message} Следующая попытка через ${delay} мин.`,
          details: {
            eventId: event.eventId,
            attempts: event.attempts,
            terminal,
            responseCode,
          },
        },
        tx,
      );
    });
    this.logger.warn(
      `Gulian event ${event.eventId}: ${message}${terminal ? ' (terminal)' : ''}`,
    );
  }
}