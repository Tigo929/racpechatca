import type { OzonOrderGroup } from './ozon-order-status';

/**
 * Какие состояния отправления на площадке значат «посылка уехала».
 *
 * Закрываем заказ CRM, только когда Ozon подтвердил отгрузку: до этого
 * момента работа может вернуться к нам — отправление отменяют, переносят,
 * возвращают в сборку. Закрытый заказ ушёл бы из списка активных, и
 * вернувшуюся работу никто бы не заметил.
 *
 * «Ждёт отгрузки» сюда не входит намеренно: в этом состоянии посылка ещё
 * лежит у нас на столе.
 */
const SHIPPED_GROUPS: ReadonlySet<string> = new Set<OzonOrderGroup>([
  'in_transit',
  'delivered',
]);

/**
 * Статусы заказа CRM, из которых его можно закрыть автоматически.
 *
 * Отменённый не трогаем: его закрыл человек, и спорить с ним автоматике
 * нечем. Уже завершённый пропускаем — закрывать нечего.
 */
const CLOSABLE: ReadonlySet<string> = new Set([
  'LEAD',
  'NEW',
  'APPROVAL_SENT',
  'SENT',
  'IN_PROGRESS',
  'READY',
  'SHIPMENT_CREATED',
  'DONE',
]);

export interface ShippedCandidate {
  /** Статус заказа в CRM. */
  status: string;
  /** Группа состояния отправления на площадке; пусто — отправление не нашли. */
  marketplaceGroup?: string | null;
}

/**
 * Пора ли закрывать заказ CRM.
 *
 * Отдельная функция, а не условие внутри воркера, потому что ошибка здесь
 * тихая: лишнее «да» закроет заказ, который ещё в работе, и он пропадёт из
 * списка активных. Такое проверяется тестами, а не глазами в логе.
 */
export function shouldCloseAsShipped(order: ShippedCandidate): boolean {
  if (!order.marketplaceGroup) return false;
  if (!SHIPPED_GROUPS.has(order.marketplaceGroup)) return false;
  return CLOSABLE.has(order.status);
}
