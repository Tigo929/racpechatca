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
 * Стоимость одной позиции = цена × количество.
 *  - свободная цена (freePrice): сумма = введённой цене, количество НЕ умножается.
 *
 * Дизайн НЕ прибавляется к цене: он уже входит в неё (модель «carve-out»).
 * «Футболка стоит 1500, из них дизайн 400» → клиент платит 1500, а 400 —
 * доля владельца, которую партнёр не делит (см. partner-settlement.ts).
 * designCost оставлен в сигнатуре для совместимости вызовов, но в сумму
 * позиции не входит.
 */
export function calcItemPricePosition(
  price: number,
  quantity: number,
  _designCost = 0,
  freePrice = false,
): number {
  if (freePrice) return price;
  return price * quantity;
}

/**
 * Итоговая сумма заказа = сумма всех позиций + доставка.
 * При freePrice сумма позиции = её цене (количество только для справки).
 */
export function calcOrderTotal(
  items: PricedItem[],
  deliveryCost: number,
  freePrice = false,
): number {
  const itemsTotal = items.reduce(
    (sum, item) =>
      sum +
      calcItemPricePosition(
        item.price,
        item.quantity,
        item.designCost ?? 0,
        freePrice,
      ),
    0,
  );
  return itemsTotal + deliveryCost;
}
