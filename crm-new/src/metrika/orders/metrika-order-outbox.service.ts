import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  transitionToMetrikaStatus,
  type MetrikaOrderStatus,
} from './metrika-order-status';

/**
 * Постановка заказов в очередь на отправку в Метрику (этап 06, разделы 28–32).
 *
 * Вызывается ИЗНУТРИ транзакции, которая меняет статус заказа и пишет
 * StatusHistory: строка очереди либо фиксируется вместе с ними, либо
 * откатывается вместе с ними. Метрика на этом пути не участвует — её
 * недоступность смену статуса не задерживает и не ломает.
 *
 * Ставим в очередь только переходы, меняющие бизнес-смысл (см.
 * transitionToMetrikaStatus): заявка стала заказом, заказ оплачен, отменён,
 * возвращён в работу. Внутренние шаги производства очередь не трогают.
 *
 * Дедупликация — по StatusHistory.id: один переход = одна строка. Повторный
 * вызов для того же перехода упирается в уникальный ключ и молча
 * пропускается — очередь не разрастается, сколько бы раз ни обработали
 * одно и то же событие.
 */

/** Клиент Prisma или транзакция — у обоих есть metrikaOrderOutbox. */
export type OutboxDb = Pick<PrismaService, 'metrikaOrderOutbox'>;

export interface StatusTransition {
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  /** Id строки StatusHistory этого перехода — ключ дедупликации. */
  statusHistoryId: string;
}

export interface OutboxCounters {
  pending: number;
  processing: number;
  delivered: number;
  failed: number;
  skipped: number;
  skippedNoClientId: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class MetrikaOrderOutboxService {
  private readonly logger = new Logger(MetrikaOrderOutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ставит переход в очередь, если он меняет статус заказа для Метрики.
   * Возвращает поставленный статус или null, если ставить нечего.
   * Ошибки базы (кроме дубля) пробрасываются: они откатят и транзакцию
   * статуса — так и должно быть, очередь и статус живут или умирают вместе.
   */
  async enqueueTransition(
    db: OutboxDb,
    transition: StatusTransition,
  ): Promise<MetrikaOrderStatus | null> {
    const target = transitionToMetrikaStatus(transition.fromStatus, transition.toStatus);
    if (target === null) return null;

    try {
      await db.metrikaOrderOutbox.create({
        data: {
          id: randomUUID(),
          orderId: transition.orderId,
          dedupeKey: `history:${transition.statusHistoryId}`,
          sourceStatusHistoryId: transition.statusHistoryId,
          targetMetrikaStatus: target,
          status: 'pending',
          nextAttemptAt: new Date(),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.debug(
          `Метрика: переход ${transition.statusHistoryId} уже в очереди — пропуск`,
        );
        return null;
      }
      throw error;
    }

    this.logger.log(
      `Метрика: заказ ${transition.orderId} в очередь как ${target} (${transition.fromStatus ?? '—'} → ${transition.toStatus})`,
    );
    return target;
  }

  /**
   * Ручная постановка: контрольная отправка одного заказа (этап 06, фаза 2)
   * или повторная синхронизация по команде. Статус берётся текущий.
   */
  async enqueueManual(
    orderId: string,
    target: MetrikaOrderStatus,
    note = 'manual',
  ): Promise<{ id: string }> {
    const id = randomUUID();
    await this.prisma.metrikaOrderOutbox.create({
      data: {
        id,
        orderId,
        dedupeKey: `${note}:${id}`,
        targetMetrikaStatus: target,
        status: 'pending',
        nextAttemptAt: new Date(),
      },
    });
    return { id };
  }

  /** Вернуть неудачные строки в очередь: все или по одному заказу. */
  async requeueFailed(orderId?: string): Promise<number> {
    const result = await this.prisma.metrikaOrderOutbox.updateMany({
      where: { status: 'failed', ...(orderId ? { orderId } : {}) },
      data: {
        status: 'pending',
        nextAttemptAt: new Date(),
        lastError: null,
        lockedAt: null,
      },
    });
    return result.count;
  }

  async getForOrder(orderId: string, take = 20) {
    return this.prisma.metrikaOrderOutbox.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Счётчики для диагностики (этап 06, раздел 63). */
  async counters(): Promise<OutboxCounters> {
    const grouped = await this.prisma.metrikaOrderOutbox.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const count = (status: string): number =>
      grouped.find((g) => g.status === status)?._count._all ?? 0;
    const [skippedNoClientId, lastSuccess, lastFailure] = await Promise.all([
      this.prisma.metrikaOrderOutbox.count({
        where: { status: 'skipped', skipReason: 'no_client_id' },
      }),
      this.prisma.metrikaOrderOutbox.findFirst({
        where: { status: 'delivered' },
        orderBy: { processedAt: 'desc' },
        select: { processedAt: true },
      }),
      this.prisma.metrikaOrderOutbox.findFirst({
        where: { status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
    ]);
    return {
      pending: count('pending'),
      processing: count('processing'),
      delivered: count('delivered'),
      failed: count('failed'),
      skipped: count('skipped'),
      skippedNoClientId,
      lastSuccessAt: lastSuccess?.processedAt ?? null,
      lastFailureAt: lastFailure?.updatedAt ?? null,
    };
  }
}
