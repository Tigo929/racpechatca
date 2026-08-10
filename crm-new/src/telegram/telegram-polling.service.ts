import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramUpdateService, TgUpdate } from './telegram-update.service';

/**
 * Получение нажатий на кнопки через long polling (getUpdates).
 *
 * Зачем не вебхук: Telegram не может достучаться до боевого сервера —
 * getWebhookInfo стабильно отдаёт «Connection timed out», а в логах nginx нет
 * ни одного его запроса. Исходящие соединения при этом работают (бот шлёт
 * сообщения), поэтому забираем обновления сами.
 *
 * Вебхук и getUpdates взаимоисключающи, поэтому при старте вебхук снимаем.
 */
@Injectable()
export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollingService.name);
  private readonly token: string;
  private readonly enabled: boolean;
  private offset = 0;
  private stopped = false;

  constructor(
    config: ConfigService,
    private readonly updates: TelegramUpdateService,
  ) {
    this.token = config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    // Выключатель на случай, если вебхук once again заработает или нужно
    // погасить поллинг, не выкатывая код.
    this.enabled = config.get<string>('TELEGRAM_POLLING_ENABLED') !== 'false';
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Telegram polling выключен (TELEGRAM_POLLING_ENABLED=false)');
      return;
    }
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не задан — поллинг не запускается');
      return;
    }
    // Не блокируем старт приложения: цикл живёт своей жизнью.
    void this.start();
  }

  onModuleDestroy() {
    this.stopped = true;
  }

  private async start(): Promise<void> {
    // getUpdates не работает, пока установлен вебхук. Накопленные апдейты не
    // сбрасываем — нажатия, сделанные до старта, тоже обработаем.
    await this.call('deleteWebhook', { drop_pending_updates: false });
    this.logger.log('Telegram polling запущен');

    while (!this.stopped) {
      try {
        const res = await this.call<TgUpdateWithId[]>('getUpdates', {
          offset: this.offset || undefined,
          timeout: 25,
          allowed_updates: ['callback_query'],
        });

        for (const update of res ?? []) {
          this.offset = update.update_id + 1;
          try {
            await this.updates.handleUpdate(update);
          } catch (err) {
            this.logger.error('Ошибка обработки апдейта Telegram', err);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Telegram getUpdates упал: ${message}`);
        // Пауза, чтобы не долбить API в цикле при сетевых проблемах.
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async call<T>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T | null> {
    const res = await fetch(
      `https://api.telegram.org/bot${this.token}/${method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // Long poll: ждём дольше, чем timeout запроса к Telegram.
        signal: AbortSignal.timeout(40_000),
      },
    );
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      throw new Error(json.description ?? `${method} вернул ok=false`);
    }
    return json.result ?? null;
  }
}

type TgUpdateWithId = TgUpdate & { update_id: number };
