import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OzonShippedCloseService } from './ozon-shipped-close.service';

/**
 * Таймер вокруг OzonShippedCloseService — по образцу ozon-import-poll.
 *
 * Пять минут, а не тридцать секунд: отгрузку отмечают раз в день, и чаще
 * спрашивать площадку незачем — у неё лимиты, а выигрыша нет. Заказ закроется
 * в течение нескольких минут после того, как Ozon отметит отправление.
 */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class OzonShippedClosePollService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OzonShippedClosePollService.name);
  private timer?: NodeJS.Timeout;
  private startupTimer?: NodeJS.Timeout;

  constructor(private readonly closer: OzonShippedCloseService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.tick();
    }, POLL_INTERVAL_MS);
    // Первый проход не сразу после старта: дать подняться соединениям
    // и не дёргать площадку на каждом перезапуске контейнера.
    this.startupTimer = setTimeout(() => this.tick(), 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  private tick(): void {
    this.closer
      .pollOnce()
      .catch((err: unknown) =>
        this.logger.error('Закрытие отгруженных заказов не отработало', err),
      );
  }
}
