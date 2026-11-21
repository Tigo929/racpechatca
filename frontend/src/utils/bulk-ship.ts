/**
 * Какие фотозаказы можно отметить «Отправлен» пачкой.
 *
 * Тот же отбор, что на сервере (crm-new/src/order-photo/bulk-ship.ts),
 * и ответы обязаны совпадать: интерфейс не даёт поставить галочку,
 * сервер не даёт отметить. Почему именно так — там же.
 */

export const BULK_SHIP_LIMIT = 100;

export interface BulkShipCandidate {
  productCategory: string;
  status: string;
  executorId?: string | null;
}

/** Заказ вообще стоит на этом шаге — у такого показываем галочку. */
export function isAwaitingShipment(order: BulkShipCandidate): boolean {
  return order.productCategory === 'PHOTO' && order.status === 'SHIPMENT_CREATED';
}

/** Почему галочку поставить нельзя; null — можно. */
export function bulkShipBlocker(order: BulkShipCandidate): string | null {
  if (order.productCategory !== 'PHOTO') return 'Пачкой отмечаются только заказы фотопечати.';
  if (order.status !== 'SHIPMENT_CREATED') {
    return 'Заказ уже не в «Отгрузка создана» — откройте его и проверьте статус.';
  }
  if (!order.executorId) return 'Не назначен исполнитель — без него не начислится зарплата.';
  return null;
}

/** «3 заказа», «5 заказов» — в кнопке и подтверждении. */
export function ordersWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} заказ`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} заказа`;
  return `${n} заказов`;
}
