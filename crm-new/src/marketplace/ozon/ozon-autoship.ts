import type { OzonOrderGroup } from './ozon-order-status';

/**
 * Пора ли отправить отправление на сборку в кабинет площадки.
 *
 * «Передан в производство» в CRM и «Собрать» в Seller — одно решение,
 * принимаемое дважды: сначала в CRM, потом руками в кабинете. Второе
 * забывается, и отправление висит в «ждёт отгрузки», пока не сгорит срок
 * отгрузки — а это уже деньги и рейтинг продавца.
 *
 * Правило живёт отдельной функцией, а не условием внутри сервиса, потому
 * что ошибка здесь не тихая, а необратимая: сборку в Ozon не отменить.
 * Лишнее «да» означает, что площадка считает посылку собранной, а футболка
 * ещё не напечатана, — и срок начинает идти против нас.
 */

/**
 * Статус CRM, означающий «печать отдана, посылку можно собирать».
 *
 * Ровно один, а не список. У маркетплейсного заказа SENT и значит «передан
 * в производство» — тот самый момент, который владелец и называет. Брать
 * статусы «после» нельзя: заказ попадает в них и нашей автоматикой
 * (COMPLETED ставит сверка с площадкой уже по факту отгрузки), и тогда
 * правило срабатывало бы на том, что площадка и так сделала.
 */
const SHIPPABLE_STATUS = 'SENT';

/**
 * Состояние отправления, из которого сборка возможна.
 *
 * Только «ждёт отгрузки». Везут, доставлено, отменено, арбитраж — сборка
 * там либо невозможна, либо бессмысленна, и попытка вернула бы отказ.
 */
const SHIPPABLE_GROUP: OzonOrderGroup = 'to_ship';

export interface AutoshipCandidate {
  /** Статус заказа в CRM. */
  status: string;
  /** Уже пробовали отправить на сборку (успешно или с отказом). */
  marketplaceShipRequestedAt?: Date | null;
  /** Группа состояния отправления; пусто — отправление не нашли. */
  marketplaceGroup?: string | null;
  /** Позиции отправления: без них нечего класть в упаковку. */
  items?: { sku: string | null; quantity: number }[];
}

export function shouldShipToAssembly(order: AutoshipCandidate): boolean {
  if (order.marketplaceShipRequestedAt) return false;
  if (order.status !== SHIPPABLE_STATUS) return false;
  if (order.marketplaceGroup !== SHIPPABLE_GROUP) return false;
  // Упаковка описывается позициями. Отправление без них — либо ответ
  // площадки не разобрался, либо это не наш товар: не угадываем.
  return packageProducts(order.items ?? []).length > 0;
}

/**
 * Позиции для одной упаковки в том виде, в каком их ждёт Ozon.
 *
 * Собираем всё отправление одной упаковкой: мы и правда кладём заказ в
 * одну коробку. Делить на несколько посылок — отдельное решение склада, и
 * автоматика его принимать не должна.
 *
 * `product_id` у метода сборки — это sku позиции отправления, а не наш
 * артикул. Позиция без sku выбрасывается: подставить вместо него offer_id
 * значило бы собрать не тот товар.
 */
export function packageProducts(
  items: { sku: string | null; quantity: number }[],
): { product_id: number; quantity: number }[] {
  const products: { product_id: number; quantity: number }[] = [];
  for (const item of items) {
    const sku = Number(item.sku);
    if (!Number.isSafeInteger(sku) || sku <= 0) continue;
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) continue;
    products.push({ product_id: sku, quantity: item.quantity });
  }
  return products;
}
