import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TelegramSentMessage {
  chatId: string;
  messageId: string;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly token: string;
  private readonly groupChatId: string;
  private readonly reviewChatId: string;
  private readonly reviewThreadId: string;

  constructor(private config: ConfigService) {
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    this.groupChatId = config.get<string>('TELEGRAM_GROUP_CHAT_ID') ?? '';
    this.reviewChatId = config.get<string>('TELEGRAM_REVIEW_CHAT_ID') ?? '';
    this.reviewThreadId = config.get<string>('TELEGRAM_REVIEW_THREAD_ID') ?? '';
  }

  async sendMessage(
    chatId: string,
    text: string,
    threadId?: string,
    replyMarkup?: unknown,
  ): Promise<boolean> {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — notification skipped');
      return false;
    }
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            ...(threadId ? { message_thread_id: Number(threadId) } : {}),
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          }),
        },
      );
      if (!res.ok) {
        this.logger.error(
          `Telegram sendMessage failed [${res.status}]: ${await res.text()}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error('Telegram sendMessage network error', err);
      return false;
    }
  }

  async sendPhoto(
    chatId: string,
    photo: Buffer,
    filename: string,
    contentType: string,
    caption?: string,
    threadId?: string,
    replyMarkup?: unknown,
  ): Promise<boolean> {
    return Boolean(
      await this.sendPhotoWithResult(
        chatId,
        photo,
        filename,
        contentType,
        caption,
        threadId,
        replyMarkup,
      ),
    );
  }

  async sendPhotoWithResult(
    chatId: string,
    photo: Buffer,
    filename: string,
    contentType: string,
    caption?: string,
    threadId?: string,
    replyMarkup?: unknown,
  ): Promise<TelegramSentMessage | null> {
    return this.sendMultipartWithResult(
      'sendPhoto',
      chatId,
      'photo',
      photo,
      filename,
      { caption, contentType, threadId, replyMarkup },
    );
  }

  async sendDocument(
    chatId: string,
    document: Buffer,
    filename: string,
    contentType: string,
    caption?: string,
    threadId?: string,
    replyMarkup?: unknown,
  ): Promise<boolean> {
    return Boolean(
      await this.sendDocumentWithResult(
        chatId,
        document,
        filename,
        contentType,
        caption,
        threadId,
        replyMarkup,
      ),
    );
  }

  async sendDocumentWithResult(
    chatId: string,
    document: Buffer,
    filename: string,
    contentType: string,
    caption?: string,
    threadId?: string,
    replyMarkup?: unknown,
  ): Promise<TelegramSentMessage | null> {
    return this.sendMultipartWithResult(
      'sendDocument',
      chatId,
      'document',
      document,
      filename,
      { caption, contentType, threadId, replyMarkup },
    );
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/answerCallbackQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        },
      );
      return res.ok;
    } catch (err) {
      this.logger.error('Telegram answerCallbackQuery network error', err);
      return false;
    }
  }

  async sendToGroup(text: string): Promise<boolean> {
    if (!this.groupChatId) {
      this.logger.warn(
        'TELEGRAM_GROUP_CHAT_ID not set — group notification skipped',
      );
      return false;
    }
    return this.sendMessage(this.groupChatId, text);
  }

  async sendReviewReminder(
    text: string,
    replyMarkup?: unknown,
  ): Promise<boolean> {
    if (this.reviewChatId) {
      return this.sendMessage(
        this.reviewChatId,
        text,
        this.reviewThreadId || undefined,
        replyMarkup,
      );
    }
    return this.sendMessage(this.groupChatId, text, undefined, replyMarkup);
  }

  async editMessageReplyMarkup(
    chatId: string | number,
    messageId: number,
    replyMarkup: unknown,
  ): Promise<boolean> {
    return this.callJson('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    });
  }

  async editMessageCaption(
    chatId: string | number,
    messageId: number,
    caption: string,
    replyMarkup: unknown,
  ): Promise<boolean> {
    return this.callJson('editMessageCaption', {
      chat_id: chatId,
      message_id: messageId,
      caption,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });
  }

  private async callJson(method: string, body: unknown): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.error(
          `Telegram ${method} failed [${res.status}]: ${await res.text()}`,
        );
      }
      return res.ok;
    } catch (err) {
      this.logger.error(`Telegram ${method} network error`, err);
      return false;
    }
  }

  private async sendMultipartWithResult(
    method: 'sendPhoto' | 'sendDocument',
    chatId: string,
    fileField: 'photo' | 'document',
    file: Buffer,
    filename: string,
    options: {
      caption?: string;
      contentType: string;
      threadId?: string;
      replyMarkup?: unknown;
    },
  ): Promise<TelegramSentMessage | null> {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — notification skipped');
      return null;
    }

    const form = new FormData();
    form.set('chat_id', chatId);
    if (options.threadId) {
      form.set('message_thread_id', String(Number(options.threadId)));
    }
    if (options.caption) {
      form.set('caption', options.caption);
      form.set('parse_mode', 'HTML');
    }
    if (options.replyMarkup) {
      form.set('reply_markup', JSON.stringify(options.replyMarkup));
    }
    form.set(
      fileField,
      new Blob([file as unknown as BlobPart], { type: options.contentType }),
      filename,
    );

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.token}/${method}`,
        { method: 'POST', body: form },
      );
      const body = await res.text();
      if (!res.ok) {
        this.logger.error(`Telegram ${method} failed [${res.status}]: ${body}`);
        return null;
      }
      const parsed = JSON.parse(body) as {
        ok?: boolean;
        result?: { message_id?: number; chat?: { id?: number | string } };
      };
      const messageId = parsed.result?.message_id;
      const resultChatId = parsed.result?.chat?.id;
      if (!parsed.ok || messageId === undefined || resultChatId === undefined) {
        this.logger.error(`Telegram ${method} response has no message identifiers`);
        return null;
      }
      return {
        chatId: String(resultChatId),
        messageId: String(messageId),
      };
    } catch (err) {
      this.logger.error(`Telegram ${method} network error`, err);
      return null;
    }
  }
}