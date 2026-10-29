import { isMarketplaceTshirt, type MarketplaceTshirtOrder } from './marketplace-tshirt';

/**
 * Статусы, которые система ставит сама — и поэтому руками не ставятся.
 *
 * Тот же вопрос, что и на сервере (crm-new/src/order-photo/status-automatic.ts),
 * и ответ обязан совпадать: сервер не пускает, интерфейс гасит кнопку. Если
 * они разойдутся, человек будет щёлкать по доступной на вид кнопке и
 * получать отказ — худший из двух вариантов.
 *
 * Эти три шага и раньше проставлялись автоматически, но оставались
 * кликабельными, и нажать их мышкой было проще, чем сделать то, что они
 * означают. Статус переставал быть фактом и становился намерением.
 */

export function automaticStatusError(
  order: MarketplaceTshirtOrder,
  next: string,
): string | null {
  const isTshirt = order.productCategory === 'TSHIRT';

  if (isTshirt && next === 'SENT') {
    return 'Ставится сам, когда заказ уходит исполнителю: прикрепите ТЗ-фото и нажмите «Отправить ТЗ исполнителю».';
  }
  if (isTshirt && next === 'IN_PROGRESS') {
    return 'Ставит исполнитель — кнопкой «В работе» в задании, которое пришло ему в Telegram.';
  }
  if (isMarketplaceTshirt(order) && next === 'COMPLETED') {
    return 'Ставится сам, когда Ozon отметит, что посылка уехала.';
  }
  return null;
}
