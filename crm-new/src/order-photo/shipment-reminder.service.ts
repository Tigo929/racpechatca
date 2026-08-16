import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from 'src/telegram/telegram.service';
import {
  buildShipmentReminder,
  dueReminderStage,
} from './shipment-reminder-rules';

/**
 * Напоминает отвезти созданную отгрузку.
 *
 * У Яндекс.Маркета на это 48 часов: не успели — поставка отменяется и её
 * создают заново. Заказ при этом готов и лежит, то есть теряется время и
 * место, а клиент ждёт.
 *
 * Расписание и тексты — в shipment-reminder-rules.ts, здесь только обход
 * заказов и отправка. Разделение то же, что у напоминаний об отзывах:
 * правила проверяются тестами без базы и Telegram.
 */

/** Раз в полчаса: стадии заданы часами, чаще смотреть незачем. */
const SCAN_MS = 30 * 60 * 1000;
/** Первый обход — после того как приложение поднялось и БД доступна. */
const STARTUP_DELAY_MS = 45_000;
/** Пауза между сообщениями: Telegram пропускает ~20 в минуту в один чат. */
const SEND_DELAY_MS = 3500;
/** За один обход не заваливаем чат: остальное уйдёт следующим. */
const BATCH_LIMIT = 10;

@Injectable()
export class ShipmentReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShipmentReminderService.name);
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.scanAndNotify().catch((err: unknown) => {
        this.logger.error('Обход отгрузок не удался', err);
      });
    }, SCAN_MS);

    this.startupTimer = setTimeout(() => {
      this.scanAndNotify().catch((err: unknown) => {
        this.logger.error('Первый обход отгрузок не удался', err);
      });
    }, STARTUP_DELAY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  async scanAndNotify(): Promise<void> {
    const orders = await this.prisma.orderPhoto.findMany({
      where: { status: EnumStatus.SHIPMENT_CREATED },
      select: {
        id: true,
        numberOrder: true,
        status: true,
        deliveryMethod: true,
        statusChangedAt: true,
        shipmentRemindersSent: true,
        executor: { select: { username: true, telegramUsername: true } },
      },
      orderBy: { statusChangedAt: 'asc' },
    });

    const now = new Date();
    let sent = 0;

    for (const order of orders) {
      if (sent >= BATCH_LIMIT) break;

      const stage = dueReminderStage(order, now);
      if (stage === null) continue;

      // Тег работает только по telegramUsername: по логину CRM Telegram
      // никого не найдёт, поэтому иначе честно пишем, что заказ ничей.
      const tg = order.executor?.telegramUsername?.trim();
      const mention = tg ? `@${tg.replace(/^@+/, '')}` : null;

      const text = buildShipmentReminder(order, stage, mention, now);

      try {
        await this.telegram.sendToGroup(text);
        // Счётчик двигаем только после успешной отправки: иначе молчание
        // бота из-за сети превратилось бы в «напоминание уже было».
        await this.prisma.orderPhoto.update({
          where: { id: order.id },
          data: { shipmentRemindersSent: stage },
        });
        sent += 1;
        if (sent < BATCH_LIMIT) {
          await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
        }
      } catch (err) {
        this.logger.warn(
          `Не удалось напомнить об отгрузке ${order.numberOrder}: ${String(err)}`,
        );
      }
    }

    if (sent > 0) {
      this.logger.log(`Напоминаний об отгрузке отправлено: ${sent}`);
    }
  }
}
