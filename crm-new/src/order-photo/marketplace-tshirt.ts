import type { Prisma } from 'src/generated/prisma/client';

/**
 * Футболка с маркетплейса — отдельный проект внутри CRM.
 *
 * Деньги по такому заказу живут на площадке: цену, комиссию и выплату считает
 * Ozon или Wildberries, а CRM ведёт только производство и макет. Своя
 * экономика здесь не сходится по определению — выручки в CRM нет, а
 * себестоимость есть, — и каждый такой заказ тянул прибыль в минус.
 * Решение владельца (25.09.2026): экономику по ним не считать вовсе, в отчёты
 * и аналитику их не пускать, а вести только счётчик заказов.
 *
 * Правило одно на систему и зеркально продублировано во фронте
 * (frontend/src/utils/marketplace-tshirt.ts): два места, решающие это
 * по-разному, разъехались бы на первом же заказе.
 */

export interface MarketplaceTshirtOrder {
  productCategory: string;
  isMarketplacePrint?: boolean | null;
}

export function isMarketplaceTshirt(order: MarketplaceTshirtOrder): boolean {
  return (
    order.productCategory === 'TSHIRT' && order.isMarketplacePrint === true
  );
}

/**
 * Путь заказа с площадки. Оплаты нет: деньги получает площадка, а не мы.
 * Последний шаг — COMPLETED, в интерфейсе он называется «Отгружен»: заказ
 * отдан площадке, и на этом работа CRM по нему закончена.
 */
export const MARKETPLACE_TSHIRT_FLOW = [
  'LEAD',
  'NEW',
  'APPROVAL_SENT',
  'SENT',
  'IN_PROGRESS',
  'COMPLETED',
] as const;

/** Куда заказу с площадки можно перейти: его путь плюс отмена. */
export function marketplaceTshirtStatusError(
  order: MarketplaceTshirtOrder,
  next: string,
): string | null {
  if (!isMarketplaceTshirt(order)) return null;
  if (next === 'CANCELLED') return null;
  if ((MARKETPLACE_TSHIRT_FLOW as readonly string[]).includes(next))
    return null;
  return 'У заказа с маркетплейса нет этого шага: деньги считает площадка, путь заказа заканчивается на «Отгружен».';
}

/**
 * Условие выборки «всё, кроме футболок с маркетплейса» — для отчётов и
 * аналитики. NOT над двумя полями означает «не (футболка И с площадки)»:
 * футболки с Avito и сайта остаются в отчётах как были.
 */
export const EXCLUDE_MARKETPLACE_TSHIRT: Prisma.OrderPhotoWhereInput = {
  NOT: { productCategory: 'TSHIRT', isMarketplacePrint: true },
};

/** Только футболки с маркетплейса — для счётчика. */
export const ONLY_MARKETPLACE_TSHIRT: Prisma.OrderPhotoWhereInput = {
  productCategory: 'TSHIRT',
  isMarketplacePrint: true,
};
