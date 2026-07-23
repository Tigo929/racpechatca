import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private readonly groupChatId: string;
  // Отдельный чат/тема для напоминаний об отзывах. Если не задан — падаем
  // обратно в общую рабочую группу (см. sendReviewReminder).
  private readonly reviewChatId: string;
  private readonly reviewThreadId: string;

  constructor(private config: ConfigService) {
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    this.groupChatId = config.get<string>('TELEGRAM_GROUP_CHAT_ID') ?? '';
    this.reviewChatId = config.get<string>('TELEGRAM_REVIEW_CHAT_ID') ?? '';
    this.reviewThreadId = config.get<string>('TELEGRAM_REVIEW_THREAD_ID') ?? '';
  }

  /**
   * Отправляет сообщение в произвольный чат (parse_mode=HTML).
   * threadId — id темы форум-супергруппы (message_thread_id); если чат не форум,
   * не передавайте его.
   */
  async sendMessage(
    chatId: string,
    text: string,
    threadId?: string,
  ): Promise<boolean> {
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
          ...(threadId ? { message_thread_id: Number(threadId) } : {}),
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(
          `Telegram sendMessage failed [${res.status}]: ${body}`,
        );
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
      this.logger.warn(
        'TELEGRAM_GROUP_CHAT_ID not set — group notification skipped',
      );
      return false;
    }
    return this.sendMessage(this.groupChatId, text);
  }

  /**
   * Напоминания об отзывах — в выделенный чат/тему (TELEGRAM_REVIEW_CHAT_ID
   * [+ TELEGRAM_REVIEW_THREAD_ID]). Если он не задан — в общую рабочую группу,
   * чтобы напоминания не пропали при отсутствии настройки.
   */
  async sendReviewReminder(text: string): Promise<boolean> {
    if (this.reviewChatId) {
      return this.sendMessage(
        this.reviewChatId,
        text,
        this.reviewThreadId || undefined,
      );
    }
    return this.sendToGroup(text);
  }
}
