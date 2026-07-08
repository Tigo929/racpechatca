import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private readonly groupChatId: string;

  constructor(private config: ConfigService) {
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    this.groupChatId = config.get<string>('TELEGRAM_GROUP_CHAT_ID') ?? '';
  }

  /** Отправляет сообщение в произвольный чат (parse_mode=HTML). */
  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — notification skipped');
      return false;
    }
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Telegram sendMessage failed [${res.status}]: ${body}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error('Telegram sendMessage network error', err);
      return false;
    }
  }

  /** Отправляет сообщение в общую рабочую группу (id из TELEGRAM_GROUP_CHAT_ID). */
  async sendToGroup(text: string): Promise<boolean> {
    if (!this.groupChatId) {
      this.logger.warn('TELEGRAM_GROUP_CHAT_ID not set — group notification skipped');
      return false;
    }
    return this.sendMessage(this.groupChatId, text);
  }
}
