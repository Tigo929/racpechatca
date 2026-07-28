import { Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { EnumProductCategory, EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { TelegramStickerLinkService } from './telegram-sticker-link.service';
import { buildPartnerCaption, buildPartnerButtons } from 'src/order-photo/partner-telegram-format';

type TgUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number };
    };
  };
};

// v1:orderId:action
const CB_PREFIX = 'tshirt:';

const ACTION_STATUS: Record<string, EnumStatus> = {
  work: EnumStatus.IN_PROGRESS,
  not_ready: EnumStatus.IN_PROGRESS,
  printed: EnumStatus.PRINTED,
  ready: EnumStatus.READY,
  problem: EnumStatus.IN_PROGRESS, // PROBLEM status handled separately
};

const STATUS_TOAST: Partial<Record<string, string>> = {
  work: '🔄 В работе',
  printed: '🖨️ Напечатано',
  ready: '✅ Готово',
  not_ready: '❌ Возвращено в работу',
  problem: '⚠️ Проблема — менеджер уведомлён',
};

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);
  private readonly secret: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly stickerLinks: TelegramStickerLinkService,
  ) {
    this.secret = config.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
  }

  @Post('webhook')
  async webhook(
    @Body() update: TgUpdate,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    if (this.secret && secret !== this.secret) return { ok: true };

    const cb = update.callback_query;
    const data = cb?.data ?? '';
    if (!cb || !data.startsWith(CB_PREFIX)) return { ok: true };

    const [, orderId, action] = data.split(':');
    if (!orderId || !action) {
      await this.telegram.answerCallbackQuery(cb.id, '⚠️ Неизвестная кнопка');
      return { ok: true };
    }

    try {
      const order = await this.prisma.orderPhoto.findUnique({
        where: { id: orderId },
        include: { tshirtItems: true },
      });

      if (!order || order.productCategory !== EnumProductCategory.TSHIRT) {
        await this.telegram.answerCallbackQuery(cb.id, '⚠️ Заказ не найден');
        return { ok: true };
      }
      if (order.status === EnumStatus.CANCELLED) {
        await this.telegram.answerCallbackQuery(cb.id, '🚫 Заказ отменён');
        return { ok: true };
      }

      let newStatus: EnumStatus | null = ACTION_STATUS[action] ?? null;

      // Special: problem button sets status string 'PROBLEM'
      const isProblem = action === 'problem';
      if (isProblem) {
        newStatus = EnumStatus.IN_PROGRESS; // fallback until PROBLEM in enum
      }

      if (!newStatus) {
        await this.telegram.answerCallbackQuery(cb.id, '⚠️ Неизвестное действие');
        return { ok: true };
      }

      // Save to CRM first
      const [, updated] = await this.prisma.$transaction([
        this.prisma.statusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: isProblem ? 'PROBLEM' : newStatus,
            changedBy: 'telegram-partner',
          },
        }),
        this.prisma.orderPhoto.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            statusChangedAt: new Date(),
            sourceRevision: { increment: 1 },
          },
          include: { tshirtItems: true },
        }),
      ]);

      // Create Gulian outbox event
      try {
        const settings = await this.prisma.partnerSettings.findFirst();
        const rate = settings?.partnerRateBasisPoints ?? 3000;
        const { calcGulianPayout } = await import('src/gulian/gulian-payout');
        const { toGulianStatus } = await import('src/gulian/gulian-status');
        const payout = calcGulianPayout(updated.tshirtItems, rate);
        const prodStatus = isProblem ? 'problem' : toGulianStatus(newStatus, updated.executorSentAt as Date | null);
        await this.prisma.gulianOutbox.create({
          data: {
            id: randomUUID(),
            eventId: randomUUID(),
            aggregateId: orderId,
            externalOrderId: updated.numberOrder,
            sourceRevision: updated.sourceRevision,
            payloadJson: {
              externalOrderId: updated.numberOrder,
              externalInternalId: updated.id,
              sourceRevision: updated.sourceRevision,
              quantity: payout.quantity,
              payoutCalculationMode: payout.mode,
              unitPayoutAmountKopecks: payout.unitPayoutKopecks,
              totalPayoutAmountKopecks: payout.totalPayoutKopecks,
              productionStatus: prodStatus,
              telegramChatId: updated.partnerTgChatId,
              telegramMessageId: updated.partnerTgMessageId != null ? String(updated.partnerTgMessageId) : null,
              sourceUrl: `/orders/${updated.id}`,
              createdAt: updated.createdAt.toISOString(),
              updatedAt: new Date().toISOString(),
            } as any,
            status: 'pending',
            nextAttemptAt: new Date(),
          },
        });
      } catch (gulianErr) {
        this.logger.warn(`Gulian enqueue failed for ${orderId}: ${gulianErr}`);
      }

      // Update Telegram message
      const msgId = cb.message?.message_id;
      const chatId = cb.message?.chat?.id;
      if (msgId && chatId) {
        try {
          const settings = await this.prisma.partnerSettings.findFirst();
          const rate = settings?.partnerRateBasisPoints ?? 3000;
          const stickerUrl = this.stickerLinks.buildStickerUrl(orderId);
          const caption = buildPartnerCaption(
            {
              ...updated,
              status: isProblem ? ('PROBLEM' as any) : newStatus,
            },
            rate,
          );
          const buttons = buildPartnerButtons(orderId, stickerUrl);
          await this.telegram.editMessageCaption(String(chatId), msgId, caption, buttons);
        } catch (editErr) {
          this.logger.warn(`editMessageCaption failed: ${editErr}`);
        }
      }

      await this.telegram.answerCallbackQuery(cb.id, STATUS_TOAST[action] ?? '✅ Статус обновлён');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook callback failed: ${msg}`);
      await this.telegram.answerCallbackQuery(cb.id, '❌ Ошибка — не удалось обновить');
    }

    return { ok: true };
  }
}