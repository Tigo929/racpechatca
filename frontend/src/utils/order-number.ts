/**
 * Каким номером называют заказ.
 *
 * Тот же вопрос, что и на сервере (crm-new/src/order-photo/order-number.ts),
 * и ответ обязан совпадать: заказ с маркетплейса живёт под номером площадки
 * — им он открыт в кабинете Ozon и им подписан лист согласования, который
 * видит покупатель. Внутренний номер CRM никуда не девается: на нём держатся
 * зарплата, задачи и отчёты, и в карточке он остаётся на виду.
 *
 * Правило здесь одно на весь интерфейс: список, карточка и согласование
 * называют заказ одинаково. Иначе сотрудник ищет в списке номер, которого
 * там нет.
 */

export interface OrderNumbers {
  numberOrder: string;
  marketplaceOrderNumber?: string | null;
}

/** Номер площадки, если он задан и не пустой. */
export function marketplaceNumber(order: OrderNumbers): string | null {
  const value = (order.marketplaceOrderNumber ?? '').trim();
  return value ? value : null;
}

/** Номер, которым заказ называют людям. */
export function displayOrderNumber(order: OrderNumbers): string {
  return marketplaceNumber(order) ?? order.numberOrder;
}
