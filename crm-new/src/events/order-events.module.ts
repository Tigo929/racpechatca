import { Module } from '@nestjs/common';
import { OrderEventsService } from './order-events.service';

/**
 * Шина событий заказа — отдельным модулем без зависимостей.
 *
 * Её импортируют и тот, кто меняет статус (order-photo), и тот, кто на это
 * реагирует (marketplace). Будь шина частью любого из них, импорт замкнулся
 * бы в кольцо: marketplace уже импортирует order-photo.
 */
@Module({
  providers: [OrderEventsService],
  exports: [OrderEventsService],
})
export class OrderEventsModule {}
