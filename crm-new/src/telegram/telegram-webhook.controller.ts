import { Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnumProductCategory, EnumStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { TelegramService } from './telegram.service';

type TelegramCallbackUpdate = {
  callback_query?: {
    id: string;
    data?: string;
  };
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
    if (!callback || !data.startsWith('tshirt:')) return { ok: true };

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
}
