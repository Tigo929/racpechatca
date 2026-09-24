/**
 * Итог заказа и скидка клиенту.
 *
 * Формула суммы жила в четырёх местах: создание заказа, правка заказа и два
 * пересчёта при изменении позиций. Пока слагаемых было четыре, это сходило
 * с рук; со скидкой разъехалось бы обязательно — где-то её забыли бы вычесть,
 * и заказ показывал бы клиенту одну сумму, а в отчёте давал другую. Поэтому
 * формула здесь одна.
 *
 * Скидка — в рублях, решение владельца по конкретному клиенту. Она уменьшает
 * и чек, и базу зарплаты: исполнитель получает процент уже от суммы со
 * скидкой (решение владельца 24.09.2026). Поэтому вычитается она до всех
 * расчётов, а не показывается отдельной строкой «для красоты».
 */

export interface OrderTotalParts {
  /** Позиции: фото + футболки + холсты, по pricePosition. */
  positionsTotal: number;
  deliveryCost: number;
  designDevelopmentCost: number;
  urgencyFee: number;
  /** Скидка клиенту, ₽. */
  discountAmount: number;
}

/**
 * Сколько максимум можно скинуть.
 *
 * Скидка не трогает доставку и плату за срочность: доставку мы платим
 * перевозчику живыми деньгами, а срочность — плата за скорость, и «скидка
 * на срочность» означала бы просто её отсутствие. Поэтому потолок — товар
 * и дизайн, то есть ровно та часть чека, из которой считается зарплата.
 *
 * Побочное следствие важнее самого правила: база зарплаты (чек минус
 * доставка минус срочность) никогда не уходит в минус, и расчёт с
 * исполнителем не падает на закрытии заказа.
 */
export function maxOrderDiscount(
  parts: Pick<OrderTotalParts, 'positionsTotal' | 'designDevelopmentCost'>,
): number {
  return Math.max(0, parts.positionsTotal + parts.designDevelopmentCost);
}

/**
 * Скидка, приведённая к допустимой: не меньше нуля и не больше потолка.
 *
 * Обрезаем, а не отказываем, потому что позиции заказа правят уже после
 * того, как скидка назначена: убрали холст из заказа — скидка в 1 000 ₽
 * может оказаться больше остатка. Отказ означал бы «сначала снимите
 * скидку, потом правьте», то есть лишний круг на ровном месте.
 */
export function clampOrderDiscount(
  discountAmount: number | null | undefined,
  parts: Pick<OrderTotalParts, 'positionsTotal' | 'designDevelopmentCost'>,
): number {
  // Заказы, заведённые до появления скидки, приходят без неё вовсе. Пустота
  // здесь означает «скидки нет», а не «считать нечем»: NaN в сумме заказа
  // хуже любой ошибки — он тихо ломает и чек, и зарплату.
  const value = Number.isFinite(discountAmount)
    ? Math.round(Number(discountAmount))
    : 0;
  const max = maxOrderDiscount(parts);
  return Math.min(Math.max(0, value), max);
}

/** Сумма заказа: позиции + доставка + дизайн + срочность − скидка. */
export function orderTotal(parts: OrderTotalParts): number {
  return (
    parts.positionsTotal +
    parts.deliveryCost +
    parts.designDevelopmentCost +
    parts.urgencyFee -
    clampOrderDiscount(parts.discountAmount, parts)
  );
}
