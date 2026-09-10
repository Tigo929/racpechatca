/**
 * Бесплатная доставка от порога.
 *
 * Правило простое, а последствие ошибки — нет: сайт показывает клиенту
 * итоговую сумму до отправки заявки, и если CRM посчитает доставку иначе,
 * человек увидит в подтверждении не то число, которое ему называли. Такое
 * запоминается надолго и разбирается вручную.
 *
 * ВАЖНО: порог обязан совпадать с тем, что показывает сайт
 * (`site.delivery.freeFrom` в web-photo). Числа лежат в двух местах, потому
 * что сайт не спрашивает CRM о доставке при отрисовке карточки товара.
 * Меняются они только вместе.
 */

/** С какой суммы позиций доставка бесплатна, ₽. */
export const FREE_DELIVERY_FROM = 1200;

/**
 * Сколько стоит доставка этому заказу.
 *
 * Считается от суммы позиций, а не от итога с доставкой: иначе доплата
 * сама себя проталкивала бы через порог.
 */
export function leadDeliveryCost(params: {
  yandexPvz: boolean;
  /** Сумма позиций заказа, без доставки. */
  positionsTotal: number;
  /** Цена доставки из настроек CRM. */
  price: number;
  freeFrom?: number;
}): number {
  if (!params.yandexPvz) return 0;
  const freeFrom = params.freeFrom ?? FREE_DELIVERY_FROM;
  if (freeFrom > 0 && params.positionsTotal >= freeFrom) return 0;
  return Math.max(0, Math.trunc(params.price));
}
