/** Client delivery and outsourced production are separate stages. */
export interface FulfillmentOrder {
  status: string;
  deliveryMethod: string;
  productCategory: string;
}

export function needsShipmentStatus(order: { deliveryMethod: string }): boolean {
  return order.deliveryMethod !== 'PICKUP';
}

export function fulfillmentError(order: FulfillmentOrder, next: string): string | null {
  if (next === order.status) return null;
  if (order.status === 'PAID' || order.status === 'COMPLETED') {
    return 'Заказ закрыт. Изменение рабочего статуса после расчётов недоступно.';
  }
  const external = order.productCategory === 'CANVAS' || order.productCategory === 'TSHIRT';
  const shipment = needsShipmentStatus(order);
  const ready = ['READY', 'DONE', 'READY_FOR_REVIEW'].includes(order.status);
  if (next === 'SHIPMENT_CREATED') {
    if (!shipment) return 'Для самовывоза отгрузка не нужна. Используйте статус «Готов к выдаче».';
    if (!ready && !(order.status === 'SENT' && !external)) return 'Сначала переведите заказ в «Готов», затем создавайте отгрузку.';
  }
  if (next === 'SENT' && !external) {
    if (shipment && order.status !== 'SHIPMENT_CREATED') return 'Сначала создайте отгрузку, затем переводите заказ в «Отправлен».';
    if (!shipment && !ready) return 'Сначала подготовьте заказ к выдаче, затем отметьте «Выдан клиенту».';
  }
  if (next === 'PAID') {
    if (!external && order.status !== 'SENT') return shipment
      ? 'Сначала переведите заказ в «Отправлен», затем завершайте расчёты.'
      : 'Сначала отметьте «Выдан клиенту», затем завершайте расчёты. Предоплату укажите отдельно.';
    if (external && (shipment ? order.status !== 'SHIPMENT_CREATED' : !ready)) return shipment
      ? 'Сначала создайте клиентскую отгрузку, затем завершайте расчёты.'
      : 'Сначала дождитесь готовности заказа. Предоплату укажите отдельно.';
  }
  return null;
}
