import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Prisma } from 'src/generated/prisma/client';
import { TelegramService } from 'src/telegram/telegram.service';
import { DtoCreateLead } from './dto/create-lead.dto';
import {
  buildLeadNotification,
  leadContactLine,
  pickLeadResponders,
} from './lead-notification';
import { alertExpired, nextAlertDelayMs, withLateNotice } from './lead-alert';

/** Как часто воркер заглядывает в очередь. */
const TICK_MS = 60_000;

/** Сколько строк пытаемся отправить за один проход. */
const BATCH = 20;

/**
 * Доставка уведомлений о заявках с сайта в Telegram.
 *
 * Устроено как Web Push (`LeadPushDelivery`): строка появляется в той же
 * транзакции, что и заказ, а отправкой занимается воркер. Так заявка и
 * уведомление о ней живут или не живут вместе — промежутка, в котором заказ
 * уже есть, а сказать о нём некому, больше нет.
 *
 * Почему это понадобилось: 13 ноября 2026 перестал отвечать посредник, через
 * которого сервер ходит в Telegram (напрямую имя api.telegram.org
 * фильтруется по пути). Бот молчал сутки с лишним, и четыре заявки с сайта
 * не получили ни одного уведомления — ни в тот момент, ни после. Отправка
 * «на удачу» без следа в базе этого не прощает.
 */
@Injectable()
export class LeadAlertService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeadAlertService.name);
  private timer?: ReturnType<typeof setInterval>;
  private flushing = false;
  /** О молчании канала пишем один раз, а не на каждой попытке. */
  private warned = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), TICK_MS);
    // Таймер не держит процесс: в тестах и при остановке он не мешает.
    this.timer.unref?.();
    // Сразу при старте: после перезапуска в очереди может лежать всё, что
    // не ушло до него.
    void this.flush();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /**
   * Ставит уведомление в очередь. Зовётся ВНУТРИ транзакции заявки.
   *
   * Текст собираем здесь же, а не при отправке: кого тегать, зависит от
   * состава менеджеров на момент заявки, и через сутки ответ на этот вопрос
   * может быть другим. В очереди лежит готовое сообщение.
   *
   * `skipDuplicates` и уникальный `orderId` — потому что сайт досылает
   * недоставленную заявку по кругу: одна заявка должна дать одно уведомление,
   * сколько бы раз она ни пришла.
   */
  async enqueue(
    tx: Prisma.TransactionClient,
    order: { id: string; numberOrder: string },
    dto: DtoCreateLead,
  ): Promise<void> {
    const [users, settings] = await Promise.all([
      tx.user.findMany({
        where: { isActive: true },
        select: {
          username: true,
          telegramUsername: true,
          role: true,
          isActive: true,
        },
      }),
      tx.partnerSettings.findUnique({
        where: { id: 'default' },
        select: { leadMentionUsernames: true },
      }),
    ]);
    const body = buildLeadNotification(
      {
        numberOrder: order.numberOrder,
        name: dto.name,
        productName: dto.productName,
        quantity: dto.quantity,
        total: dto.total,
        comment: dto.comment ?? dto.description,
        contact: leadContactLine(dto),
      },
      pickLeadResponders(users, settings?.leadMentionUsernames ?? ''),
    );
    await tx.leadTelegramDelivery.createMany({
      data: [{ orderId: order.id, numberOrder: order.numberOrder, body }],
      skipDuplicates: true,
    });
  }

  /** Сколько уведомлений ждёт отправки — для диагностики и отчётов. */
  async pendingCount(): Promise<number> {
    return this.prisma.leadTelegramDelivery.count({
      where: { status: 'PENDING' },
    });
  }

  /**
   * Отправляет то, что ждёт в очереди.
   *
   * Первая же неудача обрывает проход. Канал падает целиком, а не для
   * отдельной строки: продолжать значит двадцать раз подряд ждать таймаут
   * сети, держа воркер и засоряя лог одинаковыми ошибками.
   */
  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      for (let i = 0; i < BATCH; i++) {
        const token = randomUUID();
        const job = await this.prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "LeadTelegramDelivery"
            WHERE "status" = 'PENDING' AND "nextAttemptAt" <= NOW()
              AND ("claimedUntil" IS NULL OR "claimedUntil" < NOW())
            ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
          if (!rows.length) return null;
          return tx.leadTelegramDelivery.update({
            where: { id: rows[0].id },
            data: {
              claimToken: token,
              claimedUntil: new Date(Date.now() + TICK_MS),
              attempts: { increment: 1 },
            },
          });
        });
        if (!job) break;

        const finish = (
          data: Prisma.LeadTelegramDeliveryUpdateManyMutationInput,
        ) =>
          this.prisma.leadTelegramDelivery.updateMany({
            where: { id: job.id, claimToken: token },
            data: { claimedUntil: null, ...data },
          });

        const now = new Date();

        /*
         * Заказ удалили — уведомлять не о чем. Заявку-дубль или спам владелец
         * убирает в первые минуты, и уведомление о ней, пришедшее на сутки
         * позже, отправило бы его искать заказ, которого нет.
         */
        const order = await this.prisma.orderPhoto.findUnique({
          where: { id: job.orderId },
          select: { id: true },
        });
        if (!order) {
          await finish({ status: 'CANCELLED', lastError: 'заказ удалён' });
          continue;
        }

        if (alertExpired(job.createdAt, now)) {
          await finish({
            status: 'FAILED',
            lastError: 'Telegram был недоступен неделю',
          });
          this.logger.warn(
            `Уведомление о заявке ${job.numberOrder} так и не доставлено: Telegram молчал неделю`,
          );
          continue;
        }

        let delivered = false;
        let error: string | null = null;
        try {
          delivered = await this.telegram.sendLeadAlert(
            withLateNotice(job.body, job.createdAt, now),
          );
        } catch (e) {
          error = String(e);
        }

        if (delivered) {
          await finish({ status: 'SENT', sentAt: now, lastError: null });
          if (job.attempts > 1) {
            this.logger.log(
              `Уведомление о заявке ${job.numberOrder} доставлено с ${job.attempts}-й попытки`,
            );
          }
          this.warned = false;
          continue;
        }

        await finish({
          status: 'PENDING',
          lastError: (error ?? 'Telegram не принял сообщение').slice(0, 500),
          nextAttemptAt: new Date(
            now.getTime() + nextAlertDelayMs(job.attempts),
          ),
        });
        if (!this.warned) {
          this.warned = true;
          this.logger.warn(
            `Telegram не принимает уведомления о заявках (${job.numberOrder}, попытка ${job.attempts}). Очередь ждёт, повторим позже.`,
          );
        }
        break;
      }
    } catch (error) {
      // База моргнула — очередь никуда не денется, следующий тик повторит.
      this.logger.warn(`Очередь уведомлений недоступна: ${String(error)}`);
    } finally {
      this.flushing = false;
    }
  }
}
