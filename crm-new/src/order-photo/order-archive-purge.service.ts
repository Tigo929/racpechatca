import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OrderArchiveService } from './order-archive.service';

/**
 * Очистка корзины по сроку хранения.
 *
 * Раз в шесть часов, а не раз в сутки: суточный проход привязал бы очистку
 * к моменту старта контейнера, и при частых перезапусках она могла бы
 * не случиться вовсе. Точность здесь не нужна — важно, чтобы снимок
 * гарантированно ушёл в течение дня после истечения срока.
 *
 * Таймер живёт отдельным сервисом: сам OrderArchiveService обслуживает
 * запросы и остаётся проверяемым тестами без фальшивых часов.
 */
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Задержка первого прохода после старта. Нужна, чтобы очистка не
 * соревновалась с миграциями и прогревом при разворачивании.
 */
const STARTUP_DELAY_MS = 60_000;

@Injectable()
export class OrderArchivePurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderArchivePurgeService.name);
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;

  constructor(private readonly archive: OrderArchiveService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), PURGE_INTERVAL_MS);
    this.startupTimer = setTimeout(() => void this.run(), STARTUP_DELAY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  private async run(): Promise<void> {
    try {
      await this.archive.purgeExpired();
    } catch (error) {
      // Неудачная очистка не должна валить приложение: снимок просто
      // полежит до следующего прохода.
      this.logger.error('Очистка корзины не удалась', error);
    }
  }
}
