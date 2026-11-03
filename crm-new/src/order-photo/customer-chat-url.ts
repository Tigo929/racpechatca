import { EnumCommunication } from 'src/generated/prisma/enums';
import { ozonChatId } from 'src/approval/ozon-chat';

/**
 * Ссылка на переписку с покупателем — для сообщения владельцу.
 *
 * Просьбу об отзыве отправляет человек, а не CRM: ни Ozon, ни Telegram не
 * дают писать покупателю в один запрос из фона, и в случае площадки это
 * правильно — там переписка модерируется. Поэтому владельцу приходит
 * сообщение с готовым текстом и ссылкой: нажал, вставил, отправил.
 *
 * Ссылка и есть самое хрупкое место. У Авито и Telegram в заказе лежит
 * настоящий адрес диалога, и он работает как есть. У Ozon в том же поле
 * лежит либо ссылка на чат из кабинета, либо просто номер отправления —
 * номер ссылкой быть не может. Раньше такой номер подставлялся в
 * `<a href="…">` как адрес: Telegram показывал его ссылкой, нажатие
 * никуда не вело. Здесь это разделено честно.
 *
 * Ни сети, ни базы — только разбор строки, поэтому правила проверяются
 * тестами целиком.
 */

/** Переписки кабинета Ozon. Без `id` открывается список чатов. */
const OZON_MESSENGER = 'https://seller.ozon.ru/app/messenger';

export interface CustomerChat {
  /** Адрес, по которому откроется диалог. null — открывать нечего. */
  href: string | null;
  /**
   * Что видит человек вместо адреса, когда прямой ссылки нет: по номеру
   * отправления чат находится поиском в списке переписок.
   */
  hint: string | null;
}

/**
 * Куда нажать, чтобы попасть в диалог с этим покупателем.
 *
 * Для Ozon ссылка собирается из `id` чата: именно его кабинет держит в
 * адресе переписки, и он же принимается Seller API. Нет чата — ведём в
 * список переписок и подсказываем номер отправления, по которому диалог
 * ищется. Это хуже прямой ссылки, но честно: человек видит, что искать.
 */
export function customerChat(order: {
  communicationPlatform: EnumCommunication;
  urlCommunication: string | null;
  marketplacePostingNumber?: string | null;
}): CustomerChat {
  const value = (order.urlCommunication ?? '').trim();

  if (order.communicationPlatform === EnumCommunication.OZON) {
    const chatId = ozonChatId(value);
    if (chatId) return { href: `${OZON_MESSENGER}?id=${chatId}`, hint: null };

    const posting = (order.marketplacePostingNumber ?? '').trim() || value;
    return {
      href: OZON_MESSENGER,
      hint: posting ? `найдите чат по отправлению ${posting}` : null,
    };
  }

  // Остальные каналы: в заказе лежит готовый адрес диалога. Проверяем, что
  // это действительно адрес, — иначе ссылка в сообщении никуда не ведёт.
  return /^https?:\/\//i.test(value)
    ? { href: value, hint: null }
    : { href: null, hint: value || null };
}
