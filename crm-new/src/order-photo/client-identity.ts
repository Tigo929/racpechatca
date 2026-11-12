import { approvalRecipient } from 'src/approval/approval-delivery-state';

/**
 * Кто перед нами — один и тот же человек в разных заказах.
 *
 * Карточки клиента в CRM нет: каждый заказ живёт сам по себе. Пока речь шла
 * о производстве, этого хватало. С отзывами перестало: постоянный заказчик
 * получал просьбу «оставьте отзыв» после каждой покупки, хотя отзыв он уже
 * оставил — первый раз это вежливость, третий выглядит как рассылка.
 *
 * Опознаём по способу связи: другого следа клиента у нас нет. Ключ строится
 * из того адреса, по которому мы с человеком и разговариваем, — ник в
 * Telegram, номер в MAX, диалог на Авито. Совпал ключ — тот же человек.
 *
 * Чего ключ не умеет и не притворяется, что умеет:
 *
 * • Покупателя Ozon без Telegram опознать нечем. Ссылка на чат кабинета
 *   своя у каждого отправления, идентификатор покупателя площадка нам не
 *   отдаёт. Такой заказ остаётся сам по себе — как было до этого правила.
 * • Один человек с двумя разными каналами (писал в Telegram, потом с Авито)
 *   посчитается двумя. Угадывать «наверное, это он же» мы не будем: цена
 *   ошибки — промолчать там, где стоило спросить.
 *
 * Возвращается именно строка-ключ, а не признак «это такой-то клиент»:
 * сравнивать ключи можно, а показывать их человеку незачем — в них лежат
 * его контактные данные.
 */

/** Нормализованный телефон: 8… и 7… — один и тот же номер. */
function phoneKey(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const tail = digits.slice(-10);
  return `7${tail}`;
}

/** Идентификатор диалога Авито из ссылки на переписку. */
function avitoChatKey(value: string): string | null {
  const match =
    /avito\.ru\/[^\s]*?(?:messenger|chat)\/[^\s/?#]*?([\w-]{6,})/i.exec(value);
  return match ? match[1].toLowerCase() : null;
}

export interface ClientIdentitySource {
  communicationPlatform?: string | null;
  urlCommunication?: string | null;
  clientTelegram?: string | null;
}

export function clientIdentity(order: ClientIdentitySource): string | null {
  /*
   * Ник в Telegram сильнее способа связи заказа. Покупатель с площадки
   * часто пишет нам в Telegram, и тогда это он же — тот самый человек,
   * которому мы писали в прошлый раз, даже если прошлый заказ был с сайта.
   */
  const nick =
    approvalRecipient(order.clientTelegram ?? null) ??
    (order.communicationPlatform === 'TELEGRAM'
      ? approvalRecipient(order.urlCommunication ?? null)
      : null);
  if (nick) return `tg:${nick.toLowerCase()}`;

  const url = (order.urlCommunication ?? '').trim();
  if (!url) return null;

  if (order.communicationPlatform === 'MAX') {
    const phone = phoneKey(url);
    return phone ? `max:${phone}` : null;
  }

  if (order.communicationPlatform === 'AVITO') {
    const chat = avitoChatKey(url);
    return chat ? `avito:${chat}` : null;
  }

  // Ozon и всё остальное: опознавать нечем — см. комментарий выше.
  return null;
}

/**
 * Писали ли мы этому человеку про отзыв раньше.
 *
 * Считается «писали», если по любому его прошлому заказу отзыв уже оставлен
 * или просьба уже отправлена. Второй случай важен не меньше первого: человек
 * мог просьбу прочитать и ничего не написать — это его право, и напоминать
 * ему о том же при следующей покупке не нужно.
 */
export function alreadyAskedIdentities(
  pastOrders: (ClientIdentitySource & {
    clientReviewLeft?: boolean | null;
    reviewRequestSentAt?: Date | null;
  })[],
): Set<string> {
  const keys = new Set<string>();
  for (const order of pastOrders) {
    if (!order.clientReviewLeft && !order.reviewRequestSentAt) continue;
    const key = clientIdentity(order);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Отбор заказов, по которым просьбу об отзыве отправлять не нужно.
 *
 * Отдельной функцией, потому что мест два: напоминание владельцу и
 * автоматическая отправка. Одно и то же правило, написанное в обоих,
 * разошлось бы при первой же правке — и клиент получил бы просьбу из
 * того канала, который забыли поправить.
 */
export function skipAlreadyAsked<T extends ClientIdentitySource>(
  candidates: T[],
  asked: Set<string>,
): T[] {
  return candidates.filter((order) => {
    const key = clientIdentity(order);
    return !key || !asked.has(key);
  });
}
