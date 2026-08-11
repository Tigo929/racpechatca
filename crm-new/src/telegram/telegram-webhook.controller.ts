import {
  Body,
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
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
    // Без секрета эндпоинт закрыт. Раньше проверка при пустом секрете просто
    // пропускалась, и любой запрос снаружи мог двигать статусы заказов,
    // отмечать отзывы и ставить события выплат в очередь партнёру.
    if (!this.secret) {
      throw new ServiceUnavailableException('Вебхук Telegram не настроен');
    }
    if (!constantTimeEqual(secret ?? '', this.secret)) {
      throw new UnauthorizedException('Неверный секрет вебхука');
    }
    await this.updates.handleUpdate(update);
    return { ok: true };
  }
}

/** Сравнение секретов за постоянное время — длина сверяется отдельно. */
function constantTimeEqual(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
