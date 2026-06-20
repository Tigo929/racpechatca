import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;

  constructor(private config: ConfigService) {
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — notification skipped');
      return;
    }
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Telegram sendMessage failed [${res.status}]: ${body}`);
      }
    } catch (err) {
      this.logger.error('Telegram sendMessage network error', err);
    }
  }
}
