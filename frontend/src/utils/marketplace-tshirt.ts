import type { EnumStatus } from '../types/index';

/**
 * Футболка с маркетплейса — отдельный проект внутри CRM.
 *
 * Тот же вопрос, что и на сервере (crm-new/src/order-photo/marketplace-tshirt.ts),
 * и ответ обязан совпадать. Деньги по такому заказу считает площадка, поэтому
 * в CRM у него нет ни оплаты, ни прибыли, ни места в отчётах — только
 * производство и макет (решение владельца 25.09.2026).
 */

export interface MarketplaceTshirtOrder {
  productCategory: string;
  isMarketplacePrint?: boolean | null;
}

export function isMarketplaceTshirt(order: MarketplaceTshirtOrder): boolean {
  return order.productCategory === 'TSHIRT' && order.isMarketplacePrint === true;
}

/** Путь заказа с площадки: оплаты нет, последний шаг — «Отгружен». */
export const MARKETPLACE_TSHIRT_FLOW: EnumStatus[] = [
  'LEAD',
  'NEW',
  'APPROVAL_SENT',
  'SENT',
  'IN_PROGRESS',
  'COMPLETED',
];

/** Куда заказу с площадки можно перейти: его путь плюс отмена. */
export function marketplaceTshirtStatusError(
  order: MarketplaceTshirtOrder,
  next: string,
): string | null {
  if (!isMarketplaceTshirt(order)) return null;
  if (next === 'CANCELLED') return null;
  if ((MARKETPLACE_TSHIRT_FLOW as string[]).includes(next)) return null;
  return 'У заказа с маркетплейса нет этого шага: деньги считает площадка, путь заказа заканчивается на «Отгружен».';
}

/**
 * Какой шаг пути подсветить у старого заказа, застрявшего в статусе, которого
 * в пути площадки нет («Готов», «Отгрузка создана»). Он показывается как
 * «В работе», и следующей кнопкой остаётся «Отгружен» — иначе заказ висел бы
 * без единой кнопки.
 */
export function marketplaceFlowStatus(status: EnumStatus): EnumStatus {
  return status === 'READY' || status === 'SHIPMENT_CREATED'
    ? 'IN_PROGRESS'
    : status;
}
