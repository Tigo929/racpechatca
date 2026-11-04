import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';

/**
 * Внутренняя шина событий заказа.
 *
 * Нужна из-за направления зависимостей: `MarketplaceModule` импортирует
 * `OrderPhotoModule` (кабинет заводит заказы), поэтому обратно — от смены
 * статуса к площадке — импорта быть не может. Раньше это решалось опросом:
 * каждые 15 минут сверка замечала, что заказ уже в производстве, и только
 * тогда отправляла посылку на сборку. Владелец видел это как «не сработало»:
 * он нажимал «Передан в производство» и шёл в кабинет, где отправление
 * ещё ждало отгрузки.
 *
 * Шина — не очередь: события живут в памяти процесса и теряются при
 * перезапуске. Это допустимо ровно потому, что у каждого подписчика есть
 * свой опрос, который доделает пропущенное. Событие ускоряет, а не
 * гарантирует: ничего, что нельзя потерять, через него идти не должно.
 */

/** Заказ переведён в «Передан в производство». */
export interface SentToProductionEvent {
  orderId: string;
  numberOrder: string;
  /** Заказ заведён из кабинета площадки — только такие интересны площадке. */
  isMarketplacePrint: boolean;
}

type Handler = (event: SentToProductionEvent) => void | Promise<void>;

@Injectable()
export class OrderEventsService {
  private readonly logger = new Logger(OrderEventsService.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    /*
     * Подписчиков немного, но лимит по умолчанию (10) при добавлении
     * нового слушателя дал бы предупреждение в журнал вместо ошибки —
     * а молчаливое предупреждение о подписках никому не поможет.
     */
    this.emitter.setMaxListeners(50);
  }

  onSentToProduction(handler: Handler): void {
    this.emitter.on('sentToProduction', (event: SentToProductionEvent) => {
      /*
       * Обработчик не должен ронять ни смену статуса, ни процесс.
       * Смена статуса уже произошла и записана — всё, что делает
       * подписчик, это ускорение фоновой работы.
       */
      void (async () => {
        try {
          await handler(event);
        } catch (error) {
          this.logger.error(
            `Обработчик «передан в производство» упал на заказе ${event.numberOrder}`,
            error,
          );
        }
      })();
    });
  }

  emitSentToProduction(event: SentToProductionEvent): void {
    this.emitter.emit('sentToProduction', event);
  }
}
