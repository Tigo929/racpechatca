/**
 * Реквизиты бизнеса для сообщений клиенту (подтверждение заказа, готовность).
 *
 * Единый источник правды — раньше телефон/имя/адрес были захардкожены прямо
 * в тексте сообщений внутри OrderDetail. При смене реквизитов меняем только тут.
 */
export const businessConfig = {
  /** Реквизиты для перевода (СБП / ТБанк) */
  payment: {
    phone: '8 916 349 85 15',
    recipient: 'Гулян Тигран Саакович',
    label: 'СБП / ТБанк',
  },
  /** Адрес самовывоза — фото-заказы */
  pickupAddress: 'Измайловский проезд, 6, корп. 1, подъезд 3',
  /** Адрес самовывоза — футболки (другое здание) */
  tshirtPickupAddress: 'ул. Верхняя Первомайская, 47, корп. 11, подъезд 2, 1 этаж, кабинет 116',
  /** Срок изготовления по умолчанию, если дедлайн не задан */
  defaultLeadTime: '3 рабочих дня',
} as const;

/**
 * Персональные адреса самовывоза исполнителей: если заказ ведёт этот
 * исполнитель, клиент забирает заказ по его адресу, а не по основному.
 * Ключ — username в нижнем регистре.
 */
const executorPickupAddresses: Record<string, string> = {
  максим: 'Измайловский проезд, 7к2, подъезд 1',
  maxim: 'Измайловский проезд, 7к2, подъезд 1',
  maksim: 'Измайловский проезд, 7к2, подъезд 1',
};

/** Адрес самовывоза для заказа: адрес исполнителя (если задан) или общий. */
export function resolvePickupAddress(order: {
  productCategory?: string;
  executor?: { username: string } | null;
}): string {
  const executorName = order.executor?.username?.trim().toLowerCase();
  if (executorName && executorPickupAddresses[executorName]) {
    return executorPickupAddresses[executorName];
  }
  return order.productCategory === 'TSHIRT'
    ? businessConfig.tshirtPickupAddress
    : businessConfig.pickupAddress;
}
