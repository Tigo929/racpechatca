import { SettlementMode, SettlementPosition } from './partner-settlement';

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
 *
 * Третьим случаем пришла печать термотрансферов: изделия нет вообще, плёнку
 * печатает исполнитель, и делить маржу не из чего — ему платится процент от
 * суммы. Режим теперь хранится у позиции (`partnerPayout`), а не выводится
 * из одного флага: двух вариантов перестало хватать.
 */

export interface TshirtPositionSource {
  pricePosition: number;
  designCost: number;
  quantity: number;
  thermalCost: number;
  blankCost: number;
  clientItem: boolean;
}

/** Режим выплаты у свободной позиции — как он лежит в базе. */
export type PartnerPayout = 'NONE' | 'MARGIN_SHARE' | 'REVENUE_SHARE';

export interface FreePositionSource {
  pricePosition: number;
  quantity: number;
  printOnClientItem: boolean;
  thermalCost: number;
  partnerPayout?: PartnerPayout | null;
  /** Снимок ставки на момент оформления; null — взять общую из настроек. */
  partnerRateBasisPoints?: number | null;
}

export interface OrderPositionsSource {
  tshirtItems?: TshirtPositionSource[] | null;
  items?: FreePositionSource[] | null;
}

/**
 * Режим позиции.
 *
 * Поля `partnerPayout` может не быть: часть выборок берёт из позиции только
 * старые колонки, и до миграции его не было вовсе. Тогда отвечаем ровно то,
 * что отвечала прежняя версия, — по `printOnClientItem`. Молча вернуть «не
 * платим» нельзя: это тихо отняло бы у исполнителя деньги за уже выполненную
 * работу.
 */
export function freePayoutMode(item: FreePositionSource): PartnerPayout {
  if (item.partnerPayout) return item.partnerPayout;
  return item.printOnClientItem ? 'MARGIN_SHARE' : 'NONE';
}

/** Входит ли свободная позиция в работу партнёра (и в расчёт с ним). */
export function isPartnerFreePosition(item: FreePositionSource): boolean {
  return freePayoutMode(item) !== 'NONE';
}

/**
 * Свободная позиция в терминах расчёта.
 *
 * Для доли от маржи заготовку покупает клиент — значит clientItem, и
 * стоимость футболки из материалов уходит (blankCost не участвует, но
 * обнуляем явно, чтобы значение по умолчанию из настроек сюда случайно не
 * просочилось). Дизайна у такой позиции нет: его заводят отдельной суммой
 * по заказу.
 *
 * Для процента от суммы материалов нет вовсе — ни плёнки, ни заготовки.
 */
function freeToSettlement(item: FreePositionSource): SettlementPosition {
  const mode = freePayoutMode(item) as SettlementMode;
  const revenueShare = mode === 'REVENUE_SHARE';
  return {
    pricePosition: item.pricePosition,
    designCost: 0,
    quantity: item.quantity,
    thermalCost: revenueShare ? 0 : item.thermalCost,
    blankCost: 0,
    clientItem: true,
    mode,
    rateBasisPoints: item.partnerRateBasisPoints ?? null,
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
    .filter(isPartnerFreePosition)
    .map(freeToSettlement);
  return [...tshirts, ...prints];
}
