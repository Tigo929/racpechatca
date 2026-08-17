import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OzonImportService } from './ozon-import.service';

const POLL_INTERVAL_MS = 30 * 1000;

/**
 * Таймер вокруг OzonImportService.pollOnce() — по образцу
 * partner-status-poll.service.ts. Своего enable-флага нет: pollOnce сам
 * выходит мгновенно, если нет открытых батчей, так что лишний тик почти
 * бесплатен и не требует отдельной настройки окружения.
 */
@Injectable()
export class OzonImportPollService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OzonImportPollService.name);
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly importService: OzonImportService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.tick().catch((err: unknown) =>
        this.logger.error('Ozon import poll failed', err),
      );
    }, POLL_INTERVAL_MS);
    this.startupTimer = setTimeout(() => {
      this.tick().catch((err: unknown) =>
        this.logger.error('Initial Ozon import poll failed', err),
      );
    }, 15_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.importService.pollOnce();
    } finally {
      this.running = false;
    }
  }
}
