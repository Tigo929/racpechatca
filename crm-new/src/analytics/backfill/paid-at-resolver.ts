/**
 * Дата первой оплаты из истории статусов.
 *
 * `StatusHistory` пишет каждый переход с 14.06.2026. Первый переход
 * в PAID и есть дата оплаты — та, которую `clientPaidAt` стал бы хранить,
 * если бы его заполняли с самого начала (см. `order-photo/paid-at.ts`).
 *
 * Берём именно первый, а не последний: один заказ в базе оплачивался
 * дважды (вернули в работу и снова закрыли), и деньги в первый раз
 * пришли раньше. Текущий `statusChangedAt` не подходит вовсе — он
 * дёргается любой сменой статуса и у заказа в COMPLETED показывает дату
 * завершения, не оплаты.
 *
 * Нет перехода — нет даты. Заказы, оплаченные до появления истории
 * (16 штук в статусах PAID и позже без строки в StatusHistory), остаются
 * с null: дата, которой нет в данных, не выдумывается.
 */

export interface StatusTransition {
  toStatus: string;
  createdAt: Date;
}

export function resolveFirstPaidAt(history: readonly StatusTransition[]): Date | null {
  let first: Date | null = null;
  for (const row of history) {
    if (row.toStatus !== 'PAID') continue;
    if (first === null || row.createdAt < first) first = row.createdAt;
  }
  return first;
}
