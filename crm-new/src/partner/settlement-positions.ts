import { SettlementPosition } from './partner-settlement';

/**
 * Из чего складывается расчёт с партнёром по заказу на футболки.
 *
 * Долгое время это были только позиции-футболки, и каждое место считало их
 * само. Потом появилась печать на изделии заказчика: цвета и размера у неё
 * нет, поэтому заводится она свободной позицией — и мимо расчёта проходила
 * целиком. Партнёр печатал, а вознаграждение выходило нулевым; у владельца
 * та же сумма полностью падала в прибыль. Сборка позиций вынесена сюда,
 * чтобы такой перекос нельзя было получить в одном месте и не получить
 * в другом: отчёт, сообщение партнёру и выплаты берут один и тот же список.
 */

export interface TshirtPositionSource {
  pricePosition: number;
  designCost: number;
  quantity: number;
  thermalCost: number;
  blankCost: number;
  clientItem: boolean;
}

export interface FreePositionSource {
  pricePosition: number;
  quantity: number;
  printOnClientItem: boolean;
  thermalCost: number;
}

export interface OrderPositionsSource {
  tshirtItems?: TshirtPositionSource[] | null;
  items?: FreePositionSource[] | null;
}

/**
 * Свободная позиция «печать на изделии заказчика» в терминах расчёта.
 *
 * Заготовку покупает клиент — значит clientItem, и стоимость футболки
 * из материалов уходит (blankCost не участвует, но обнуляем явно, чтобы
 * значение по умолчанию из настроек сюда случайно не просочилось).
 * Дизайна у такой позиции нет: его заводят отдельной суммой по заказу.
 */
function freeToSettlement(item: FreePositionSource): SettlementPosition {
  return {
    pricePosition: item.pricePosition,
    designCost: 0,
    quantity: item.quantity,
    thermalCost: item.thermalCost,
    blankCost: 0,
    clientItem: true,
  };
}

/** Все позиции заказа, за которые партнёру причитается вознаграждение. */
export function settlementPositions(
  order: OrderPositionsSource,
): SettlementPosition[] {
  const tshirts = (order.tshirtItems ?? []).map((i) => ({
    pricePosition: i.pricePosition,
    designCost: i.designCost,
    quantity: i.quantity,
    thermalCost: i.thermalCost,
    blankCost: i.blankCost,
    clientItem: i.clientItem,
  }));
  const prints = (order.items ?? [])
    .filter((i) => i.printOnClientItem)
    .map(freeToSettlement);
  return [...tshirts, ...prints];
}
