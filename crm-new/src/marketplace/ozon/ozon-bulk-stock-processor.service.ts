import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OzonBulkStockService } from './ozon-bulk-stock.service';

/**
 * Часы для массового изменения остатков.
 *
 * Отдельно от сервиса намеренно: сервис — это правила и работа с базой,
 * его зовут и из запроса, и из теста. Здесь только «когда» — тот же приём,
 * что у генератора карточек и у очереди Gulian, и по той же причине:
 * очередь на таблице, без Redis и без брокера.
 *
 * Переживших перезапуск возвращать в очередь не нужно: пара остаётся
 * в ожидании до тех пор, пока по ней не будет решения, и следующий такт
 * подберёт её сам.
 */

const TICK_MS = 3_000;

@Injectable()
export class OzonBulkStockProcessorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OzonBulkStockProcessorService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly bulk: OzonBulkStockService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    // Очередь не должна держать процесс живым при остановке.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Такты не накладываются друг на друга: отправка в Ozon занимает секунды,
   * а такт короче. Без флага два такта разобрали бы одни и те же пары
   * и отправили их дважды — то есть получили бы гарантированный отказ
   * по правилу «одна пара не чаще раза в тридцать секунд».
   */
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.bulk.tick();
    } catch (e) {
      this.logger.error(
        `Такт массового изменения остатков не прошёл: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
