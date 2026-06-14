/**
 * Доменные правила ценообразования заказа — единый источник правды.
 *
 * Раньше сумма заказа считалась в двух местах по-разному:
 *  - utils/caculator-total-price (фото-позиции)
 *  - inline recalcTotal в tshirt-item.service (футболки)
 * Теперь любой пересчёт суммы проходит только через эти функции.
 */

/** Позиция, участвующая в расчёте суммы (фото или футболка). */
export interface PricedItem {
  price: number;
  quantity: number;
  /** Стоимость дизайна/макета — только у футболок, у фото отсутствует. */
  designCost?: number | null;
}

/**
 * Стоимость одной позиции = цена × количество + стоимость дизайна.
 * Используется при создании/обновлении позиции (поле pricePosition).
 */
export function calcItemPricePosition(
  price: number,
  quantity: number,
  designCost = 0,
): number {
  return price * quantity + designCost;
}

/**
 * Итоговая сумма заказа = сумма всех позиций + доставка.
 * Считает из «сырых» полей позиции (price/quantity/designCost),
 * поэтому корректна даже если pricePosition ещё не пересчитан.
 */
export function calcOrderTotal(
  items: PricedItem[],
  deliveryCost: number,
): number {
  const itemsTotal = items.reduce(
    (sum, item) =>
      sum + calcItemPricePosition(item.price, item.quantity, item.designCost ?? 0),
    0,
  );
  return itemsTotal + deliveryCost;
}
