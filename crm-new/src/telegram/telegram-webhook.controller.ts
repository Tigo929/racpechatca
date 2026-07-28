import { Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnumProductCategory, EnumStatus } from 'src/generated/prisma/enums';
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

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);
  private readonly secret: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
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

    // Кнопка «Отправил клиенту» под напоминанием об отзыве.
    if (data.startsWith('review:')) {
      await this.handleReviewSent(callback, data);
      return { ok: true };
    }

    if (!data.startsWith('tshirt:')) return { ok: true };

    const [, orderId, action] = data.split(':');
    const status =
      action === 'ready'
        ? EnumStatus.READY
        : action === 'work' || action === 'not_ready'
          ? EnumStatus.IN_PROGRESS
          : null;

    if (!orderId || !status) {
      await this.telegram.answerCallbackQuery(callback.id, 'Неизвестная кнопка');
      return { ok: true };
    }

    try {
      const order = await this.prisma.orderPhoto.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, productCategory: true },
      });
      if (!order || order.productCategory !== EnumProductCategory.TSHIRT) {
        await this.telegram.answerCallbackQuery(callback.id, 'Заказ не найден');
        return { ok: true };
      }
      if (order.status !== status) {
        await this.prisma.$transaction([
          this.prisma.statusHistory.create({
            data: {
              orderId,
              fromStatus: order.status,
              toStatus: status,
              changedBy: 'telegram-partner',
            },
          }),
          this.prisma.orderPhoto.update({
            where: { id: orderId },
            data: { status, statusChangedAt: new Date() },
          }),
        ]);
      }
      await this.telegram.answerCallbackQuery(
        callback.id,
        status === EnumStatus.READY ? 'Статус: готов' : 'Статус: в работе',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Telegram callback failed: ${message}`);
      await this.telegram.answerCallbackQuery(callback.id, 'Не удалось обновить CRM');
    }

    return { ok: true };
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
        select: { id: true, reviewRequestSentAt: true },
      });
      if (!order) {
        await this.telegram.answerCallbackQuery(callback.id, 'Заказ не найден');
        return;
      }

      // Идемпотентно: первое нажатие проставляет отметку, повторные — нет.
      if (!order.reviewRequestSentAt) {
        await this.prisma.orderPhoto.update({
          where: { id: orderId },
          data: { reviewRequestSentAt: new Date(), reviewRequestSentBy: who },
        });
      }

      // Меняем кнопку на неактивную отметку, чтобы в чате было видно факт.
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
