/**
 * Статусы FBS-отправлений Ozon и их группировка для интерфейса.
 *
 * Сырых статусов у Ozon больше десятка, и по отдельности они мало что
 * говорят оператору. Работа же сводится к одному вопросу: «что горит».
 * Поэтому статусы сведены в пять групп, а внутри группы «нужно отгрузить»
 * заказы ранжируются по сроку отгрузки — именно его нарушение стоит денег.
 */

export type OzonOrderGroup =
  | 'to_ship'
  | 'in_transit'
  | 'delivered'
  | 'problem'
  | 'cancelled';

/**
 * Сырой статус → группа. Список статусов взят из документации Ozon и сверен
 * с живым кабинетом (awaiting_deliver, delivered, cancelled встречались).
 * Незнакомый статус попадает в «проблемные»: лучше показать оператору
 * непонятный заказ, чем спрятать его из всех списков.
 */
const GROUP_BY_STATUS: Record<string, OzonOrderGroup> = {
  acceptance_in_progress: 'to_ship',
  awaiting_approve: 'to_ship',
  awaiting_packaging: 'to_ship',
  awaiting_registration: 'to_ship',
  awaiting_deliver: 'to_ship',

  sent_by_seller: 'in_transit',
  driver_pickup: 'in_transit',
  delivering: 'in_transit',

  delivered: 'delivered',

  arbitration: 'problem',
  client_arbitration: 'problem',
  not_accepted: 'problem',

  cancelled: 'cancelled',
};

export function groupForStatus(status: string): OzonOrderGroup {
  return GROUP_BY_STATUS[status] ?? 'problem';
}

/** Человеческие подписи сырых статусов Ozon. */
export const STATUS_LABELS: Record<string, string> = {
  acceptance_in_progress: 'Идёт приёмка',
  awaiting_approve: 'Ждёт подтверждения',
  awaiting_packaging: 'Ждёт упаковки',
  awaiting_registration: 'Ждёт регистрации',
  awaiting_deliver: 'Ждёт отгрузки',
  sent_by_seller: 'Отправлен продавцом',
  driver_pickup: 'У водителя',
  delivering: 'В доставке',
  delivered: 'Доставлен',
  arbitration: 'Арбитраж',
  client_arbitration: 'Клиентский арбитраж',
  not_accepted: 'Не принят на сортировке',
  cancelled: 'Отменён',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Просрочена ли отгрузка. Считается только для группы «нужно отгрузить»:
 * у доставленного заказа прошедший срок отгрузки — норма, а не проблема.
 */
export function isShipmentOverdue(
  group: OzonOrderGroup,
  shipmentDate: string | null,
  now: Date = new Date(),
): boolean {
  if (group !== 'to_ship' || !shipmentDate) return false;
  const deadline = new Date(shipmentDate);
  if (Number.isNaN(deadline.getTime())) return false;
  return deadline.getTime() < now.getTime();
}
