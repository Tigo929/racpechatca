/**
 * Отметить «Отправлен» сразу у нескольких фотозаказов.
 *
 * Зачем. Посылки сдаются в пункт выдачи пачкой — пять, десять за раз, —
 * а отмечать их приходилось по одной: открыть заказ, нажать, закрыть,
 * следующий. Владелец просил выбрать галочками и отметить разом.
 *
 * Почему только фото и только из «Отгрузка создана». Это единственный
 * шаг, который у фотозаказов действительно совершается пачкой: отгрузки
 * созданы, коробки собраны, их относят вместе. У футболок «Отправлен»
 * значит «передан исполнителю» и ставится сам, когда уходит ТЗ
 * (status-automatic.ts), у холстов отгрузку ведёт подрядчик.
 *
 * Пачка — это не отдельный путь смены статуса. Каждый заказ проходит
 * тот же `updateStatusOrder`, что и кнопка в карточке: те же проверки,
 * начисление зарплаты исполнителю и менеджеру, история статусов,
 * очередь Метрики. Второй реализации «Отправлен» быть не должно —
 * иначе однажды пачка начислит зарплату иначе, чем карточка.
 *
 * Тот же отбор повторён на фронте (frontend/src/utils/bulk-ship.ts):
 * интерфейс не даёт поставить галочку, сервер не даёт отметить.
 */

/** Столько заказов за раз: больше в пункт выдачи не относят, а запрос не тянется минутами. */
export const BULK_SHIP_LIMIT = 100;

export interface BulkShipCandidate {
  productCategory: string;
  status: string;
  executorId?: string | null;
}

/** Почему заказ нельзя отметить пачкой; null — можно. */
export function bulkShipBlocker(order: BulkShipCandidate): string | null {
  if (order.productCategory !== 'PHOTO') {
    return 'Пачкой отмечаются только заказы фотопечати.';
  }
  if (order.status !== 'SHIPMENT_CREATED') {
    return 'Заказ уже не в «Отгрузка создана» — откройте его и проверьте статус.';
  }
  // Та же защита, что в карточке: «Отправлен» начисляет зарплату
  // исполнителю, и без него деньги не достались бы никому.
  if (!order.executorId) {
    return 'Не назначен исполнитель — без него не начислится зарплата.';
  }
  return null;
}

export interface BulkShipItemResult {
  id: string;
  numberOrder: string | null;
  ok: boolean;
  error?: string;
}

export interface BulkShipResult {
  results: BulkShipItemResult[];
  shipped: number;
  failed: number;
}

export function summarizeBulkShip(
  results: BulkShipItemResult[],
): BulkShipResult {
  const shipped = results.filter((r) => r.ok).length;
  return { results, shipped, failed: results.length - shipped };
}
