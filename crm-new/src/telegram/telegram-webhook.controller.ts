import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramUpdateService } from './telegram-update.service';
import type { TgUpdate } from './telegram-update.service';

/**
 * Вебхук Telegram. Вся логика кнопок живёт в TelegramUpdateService — тот же
 * код используется поллингом (telegram-polling.service).
 *
 * На боевом сервере вебхук не работает: Telegram не может достучаться до
 * российского IP («Connection timed out»), в логах nginx его запросов нет
 * вовсе. Поэтому основной способ получать нажатия — поллинг. Контроллер
 * оставлен рабочим на случай, если сеть починят.
 */
@Controller('telegram')
export class TelegramWebhookController {
  private readonly secret: string;

  constructor(
    config: ConfigService,
    private readonly updates: TelegramUpdateService,
  ) {
    this.secret = config.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
  }

  @Post('webhook')
  async webhook(
    @Body() update: TgUpdate,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    if (this.secret && secret !== this.secret) return { ok: true };
    await this.updates.handleUpdate(update);
    return { ok: true };
  }
}
