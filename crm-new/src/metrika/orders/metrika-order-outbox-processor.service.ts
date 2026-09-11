import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { costSettingsFrom } from 'src/reports/order-cogs';
import { MetrikaApiError, YandexMetrikaClient } from '../metrika-api.client';
import {
  buildSimpleOrdersCsv,
  isValidTimeZone,
} from './metrika-order-csv';
import { buildOrderSnapshot, maskClientId } from './metrika-order-payload';

/**
 * Воркер очереди заказов в Метрику (этап 06, разделы 33–37).
 *
 * Раз в 30 секунд забирает созревшие строки (`FOR UPDATE SKIP LOCKED` —
 * два экземпляра CRM одну строку не возьмут), по каждой строит текущий
 * снимок заказа и отправляет его отдельным файлом: один заказ — одна
 * загрузка. Объём CRM — единицы заказов в день, и так проще всё: повтор,
 * отладку, сопоставление uploading_id с заказом.
 *
 * Паузы между попытками — те же, что у GulianOutbox: минута, пять,
 * пятнадцать, час, шесть часов; после двадцатой попытки строка становится
 * failed. Повторяем только то, что может пройти со второго раза: 429,
 * 5xx, сеть, таймаут. 400 (плохой файл), 401/403 (токен, права) и
 * «валидация не пройдена» повторять бессмысленно — строка сразу failed,
 * но не удаляется: когда владелец починит токен, её вернёт requeue.
 *
 * Включение — отдельный рубильник YANDEX_METRIKA_ORDERS_SYNC_ENABLED.
 * Пока он выключен, очередь наполняется, но наружу ничего не уходит:
 * так первый заказ в Метрику отправится контролируемо, по команде, а не
 * в момент выкладки.
 */

const RETRY_DELAYS_SECONDS = [60, 300, 900, 3600, 21600];
const MAX_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 30_000;
const CLAIM_LIMIT = 10;
/** Без конфигурации повторяем редко: ждём, пока появится токен. */
const NOT_CONFIGURED_DELAY_SECONDS = 3600;

export interface ProcessorOptions {
  /** YANDEX_METRIKA_ORDERS_SYNC_ENABLED — отправлять ли по расписанию. */
  syncEnabled: boolean;
}

export type ClaimedRow = {
  id: string;
  orderId: string;
  targetMetrikaStatus: string;
  attemptCount: number;
};

export type ProcessOutcome =
  | { result: 'delivered'; status: string; uploadingId: string; elementsCount: number | null; durationMs: number }
  | { result: 'skipped'; reason: string }
  | { result: 'failed'; error: string; permanent: boolean }
  | { result: 'retry'; error: string; nextAttemptAt: Date };

@Injectable()
export class MetrikaOrderOutboxProcessorService implements OnModuleInit {
  private readonly logger = new Logger(MetrikaOrderOutboxProcessorService.name);
  private running = false;
  private timeZoneCache: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: YandexMetrikaClient,
    private readonly options: ProcessorOptions,
  ) {}

  onModuleInit() {
    if (!this.options.syncEnabled) {
      this.logger.log(
        'Метрика: отправка заказов выключена (YANDEX_METRIKA_ORDERS_SYNC_ENABLED) — очередь копится, наружу не уходит',
      );
      return;
    }
    if (!this.client.isConfigured()) {
      this.logger.warn(
        'Метрика: отправка заказов включена, но клиент не настроен (нет счётчика или токена) — воркер не запущен',
      );
      return;
    }
    setInterval(() => void this.process(), POLL_INTERVAL_MS);
    setTimeout(() => void this.process(), 5_000);
    this.logger.log('Метрика: воркер отправки заказов запущен');
  }

  async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processOnce();
    } catch (error) {
      this.logger.error('Метрика: ошибка воркера очереди', error as Error);
    } finally {
      this.running = false;
    }
  }

  /** Забрать созревшие строки и обработать по одной. */
  async processOnce(limit = CLAIM_LIMIT): Promise<ProcessOutcome[]> {
    const rows = await this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE "MetrikaOrderOutbox"
      SET "status" = 'processing', "lockedAt" = now(), "updatedAt" = now()
      WHERE "id" IN (
        SELECT "id" FROM "MetrikaOrderOutbox"
        WHERE "status" = 'pending' AND "nextAttemptAt" <= now()
        ORDER BY "nextAttemptAt", "createdAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "orderId", "targetMetrikaStatus", "attemptCount"
    `;
    const outcomes: ProcessOutcome[] = [];
    for (const row of rows) outcomes.push(await this.processRow(row));
    return outcomes;
  }

  /**
   * Обработать конкретную строку вне расписания (контрольная отправка из CLI).
   * Строка должна быть pending; захватывается тем же способом.
   */
  async processById(id: string): Promise<ProcessOutcome | null> {
    const rows = await this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE "MetrikaOrderOutbox"
      SET "status" = 'processing', "lockedAt" = now(), "updatedAt" = now()
      WHERE "id" = ${id} AND "status" = 'pending'
      RETURNING "id", "orderId", "targetMetrikaStatus", "attemptCount"
    `;
    if (rows.length === 0) return null;
    return this.processRow(rows[0]);
  }

  /**
   * Часовой пояс счётчика — из его метаданных, один раз на процесс.
   * Не предполагаем Москву: если пояс не прочитался, отправка ждёт.
   */
  async counterTimeZone(): Promise<string> {
    if (this.timeZoneCache) return this.timeZoneCache;
    const counter = await this.client.getCounter();
    const name = (counter.time_zone_name ?? '').trim();
    if (!name || !isValidTimeZone(name)) {
      throw new MetrikaApiError(
        'http',
        0,
        `Счётчик не сообщил пригодный часовой пояс (time_zone_name=«${name || '—'}»).`,
      );
    }
    this.timeZoneCache = name;
    return name;
  }

  private async processRow(row: ClaimedRow): Promise<ProcessOutcome> {
    const attempt = row.attemptCount + 1;
    const startedAt = Date.now();
    try {
      const timeZone = await this.counterTimeZone();
      const [order, settingsRow, deliveredBefore] = await Promise.all([
        this.prisma.orderPhoto.findUnique({
          where: { id: row.orderId },
          select: {
            id: true,
            createdAt: true,
            status: true,
            yandexClientId: true,
            totalOrder: true,
            productCategory: true,
            items: {
              select: {
                formatPaper: true,
                quantity: true,
                pricePosition: true,
                printOnClientItem: true,
                thermalCost: true,
              },
            },
            tshirtItems: {
              select: {
                pricePosition: true,
                quantity: true,
                designCost: true,
                thermalCost: true,
                blankCost: true,
                clientItem: true,
              },
            },
            canvasItems: { select: { contractorCostPosition: true } },
            statusHistory: { select: { fromStatus: true, toStatus: true } },
          },
        }),
        this.prisma.partnerSettings.findUnique({ where: { id: 'default' } }),
        this.prisma.metrikaOrderOutbox.count({
          where: { orderId: row.orderId, status: 'delivered' },
        }),
      ]);

      if (!order) {
        return this.finishFailed(row, attempt, 'Заказ не найден', true);
      }

      const snapshot = buildOrderSnapshot(
        order,
        costSettingsFrom(settingsRow),
        timeZone,
        deliveredBefore > 0,
      );

      if (snapshot.kind === 'skip') {
        await this.prisma.metrikaOrderOutbox.update({
          where: { id: row.id },
          data: {
            status: 'skipped',
            skipReason: snapshot.reason,
            attemptCount: attempt,
            processedAt: new Date(),
            lockedAt: null,
          },
        });
        this.logger.log(
          `Метрика: заказ ${row.orderId} пропущен (${snapshot.reason}), попытка ${attempt}`,
        );
        return { result: 'skipped', reason: snapshot.reason };
      }

      const csv = buildSimpleOrdersCsv([snapshot.row]);
      const uploading = await this.client.uploadSimpleOrders(csv, 'SAVE');
      const durationMs = Date.now() - startedAt;
      const validation = uploading.api_validation_status ?? 'UNKNOWN';

      if (validation !== 'PASSED') {
        await this.prisma.metrikaOrderOutbox.update({
          where: { id: row.id },
          data: {
            status: 'failed',
            attemptCount: attempt,
            lastError: `api_validation_status=${validation}`,
            responseCode: 200,
            remoteUploadingId: uploading.uploading_id ?? null,
            apiValidationStatus: validation,
            elementsCount: uploading.elements_count ?? null,
            sentMetrikaStatus: snapshot.status,
            lockedAt: null,
          },
        });
        this.logger.warn(
          `Метрика: заказ ${row.orderId} ${snapshot.status} — файл отклонён (${validation}), uploading=${uploading.uploading_id}, попытка ${attempt}, ${durationMs} мс`,
        );
        return { result: 'failed', error: `api_validation_status=${validation}`, permanent: true };
      }

      await this.prisma.metrikaOrderOutbox.update({
        where: { id: row.id },
        data: {
          status: 'delivered',
          attemptCount: attempt,
          processedAt: new Date(),
          lastError: null,
          responseCode: 200,
          remoteUploadingId: uploading.uploading_id ?? null,
          apiValidationStatus: validation,
          elementsCount: uploading.elements_count ?? null,
          sentMetrikaStatus: snapshot.status,
          lockedAt: null,
        },
      });
      this.logger.log(
        `Метрика: заказ ${row.orderId} → ${snapshot.status}, ClientID ${maskClientId(snapshot.row.clientId)}, попытка ${attempt}, HTTP 200, ${durationMs} мс, uploading=${uploading.uploading_id}${
          snapshot.costReliable ? '' : ', себестоимость не передана'
        }`,
      );
      return {
        result: 'delivered',
        status: snapshot.status,
        uploadingId: uploading.uploading_id,
        elementsCount: uploading.elements_count ?? null,
        durationMs,
      };
    } catch (error) {
      return this.handleFailure(row, attempt, error);
    }
  }

  private async handleFailure(
    row: ClaimedRow,
    attempt: number,
    error: unknown,
  ): Promise<ProcessOutcome> {
    const message = error instanceof Error ? error.message : String(error);
    const api = error instanceof MetrikaApiError ? error : null;
    const status = api?.status ?? null;

    if (api?.kind === 'not_configured') {
      const nextAttemptAt = new Date(Date.now() + NOT_CONFIGURED_DELAY_SECONDS * 1000);
      await this.prisma.metrikaOrderOutbox.update({
        where: { id: row.id },
        data: { status: 'pending', nextAttemptAt, lastError: message, lockedAt: null },
      });
      this.logger.warn(`Метрика: заказ ${row.orderId} отложен — интеграция не настроена`);
      return { result: 'retry', error: message, nextAttemptAt };
    }

    const permanent =
      api?.kind === 'unauthorized' ||
      api?.kind === 'forbidden' ||
      (api?.kind === 'http' && api.status >= 400 && api.status < 500);

    if (permanent || attempt >= MAX_ATTEMPTS) {
      return this.finishFailed(row, attempt, message, permanent, status);
    }

    const delaySec = RETRY_DELAYS_SECONDS[Math.min(attempt - 1, RETRY_DELAYS_SECONDS.length - 1)];
    const nextAttemptAt = new Date(Date.now() + delaySec * 1000);
    await this.prisma.metrikaOrderOutbox.update({
      where: { id: row.id },
      data: {
        status: 'pending',
        attemptCount: attempt,
        nextAttemptAt,
        lastError: message,
        responseCode: status,
        lockedAt: null,
      },
    });
    this.logger.warn(
      `Метрика: заказ ${row.orderId} попытка ${attempt} не удалась (HTTP ${status ?? '—'}): ${message}; повтор через ${delaySec} с`,
    );
    return { result: 'retry', error: message, nextAttemptAt };
  }

  private async finishFailed(
    row: ClaimedRow,
    attempt: number,
    message: string,
    permanent: boolean,
    status: number | null = null,
  ): Promise<ProcessOutcome> {
    await this.prisma.metrikaOrderOutbox.update({
      where: { id: row.id },
      data: {
        status: 'failed',
        attemptCount: attempt,
        lastError: message,
        responseCode: status,
        lockedAt: null,
      },
    });
    this.logger.error(
      `Метрика: заказ ${row.orderId} — ${permanent ? 'окончательная ошибка' : 'попытки исчерпаны'} (HTTP ${status ?? '—'}): ${message}`,
    );
    return { result: 'failed', error: message, permanent };
  }
}
