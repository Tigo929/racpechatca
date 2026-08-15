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
  /**
   * Холсты печатает подрядчик, и забирают их у него же — в Балашихе, а не
   * в Москве. Свой график: будни 10:00–19:00, выходные закрыто.
   */
  canvasPickup: {
    address: 'Балашиха, улица Поповка, 7',
    hours: 'будни 10:00–19:00, выходные — выходной',
    leadTime: '1–2 дня',
  },
  /** Срок изготовления по умолчанию, если дедлайн не задан */
  defaultLeadTime: '3 рабочих дня',
} as const;

/**
 * Персональные адреса самовывоза исполнителей: если заказ ведёт этот
 * исполнитель, клиент забирает заказ по его адресу, а не по основному.
 * Ключ — username в нижнем регистре.
 */
/**
 * Номер заказа для сообщения клиенту. В Telegram текст в обратных кавычках
 * становится моноширинным, а такой блок копируется одним нажатием — так же
 * удобно, как телефон для перевода (его Telegram подсвечивает сам).
 * В каналах без разметки (Авито, Ozon, MAX) кавычки показались бы как есть,
 * поэтому там номер остаётся обычным текстом.
 */
export function formatOrderNumberForClient(order: {
  numberOrder: string;
  communicationPlatform?: string;
}): string {
  return order.communicationPlatform === 'TELEGRAM'
    ? `\`${order.numberOrder}\``
    : order.numberOrder;
}

const izmailovskySevenPickupAddress = 'Измайловский проезд, 7к2, подъезд 1';

/**
 * Исполнители, чьи клиенты забирают заказ по адресу «Измайловский 7к2».
 * Логин в базе пишут по-разному — «Maxim_Kuzmin» (латиница с подчёркиванием),
 * «Максим Кузьмин», «Самогов», — поэтому сверяем не строкой целиком, а набором
 * частей имени: правило срабатывает, если логин содержит все части набора.
 */
const izmailovskySevenExecutors: readonly (readonly string[])[] = [
  ['максим', 'кузьмин'],
  ['maxim', 'kuzmin'],
  ['maksim', 'kuzmin'],
  ['самогов'],
  ['samogov'],
];

/** Логины целиком (в нормализованном виде) → персональный адрес. */
const executorPickupAddresses: Record<string, string> = {
  максим: izmailovskySevenPickupAddress,
  maxim: izmailovskySevenPickupAddress,
  maksim: izmailovskySevenPickupAddress,
};

/**
 * Логин к сравнимому виду: нижний регистр, а разделители (пробел, `_`, `-`, `.`)
 * — к одному пробелу. Без этого «Maxim_Kuzmin» не совпадал ни с одним правилом
 * и клиент получал общий адрес вместо адреса исполнителя.
 */
function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[\s_\-.]+/g, ' ').trim();
}

/**
 * Адрес самовывоза для заказа.
 *
 * Возвращает null, когда адрес называть рано: по фотозаказам забирают
 * у исполнителя, а пока он не назначен — неизвестно, у какого именно.
 * Раньше в таком случае подставлялся общий адрес, клиент ехал не туда,
 * и разбираться приходилось уже на месте.
 *
 * Холсты забирают у подрядчика в Балашихе — там адрес известен всегда.
 */
export function resolvePickupAddress(order: {
  productCategory?: string;
  executor?: { username: string } | null;
}): string | null {
  if (order.productCategory === 'CANVAS') {
    return businessConfig.canvasPickup.address;
  }
  const executorName = normalizeUsername(order.executor?.username ?? '');
  if (executorName) {
    const matched = izmailovskySevenExecutors.some((parts) =>
      parts.every((part) => executorName.includes(part)),
    );
    if (matched) {
      return izmailovskySevenPickupAddress;
    }
    if (executorPickupAddresses[executorName]) {
      return executorPickupAddresses[executorName];
    }
  }
  if (order.productCategory === 'TSHIRT') {
    return businessConfig.tshirtPickupAddress;
  }
  // Фото без исполнителя: адреса ещё нет, и выдумывать его нельзя.
  return null;
}
