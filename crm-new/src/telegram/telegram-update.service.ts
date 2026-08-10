import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EnumProductCategory, EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { TelegramStickerLinkService } from './telegram-sticker-link.service';
import { buildPartnerCaption, buildPartnerButtons } from 'src/order-photo/partner-telegram-format';
import { calcGulianPayout } from 'src/gulian/gulian-payout';
import { toGulianStatus } from 'src/gulian/gulian-status';

type TelegramCallback = {
  id: string;
  data?: string;
  // from нужен кнопке «Отправил клиенту»: в CRM пишем, кто именно отметил.
  from?: { id: number; username?: string; first_name?: string };
  message?: { message_id: number; chat: { id: number } };
};

export type TgUpdate = {
  callback_query?: TelegramCallback;
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

@Injectable()
export class TelegramUpdateService {
  private readonly logger = new Logger(TelegramUpdateService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly stickerLinks: TelegramStickerLinkService,
  ) {}

  /**
   * Единая обработка апдейта Telegram. Вызывается и вебхуком, и поллингом —
   * логика кнопок живёт в одном месте.
   */
  async handleUpdate(update: TgUpdate): Promise<void> {
    const cb = update.callback_query;
    const data = cb?.data ?? '';
    if (!cb) return;

    // Кнопка «Отправил клиенту» под напоминанием об отзыве.
    if (data.startsWith('review:')) {
      await this.handleReviewSent(cb, data);
      return;
    }

    if (!data.startsWith(CB_PREFIX)) return;

    const [, orderId, action] = data.split(':');
    if (!orderId || !action) {
      await this.telegram.answerCallbackQuery(cb.id, '⚠️ Неизвестная кнопка');
      return;
    }

    try {
      const order = await this.prisma.orderPhoto.findUnique({
        where: { id: orderId },
        include: { tshirtItems: true },
      });

      if (!order || order.productCategory !== EnumProductCategory.TSHIRT) {
        await this.telegram.answerCallbackQuery(cb.id, '⚠️ Заказ не найден');
        return;
      }
      if (order.status === EnumStatus.CANCELLED) {
        await this.telegram.answerCallbackQuery(cb.id, '🚫 Заказ отменён');
        return;
      }

      let newStatus: EnumStatus | null = ACTION_STATUS[action] ?? null;

      // Special: problem button sets status string 'PROBLEM'
      const isProblem = action === 'problem';
      if (isProblem) {
        newStatus = EnumStatus.IN_PROGRESS; // fallback until PROBLEM in enum
      }

      if (!newStatus) {
        await this.telegram.answerCallbackQuery(cb.id, '⚠️ Неизвестное действие');
        return;
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

    return;
  }

  /**
   * Оператор нажал «Отправил клиенту» под напоминанием об отзыве: ставим отметку
   * «запрос отзыва отправлен» (дата + кто) и меняем кнопку на «✅ Отправлено».
   */
  private async handleReviewSent(
    callback: TelegramCallback,
    data: string,
  ): Promise<void> {
    const [, orderId, action] = data.split(':');
    // review:noop (кнопка уже в состоянии «отправлено») или что-то иное.
    if (action !== 'sent' || !orderId) {
      await this.telegram.answerCallbackQuery(callback.id, 'Уже отмечено ✅');
      return;
    }

    const who = callback.from?.username
      ? `@${callback.from.username}`
      : (callback.from?.first_name ?? 'сотрудник');

    try {
      const order = await this.prisma.orderPhoto.findUnique({
        where: { id: orderId },
        select: { id: true, clientReviewLeft: true, reviewRequestSentAt: true },
      });
      if (!order) {
        await this.telegram.answerCallbackQuery(callback.id, 'Заказ не найден');
        return;
      }

      // Одно нажатие закрывает вопрос: заказ переходит в «Отзыв оставлен»,
      // руками в CRM больше ничего менять не нужно. Отдельно сохраняем, кто и
      // когда нажал — по этой паре видно историю, если понадобится разобраться.
      // Идемпотентно: повторные нажатия ничего не переписывают.
      if (!order.clientReviewLeft) {
        await this.prisma.orderPhoto.update({
          where: { id: orderId },
          data: {
            clientReviewLeft: true,
            reviewRequestSentAt: order.reviewRequestSentAt ?? new Date(),
            reviewRequestSentBy: who,
          },
        });
      }

      // Меняем кнопку на неактивную отметку, чтобы в чате было видно факт.
      if (callback.message) {
        await this.telegram.editMessageReplyMarkup(
          callback.message.chat.id,
          callback.message.message_id,
          {
            inline_keyboard: [
              [
                {
                  text: `✅ Отзыв отмечен — ${who}`,
                  callback_data: 'review:noop',
                },
              ],
            ],
          },
        );
      }

      await this.telegram.answerCallbackQuery(
        callback.id,
        'Готово: отзыв отмечен как оставленный',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Review callback failed: ${message}`);
      await this.telegram.answerCallbackQuery(
        callback.id,
        'Не удалось обновить CRM',
      );
    }
  }
}
