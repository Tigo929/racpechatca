import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  OzonApiClient,
  OzonApiError,
  type OzonCredentials,
} from './ozon-api.client';
import {
  isStale,
  sortForPicker,
  toWarehouseStates,
  type RawWarehouse,
} from './ozon-warehouse-rules';

/**
 * Склады кабинета: хранение, синхронизация и выдача в интерфейс.
 *
 * До этого список складов брался прямо у площадки на каждое открытие окна,
 * причём заодно с лишним запросом списка товаров: за складами ходили через
 * проверку подключения. Для массового изменения остатков этого мало —
 * нужен признак «сюда писать можно», отметка времени и постоянная ссылка,
 * на которую сможет ссылаться история операций.
 */

interface WarehouseListResponse {
  /** С /v2 список лежит в `warehouses`, а не в `result` — проверено 17.08.2026. */
  warehouses?: RawWarehouse[];
}

/** Склад для интерфейса. `warehouseId` наружу не показываем, но передаём:
 * без него нельзя отправить остаток обратно. */
export interface WarehouseView {
  id: number;
  name: string;
  status: string | null;
  isEditable: boolean;
  disabledReason: string | null;
}

export interface WarehouseListView {
  warehouses: WarehouseView[];
  /** Когда список последний раз подтверждён площадкой. */
  syncedAt: string | null;
  /** Ozon отказал в списке складов — показываем прежний снимок и говорим почему. */
  syncError: string | null;
}

@Injectable()
export class OzonWarehouseService {
  private readonly logger = new Logger(OzonWarehouseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: OzonApiClient,
  ) {}

  /**
   * Список для окна выбора. Снимок устарел — молча обновляем; площадка
   * не ответила — отдаём прежний снимок с пометкой об ошибке.
   *
   * Пустой список тоже кэшируется: у продавца без схемы FBS складов нет
   * вовсе, и ходить за ними на каждое открытие окна незачем.
   */
  async list(
    accountId: string,
    creds: OzonCredentials,
    now = new Date(),
  ): Promise<WarehouseListView> {
    const last = await this.lastSyncAt(accountId);
    let syncError: string | null = null;

    if (isStale(last, now)) {
      syncError = await this.syncQuietly(accountId, creds, now);
    }

    return this.read(accountId, syncError);
  }

  /** Обновление по кнопке: идём к площадке всегда, ошибку не прячем. */
  async sync(
    accountId: string,
    creds: OzonCredentials,
    now = new Date(),
  ): Promise<WarehouseListView> {
    const syncError = await this.syncQuietly(accountId, creds, now);
    return this.read(accountId, syncError);
  }

  /**
   * Идентификаторы складов, на которые разрешено писать.
   *
   * Нужен на входе массовой операции: выбор приходит из браузера, а значит
   * его нельзя принимать на веру — там может оказаться и выключенный склад,
   * и чужой (ТЗ §22).
   */
  async editableIds(accountId: string): Promise<Set<number>> {
    const rows = await this.prisma.ozonWarehouse.findMany({
      where: { marketplaceAccountId: accountId, archivedAt: null, isEditable: true },
      select: { warehouseId: true },
    });
    return new Set(rows.map((row) => Number(row.warehouseId)));
  }

  private async lastSyncAt(accountId: string): Promise<Date | null> {
    const row = await this.prisma.ozonWarehouse.findFirst({
      where: { marketplaceAccountId: accountId },
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    });
    return row?.syncedAt ?? null;
  }

  private async read(
    accountId: string,
    syncError: string | null,
  ): Promise<WarehouseListView> {
    const rows = await this.prisma.ozonWarehouse.findMany({
      where: { marketplaceAccountId: accountId, archivedAt: null },
      select: {
        warehouseId: true,
        name: true,
        status: true,
        isEditable: true,
        disabledReason: true,
        syncedAt: true,
      },
    });

    const warehouses = sortForPicker(
      rows.map((row) => ({
        // BigInt в JSON не сериализуется, а идентификаторы Ozon —
        // шестнадцатизначные, то есть заведомо укладываются в безопасное
        // целое JavaScript. Перевод здесь, на границе наружу.
        id: Number(row.warehouseId),
        name: row.name,
        status: row.status,
        isEditable: row.isEditable,
        disabledReason: row.disabledReason,
      })),
    );

    const syncedAt = rows.reduce<Date | null>(
      (max, row) => (!max || row.syncedAt > max ? row.syncedAt : max),
      null,
    );

    return {
      warehouses,
      syncedAt: syncedAt?.toISOString() ?? null,
      syncError,
    };
  }

  /**
   * Тянет список и переписывает снимок. Возвращает текст ошибки вместо
   * броска: у ключа может не быть доступа к складам (у продавца без FBS
   * их нет вовсе), и ронять из-за этого окно нельзя — прежний снимок
   * всё ещё полезнее пустого экрана.
   */
  private async syncQuietly(
    accountId: string,
    creds: OzonCredentials,
    now: Date,
  ): Promise<string | null> {
    let raw: RawWarehouse[];
    try {
      const res = await this.api.post<WarehouseListResponse>(
        creds,
        '/v2/warehouse/list',
      );
      raw = res.warehouses ?? [];
    } catch (e) {
      const message =
        e instanceof OzonApiError
          ? e.humanMessage
          : 'Не удалось получить список складов Ozon.';
      this.logger.warn(`Склады кабинета ${accountId}: ${message}`);
      return message;
    }

    const states = toWarehouseStates(raw);

    // Пустой ответ не считаем поводом стереть склады: чаще это временный
    // отказ площадки, чем реальное отсутствие складов, а без них массовое
    // изменение остатков перестаёт работать целиком.
    if (states.length === 0) {
      const existing = await this.prisma.ozonWarehouse.count({
        where: { marketplaceAccountId: accountId, archivedAt: null },
      });
      if (existing > 0) {
        this.logger.warn(
          `Склады кабинета ${accountId}: Ozon вернул пустой список — снимок оставлен прежним`,
        );
        return 'Ozon вернул пустой список складов. Показан прежний список.';
      }
    }

    const alive = states.map((state) => state.warehouseId);

    await this.prisma.$transaction([
      ...states.map((state) =>
        this.prisma.ozonWarehouse.upsert({
          where: {
            marketplaceAccountId_warehouseId: {
              marketplaceAccountId: accountId,
              warehouseId: BigInt(state.warehouseId),
            },
          },
          create: {
            marketplaceAccountId: accountId,
            warehouseId: BigInt(state.warehouseId),
            name: state.name,
            status: state.status,
            isEditable: state.isEditable,
            disabledReason: state.disabledReason,
            syncedAt: now,
          },
          update: {
            name: state.name,
            status: state.status,
            isEditable: state.isEditable,
            disabledReason: state.disabledReason,
            // Склад мог пропасть и вернуться: снимаем отметку об удалении.
            archivedAt: null,
            syncedAt: now,
          },
        }),
      ),
      // Пропавшие из ответа помечаем удалёнными, но не стираем: на них
      // ссылается история операций с остатками.
      this.prisma.ozonWarehouse.updateMany({
        where: {
          marketplaceAccountId: accountId,
          archivedAt: null,
          warehouseId: { notIn: alive.map((id) => BigInt(id)) },
        },
        data: { archivedAt: now },
      }),
    ]);

    return null;
  }
}
