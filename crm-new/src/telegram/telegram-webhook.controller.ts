import { Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GulianOutboxService } from 'src/gulian-integration/gulian-outbox.service';
import { EnumProductCategory, EnumStatus } from 'src/generated/prisma/enums';
import { TshirtPartnerTelegramService } from 'src/order-photo/tshirt-partner-telegram.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from './telegram.service';

type TelegramCallback = {
  id: string;
  data?: string;
  from?: { id: number; username?: string; first_name?: string };
  message?: { message_id: number; chat: { id: number } };
};

type TelegramCallbackUpdate = {
  callback_query?: TelegramCallback;
};

const PROBLEM_REASONS: Record<string, string> = {
  file: 'Нет файла',
  layout: 'Проблема с макетом',
  item: 'Нет изделия',
  defect: 'Брак',
  clarify: 'Требуется уточнение',
  other: 'Другое',
};

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);
  private readonly secret: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly gulianOutbox: GulianOutboxService,
    private readonly tshirtPartnerTelegram: TshirtPartnerTelegramService,
  ) {
    this.secret = config.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
  }

  @Post('webhook')
  async webhook(
    @Body() update: TelegramCallbackUpdate,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    if (this.secret && secret !== this.secret) return { ok: true };

    const callback = update.callback_query;
    const data = callback?.data ?? '';
    if (!callback) return { ok: true };

    if (data.startsWith('review:')) {
      await this.handleReviewSent(callback, data);
      return { ok: true };
    }
    if (!data.startsWith('tshirt:')) return { ok: true };

    const [, orderId, action, reasonCode] = data.split(':');
    if (!orderId) {
      await this.telegram.answerCallbackQuery(callback.id, 'Неизвестная кнопка');
      return { ok: true };
    }

    if (action === 'problem' && !reasonCode) {
      if (callback.message) {
        await this.telegram.editMessageReplyMarkup(
          callback.message.chat.id,
          callback.message.message_id,
          this.tshirtPartnerTelegram.buildProblemReasonButtons(orderId),
        );
      }
      await this.telegram.answerCallbackQuery(callback.id, 'Выберите причину');
      return { ok: true };
    }

    const status =
      action === 'ready'
        ? EnumStatus.READY
        : action === 'work' || action === 'not_ready'
          ? EnumStatus.IN_PROGRESS
          : action === 'problem' && PROBLEM_REASONS[reasonCode]
            ? EnumStatus.PROBLEM
            : null;
    const problemReason =
      status === EnumStatus.PROBLEM ? PROBLEM_REASONS[reasonCode] : null;

    if (!status) {
      await this.telegram.answerCallbackQuery(callback.id, 'Неизвестная кнопка');
      return { ok: true };
    }

    const actor = callback.from?.username
      ? `telegram:@${callback.from.username}`
      : `telegram:${callback.from?.id ?? 'partner'}`;

    try {
      const changed = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id" FROM "OrderPhoto" WHERE "id" = ${orderId} FOR UPDATE
        `;
        const order = await tx.orderPhoto.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            status: true,
            productCategory: true,
            productionProblemReason: true,
          },
        });
        if (!order || order.productCategory !== EnumProductCategory.TSHIRT) {
          return false;
        }
        if (
          order.status === EnumStatus.PAID ||
          order.status === EnumStatus.CANCELLED
        ) {
          throw new Error('Закрытый заказ нельзя вернуть в производство.');
        }
        if (
          order.status === status &&
          order.productionProblemReason === problemReason
        ) {
          return true;
        }

        await tx.statusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: status,
            changedBy: actor,
          },
        });
        await tx.orderPhoto.update({
          where: { id: orderId },
          data: {
            status,
            statusChangedAt: new Date(),
            sourceRevision: { increment: 1 },
            productionProblemReason: problemReason,
          },
        });
        await this.gulianOutbox.enqueueCurrent(tx, {
          orderId,
          productionStatus:
            status === EnumStatus.READY
              ? 'ready'
              : status === EnumStatus.PROBLEM
                ? 'problem'
                : 'in_progress',
          actor,
          action: 'telegram_production_status_changed',
        });
        return true;
      });

      if (!changed) {
        await this.telegram.answerCallbackQuery(callback.id, 'Заказ не найден');
        return { ok: true };
      }

      const refreshed = await this.tshirtPartnerTelegram.refreshOrderMessage(
        orderId,
      );
      await this.telegram.answerCallbackQuery(
        callback.id,
        refreshed
          ? status === EnumStatus.READY
            ? 'Статус: готов'
            : status === EnumStatus.PROBLEM
              ? `Проблема: ${problemReason}`
              : 'Статус: в работе'
          : 'CRM обновлена, сообщение Telegram обновить не удалось',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Telegram callback failed: ${message}`);
      await this.telegram.answerCallbackQuery(callback.id, 'Не удалось обновить CRM');
    }

    return { ok: true };
  }

  private async handleReviewSent(
    callback: TelegramCallback,
    data: string,
  ): Promise<void> {
    const [, orderId, action] = data.split(':');
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
        select: { id: true, reviewRequestSentAt: true },
      });
      if (!order) {
        await this.telegram.answerCallbackQuery(callback.id, 'Заказ не найден');
        return;
      }

      if (!order.reviewRequestSentAt) {
        await this.prisma.orderPhoto.update({
          where: { id: orderId },
          data: { reviewRequestSentAt: new Date(), reviewRequestSentBy: who },
        });
      }

      if (callback.message) {
        await this.telegram.editMessageReplyMarkup(
          callback.message.chat.id,
          callback.message.message_id,
          {
            inline_keyboard: [
              [{ text: `✅ Отправлено — ${who}`, callback_data: 'review:noop' }],
            ],
          },
        );
      }

      await this.telegram.answerCallbackQuery(
        callback.id,
        'Отмечено: запрос отзыва отправлен',
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

