/**
 * Поиск отправления в списке заказов Ozon.
 *
 * Искать приходится по тому, что человек держит перед глазами, а это
 * каждый раз разное: номер отправления из кабинета, номер заказа Ozon из
 * письма, наш номер CRM из переписки с печатником, ссылка на чат или ник
 * клиента в Telegram, если он написал напрямую. Отдельного поля под
 * каждый случай не нужно — одна строка, которая принимает любое из них.
 *
 * Номера люди переносят по-разному: с дефисами и без, со ссылкой целиком
 * и без схемы, с «собакой» и без. Поэтому сравниваем не буквально:
 * ссылки и ники приводим к голому виду, а у номеров сверяем ещё и одни
 * цифры — «888703560049» должно находить «88870356-0049».
 */

export interface SearchableOzonOrder {
  postingNumber: string;
  orderNumber: string;
  crm?: {
    numberOrder: string;
    /** Переписка по заказу: чат Ozon или номер отправления. */
    urlCommunication?: string | null;
    /** Ник клиента в Telegram, если он писал напрямую. */
    clientTelegram?: string | null;
  } | null;
}

/** Ссылка на Telegram в любом из написаний, которыми её переносят. */
const TELEGRAM_LINK = /^(?:www\.)?(?:t\.me|telegram\.me)\//;

/** Голый вид строки: без схемы, домена Telegram, «собаки» и регистра. */
export function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(TELEGRAM_LINK, '')
    .replace(/^@/, '')
    .trim();
}

const digitsOnly = (value: string): string => value.replace(/\D+/g, '');

/** Всё, по чему ищем это отправление. */
export function searchFields(order: SearchableOzonOrder): string[] {
  return [
    order.postingNumber,
    order.orderNumber,
    order.crm?.numberOrder ?? '',
    order.crm?.urlCommunication ?? '',
    order.crm?.clientTelegram ?? '',
  ].filter(Boolean);
}

/**
 * Подходит ли отправление под запрос. Пустой запрос подходит всем:
 * пустая строка поиска не должна прятать список.
 */
export function matchesOzonOrder(
  order: SearchableOzonOrder,
  query: string,
): boolean {
  const needle = normalizeSearch(query);
  if (!needle) return true;

  const needleDigits = digitsOnly(needle);
  return searchFields(order).some((field) => {
    const value = normalizeSearch(field);
    if (value.includes(needle)) return true;
    /*
     * Сверка по одним цифрам — для номеров, набранных без дефисов.
     * Короткие обрывки так не сверяем: «12» нашлось бы почти везде и
     * превратило бы поиск в случайную выборку.
     */
    return needleDigits.length >= 4 && digitsOnly(value).includes(needleDigits);
  });
}
