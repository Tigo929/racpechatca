import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MarketplaceAccountService } from '../marketplace-account.service';
import { OzonApiError } from './ozon-api.client';
import { OzonStockService } from './ozon-stock.service';
import { OzonWarehouseService } from './ozon-warehouse.service';
import {
  buildPairs,
  BulkStockValidationError,
  MIN_PAIR_INTERVAL_MS,
  needsStrongConfirm,
  normalizeOfferIds,
  normalizeWarehouses,
  zeroingCount,
  type BulkStockMode,
  type StockPair,
  type WarehouseQuantity,
} from './ozon-bulk-stock-rules';

/**
 * Массовое изменение остатков Ozon.
 *
 * Устройство простое и продиктовано площадкой: считаем пары «товар ×
 * склад», кладём их в базу строками, а отправляет их фоновый обработчик
 * по одной пачке за такт. Синхронно отправлять нельзя не из-за объёма —
 * у кабинета три склада и сотня товаров, — а из-за правила Ozon «одну
 * пару не чаще раза в тридцать секунд»: повтор ошибок иначе гарантированно
 * получал бы отказ второй раз подряд.
 */

/** Сколько раз пробуем пару, прежде чем признать её неудачной. */
const MAX_ATTEMPTS = 3;
/** Как часто обработчик просыпается. */
const TICK_MS = 3_000;
/** Сколько пар берём за один такт: два запроса к Ozon, не больше. */
const ITEMS_PER_TICK = 200;

export interface BulkStockInput {
  mode: BulkStockMode;
  offerIds: string[];
  warehouses: WarehouseQuantity[];
}

export interface BulkStockPreview {
  productCount: number;
  warehouseCount: number;
  operationCount: number;
  /** Сколько пар обнуляет остаток — о них предупреждаем отдельно. */
  zeroingCount: number;
  /** Требуется ли ввод слова подтверждения. */
  strongConfirm: boolean;
  /** Первые пары для показа «что именно изменится». */
  sample: {
    offerId: string;
    warehouseId: number;
    warehouseName: string;
    quantity: number;
  }[];
}

@Injectable()
export class OzonBulkStockService {
  private readonly logger = new Logger(OzonBulkStockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: MarketplaceAccountService,
    private readonly stocks: OzonStockService,
    private readonly warehouses: OzonWarehouseService,
  ) {}

  /**
   * Что произойдёт, если подтвердить. Ничего не меняет и никуда не ходит:
   * проверка входа плюс арифметика по парам.
   */
  async preview(
    accountId: string,
    input: BulkStockInput,
  ): Promise<BulkStockPreview> {
    const { pairs, names } = await this.plan(accountId, input);

    return {
      productCount: new Set(pairs.map((p) => p.offerId)).size,
      warehouseCount: new Set(pairs.map((p) => p.warehouseId)).size,
      operationCount: pairs.length,
      zeroingCount: zeroingCount(pairs),
      strongConfirm: needsStrongConfirm(pairs.length),
      sample: pairs.slice(0, 20).map((pair) => ({
        offerId: pair.offerId,
        warehouseId: pair.warehouseId,
        warehouseName: names.get(pair.warehouseId) ?? `Склад ${pair.warehouseId}`,
        quantity: pair.quantity,
      })),
    };
  }

  /**
   * Создаёт операцию и уходит. Отправкой занимается обработчик — поэтому
   * закрытая вкладка ничего не отменяет, а повторное нажатие кнопки
   * упирается в уникальный ключ пары внутри операции.
   */
  async start(
    accountId: string,
    userId: string | null,
    input: BulkStockInput,
  ): Promise<{ operationId: string; operationCount: number }> {
    const { pairs, names } = await this.plan(accountId, input);

    // Режим «Добавить» пока не выпущен: атомарного increment у Ozon нет,
    // а считать «текущий плюс дельта» без остатков по складам — значит
    // выдумывать число. Явный отказ лучше молчаливо неверного остатка.
    if (input.mode === 'ADD') {
      throw new BulkStockValidationError(
        'Режим «Добавить» пока недоступен: Ozon не умеет прибавлять к остатку, ' +
          'а считать это у себя можно только зная остаток по каждому складу. ' +
          'Пользуйтесь режимом «Установить».',
      );
    }

    const uniform = new Set(input.warehouses.map((w) => w.quantity));

    const operation = await this.prisma.ozonStockBulkOperation.create({
      data: {
        marketplaceAccountId: accountId,
        mode: input.mode,
        status: 'PENDING',
        defaultQuantity: uniform.size === 1 ? [...uniform][0] : null,
        productCount: new Set(pairs.map((p) => p.offerId)).size,
        warehouseCount: new Set(pairs.map((p) => p.warehouseId)).size,
        operationCount: pairs.length,
        createdById: userId,
        items: {
          create: pairs.map((pair) => ({
            offerId: pair.offerId,
            warehouseId: BigInt(pair.warehouseId),
            warehouseName:
              names.get(pair.warehouseId) ?? `Склад ${pair.warehouseId}`,
            requestedQuantity: pair.quantity,
            // У «Установить» отправляем ровно то, что ввёл человек.
            calculatedStock: pair.quantity,
          })),
        },
      },
      select: { id: true, operationCount: true },
    });

    this.logger.log(
      `Операция ${operation.id}: ${operation.operationCount} пар «товар × склад»`,
    );
    return {
      operationId: operation.id,
      operationCount: operation.operationCount,
    };
  }

  /** Состояние операции: прогресс и разбор по парам. */
  async status(accountId: string, operationId: string) {
    const operation = await this.prisma.ozonStockBulkOperation.findFirst({
      where: { id: operationId, marketplaceAccountId: accountId },
      include: {
        createdBy: { select: { username: true } },
        items: {
          orderBy: [{ offerId: 'asc' }, { warehouseName: 'asc' }],
          take: 1000,
        },
      },
    });
    if (!operation) throw new NotFoundException('Операция не найдена');

    return {
      id: operation.id,
      mode: operation.mode,
      status: operation.status,
      defaultQuantity: operation.defaultQuantity,
      productCount: operation.productCount,
      warehouseCount: operation.warehouseCount,
      operationCount: operation.operationCount,
      successCount: operation.successCount,
      errorCount: operation.errorCount,
      createdAt: operation.createdAt.toISOString(),
      completedAt: operation.completedAt?.toISOString() ?? null,
      author: operation.createdBy?.username ?? null,
      lastError: operation.lastError,
      items: operation.items.map((item) => ({
        offerId: item.offerId,
        warehouseName: item.warehouseName,
        requestedQuantity: item.requestedQuantity,
        status: item.status,
        errorMessage: item.errorMessage,
      })),
    };
  }

  /**
   * Повтор только неудачных пар. Успешные не трогаем — переотправка
   * означала бы второй запрос по той же паре и отказ по правилу Ozon.
   */
  async retryErrors(
    accountId: string,
    operationId: string,
  ): Promise<{ retrying: number }> {
    const operation = await this.prisma.ozonStockBulkOperation.findFirst({
      where: { id: operationId, marketplaceAccountId: accountId },
      select: { id: true },
    });
    if (!operation) throw new NotFoundException('Операция не найдена');

    const { count } = await this.prisma.ozonStockBulkOperationItem.updateMany({
      where: { operationId, status: 'ERROR' },
      // Счётчик попыток обнуляем: это новое решение человека, а не
      // продолжение прежней автоматической серии.
      data: { status: 'PENDING', attempts: 0, errorCode: null, errorMessage: null },
    });

    if (count > 0) {
      await this.prisma.ozonStockBulkOperation.update({
        where: { id: operationId },
        data: { status: 'PENDING', errorCount: 0, completedAt: null },
      });
    }
    return { retrying: count };
  }

  /** История операций кабинета. */
  async history(accountId: string, limit = 50) {
    const rows = await this.prisma.ozonStockBulkOperation.findMany({
      where: { marketplaceAccountId: accountId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: { createdBy: { select: { username: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      mode: row.mode,
      status: row.status,
      defaultQuantity: row.defaultQuantity,
      productCount: row.productCount,
      warehouseCount: row.warehouseCount,
      operationCount: row.operationCount,
      successCount: row.successCount,
      errorCount: row.errorCount,
      author: row.createdBy?.username ?? null,
    }));
  }

  /**
   * Общая часть превью и запуска: проверка входа и раскладка на пары.
   *
   * Проверяется здесь, а не в DTO, потому что список разрешённых складов
   * известен только серверу: выбор приходит из браузера, и там может
   * оказаться выключенный склад или чужой (ТЗ §22).
   */
  private async plan(
    accountId: string,
    input: BulkStockInput,
  ): Promise<{ pairs: StockPair[]; names: Map<number, string> }> {
    const offerIds = normalizeOfferIds(input.offerIds);
    const allowed = await this.warehouses.editableIds(accountId);
    const warehouses = normalizeWarehouses(input.warehouses, allowed);

    const rows = await this.prisma.ozonWarehouse.findMany({
      where: { marketplaceAccountId: accountId },
      select: { warehouseId: true, name: true },
    });
    const names = new Map(rows.map((row) => [Number(row.warehouseId), row.name]));

    return { pairs: buildPairs(offerIds, warehouses), names };
  }

  // ─────────────────────────────────────────────── фоновая отправка

  /**
   * Один такт обработчика: берёт готовые к отправке пары и шлёт их.
   *
   * «Готовые» — это пары в ожидании, которых либо ещё не касались, либо
   * касались больше тридцати секунд назад. Второе условие и есть правило
   * площадки; без него повтор ошибок упирался бы в него сам, но узнавал
   * бы об этом уже из отказа.
   */
  async tick(now = new Date()): Promise<void> {
    const operation = await this.prisma.ozonStockBulkOperation.findFirst({
      where: { status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, marketplaceAccountId: true, status: true },
    });
    if (!operation) return;

    const due = await this.prisma.ozonStockBulkOperationItem.findMany({
      where: {
        operationId: operation.id,
        status: 'PENDING',
        OR: [
          { lastSentAt: null },
          { lastSentAt: { lte: new Date(now.getTime() - MIN_PAIR_INTERVAL_MS) } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: ITEMS_PER_TICK,
    });

    if (due.length === 0) {
      await this.closeIfFinished(operation.id);
      return;
    }

    if (operation.status === 'PENDING') {
      await this.prisma.ozonStockBulkOperation.update({
        where: { id: operation.id },
        data: { status: 'RUNNING', startedAt: now },
      });
    }

    const creds = await this.accounts.credentials(operation.marketplaceAccountId);
    const pairs: StockPair[] = due.map((item) => ({
      offerId: item.offerId,
      warehouseId: Number(item.warehouseId),
      quantity: item.calculatedStock ?? item.requestedQuantity,
    }));

    // Отметку об отправке ставим до запроса: если он не вернётся вовсе,
    // пара всё равно была тронута, и повтор обязан выждать своё окно.
    await this.prisma.ozonStockBulkOperationItem.updateMany({
      where: { id: { in: due.map((i) => i.id) } },
      data: { lastSentAt: now, attempts: { increment: 1 } },
    });

    try {
      const results = await this.stocks.updateStocks(creds, pairs);
      const byKey = new Map(
        results.map((r) => [`${r.offerId}@${r.warehouseId}`, r]),
      );

      for (const item of due) {
        const key = `${item.offerId}@${Number(item.warehouseId)}`;
        const result = byKey.get(key);
        if (result?.updated) {
          await this.prisma.ozonStockBulkOperationItem.update({
            where: { id: item.id },
            data: { status: 'SENT', errorCode: null, errorMessage: null },
          });
          continue;
        }
        // Отказ по товару или складу — деловой, повторять его бессмысленно
        // (ТЗ §14). В ошибки он уходит сразу, а решение о повторе принимает
        // человек кнопкой «повторить только ошибки».
        await this.prisma.ozonStockBulkOperationItem.update({
          where: { id: item.id },
          data: {
            status: 'ERROR',
            errorCode: result?.errorCode ?? 'NO_RESULT',
            errorMessage: result?.errorMessage ?? 'Ozon не ответил по этой паре.',
          },
        });
      }
    } catch (e) {
      await this.handleTransport(operation.id, due, e);
    }

    await this.refreshCounters(operation.id);
    await this.closeIfFinished(operation.id);
  }

  /**
   * Сбой запроса целиком: сеть, таймаут, 429, пятисотая.
   *
   * Такие ошибки временные, и пары остаются в ожидании — их подберёт
   * следующий такт, но не раньше чем через тридцать секунд, потому что
   * отметка об отправке уже стоит. Ограниченное число попыток нужно, чтобы
   * безнадёжная пара не крутилась вечно.
   */
  private async handleTransport(
    operationId: string,
    due: { id: string; attempts: number }[],
    error: unknown,
  ): Promise<void> {
    const message =
      error instanceof OzonApiError
        ? error.humanMessage
        : 'Не удалось отправить остатки в Ozon.';
    this.logger.warn(`Операция ${operationId}: ${message}`);

    const exhausted = due.filter((item) => item.attempts + 1 >= MAX_ATTEMPTS);
    if (exhausted.length > 0) {
      await this.prisma.ozonStockBulkOperationItem.updateMany({
        where: { id: { in: exhausted.map((i) => i.id) } },
        data: { status: 'ERROR', errorCode: 'TRANSPORT', errorMessage: message },
      });
    }

    await this.prisma.ozonStockBulkOperation.update({
      where: { id: operationId },
      data: { lastError: message },
    });
  }

  private async refreshCounters(operationId: string): Promise<void> {
    const [successCount, errorCount] = await Promise.all([
      this.prisma.ozonStockBulkOperationItem.count({
        where: { operationId, status: 'SENT' },
      }),
      this.prisma.ozonStockBulkOperationItem.count({
        where: { operationId, status: 'ERROR' },
      }),
    ]);
    await this.prisma.ozonStockBulkOperation.update({
      where: { id: operationId },
      data: { successCount, errorCount },
    });
  }

  /** Операция закрывается, когда по всем её парам есть решение. */
  private async closeIfFinished(operationId: string): Promise<void> {
    const left = await this.prisma.ozonStockBulkOperationItem.count({
      where: { operationId, status: 'PENDING' },
    });
    if (left > 0) return;

    const errors = await this.prisma.ozonStockBulkOperationItem.count({
      where: { operationId, status: 'ERROR' },
    });
    await this.prisma.ozonStockBulkOperation.update({
      where: { id: operationId },
      data: {
        status: errors > 0 ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }
}
