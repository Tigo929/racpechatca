import { EnumCommunication } from 'src/generated/prisma/enums';

/**
 * Сборка ссылки на переписку с клиентом. Чистые функции без БД и сети —
 * поэтому полностью покрыты тестами.
 *
 * Telegram: менеджер вводит `@username`, ссылка собирается сама.
 * MAX: менеджер вставляет ссылку на переписку — как у Авито. Собранная из
 * телефона ссылка (`max.ru/79991234567`) открывала не диалог, а профиль по
 * номеру, и менеджер всё равно искал человека в приложении руками. Поэтому
 * контактом служит адрес самого диалога: открыл в MAX, скопировал, вставил.
 * Телефон остался только у заявок с сайта — там клиент оставляет номер, и
 * ссылку по шаблону из настроек собираем мы (см. buildCommunicationUrl).
 * Остальные каналы (Авито, Ozon) — обычная ссылка как есть.
 */

/**
 * Номер отправления Ozon: цифры и дефисы, «0189070451-0031-1».
 * Не URL и не имя — отдельная форма контакта, см. проверку ниже.
 */
const OZON_POSTING_RE = /^[0-9]{4,}(?:-[0-9]+)*$/;

export const DEFAULT_MAX_LINK_TEMPLATE = 'https://max.ru/{phone}';

/**
 * Российский номер к виду `79991234567`. Принимает то, как люди реально
 * пишут: «+7 999 123-45-67», «8 (999) 123-45-67», «9991234567».
 * null — если это не похоже на номер.
 *
 * Нужен заявкам с сайта: там контакт для MAX — это телефон, и другого
 * у нас нет. В CRM менеджер вставляет ссылку на диалог.
 */
export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8'))
    return `7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  // Без кода страны — считаем российским номером.
  if (digits.length === 10) return `7${digits}`;
  return null;
}

/** «79991234567» → «+7 999 123-45-67» для показа человеку. */
export function formatPhoneForDisplay(normalized: string): string {
  if (normalized.length !== 11) return normalized;
  const d = normalized;
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
}

/** Подставляет телефон в шаблон ссылки MAX. */
export function buildMaxUrl(
  normalizedPhone: string,
  template: string = DEFAULT_MAX_LINK_TEMPLATE,
): string {
  const tpl = template?.trim() || DEFAULT_MAX_LINK_TEMPLATE;
  return tpl
    .replace(/\{phone_plus\}/g, `+${normalizedPhone}`)
    .replace(/\{phone\}/g, normalizedPhone);
}

/**
 * Проверка того, что ввёл менеджер. Возвращает текст ошибки или null.
 * Отдельно от сборки ссылки, чтобы модуль не тянул зависимости Nest.
 */
export function validateCommunicationValue(
  platform: EnumCommunication,
  raw: string,
): string | null {
  const value = (raw ?? '').trim();
  if (!value) return 'Укажите контакт клиента';

  if (platform === EnumCommunication.TELEGRAM) {
    return /^@[A-Za-z0-9_]{1,32}$/.test(value) ||
      /^https?:\/\/(?:t\.me|telegram\.me)\/(?:[A-Za-z0-9_]{1,32}|\+\d{7,15})\/?$/i.test(
        value,
      )
      ? null
      : 'Для Telegram укажите @username или ссылку https://t.me/username';
  }

  if (platform === EnumCommunication.MAX) {
    /*
     * Ссылка, а не телефон — как у Авито.
     *
     * Телефон мы принимали и собирали из него `max.ru/<номер>`. Такая
     * ссылка ведёт на профиль по номеру, а не в переписку по заказу:
     * менеджер всё равно открывал MAX и искал диалог руками. Адрес
     * диалога он и так видит в приложении — его и вставляет.
     *
     * Телефон теперь отбиваем с подсказкой, что делать: молча собранная
     * из него ссылка выглядела рабочей и тем сбивала.
     */
    if (/^https?:\/\//i.test(value)) return null;
    return normalizePhone(value)
      ? 'Для MAX нужна ссылка на переписку, а не телефон: откройте диалог в MAX и скопируйте адрес из строки браузера.'
      : 'Для MAX вставьте ссылку на переписку (откройте диалог в MAX и скопируйте адрес).';
  }

  if (platform === EnumCommunication.OZON) {
    if (/^https?:\/\//i.test(value)) return null;
    // Переписки по заказу с Ozon у нас нет: покупатель пишет в кабинет,
    // и ссылки на конкретный чат не существует. Контактом для такого
    // заказа служит номер отправления — по нему заказ находят в кабинете,
    // и именно его знает и покупатель, и склад.
    return OZON_POSTING_RE.test(value)
      ? null
      : 'Для Ozon укажите номер отправления (0189070451-0031-1) или ссылку на кабинет';
  }

  try {
    const url = new URL(value);
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return null;
  } catch {
    /* handled below */
  }
  return 'Укажите полную ссылку на переписку, начинающуюся с https://';
}

/**
 * Итоговая ссылка для сохранения в заказе. Если пользователь уже вставил
 * готовую ссылку (http…), не трогаем — бывает, что ссылку присылают целиком.
 */
export function buildCommunicationUrl(
  platform: EnumCommunication,
  raw: string,
  maxLinkTemplate: string = DEFAULT_MAX_LINK_TEMPLATE,
): string {
  const value = (raw ?? '').trim();

  if (platform === EnumCommunication.TELEGRAM) {
    return value.startsWith('@') ? `https://t.me/${value.slice(1)}` : value;
  }

  if (platform === EnumCommunication.MAX) {
    if (/^https?:\/\//i.test(value)) return value;
    /*
     * Телефон → ссылка по шаблону. Остаётся для заявок с сайта: там клиент
     * оставляет номер, и ничего другого у нас нет. Из CRM сюда телефон уже
     * не доходит — проверка контакта требует ссылку на переписку.
     */
    const phone = normalizePhone(value);
    return phone ? buildMaxUrl(phone, maxLinkTemplate) : value;
  }

  return value;
}
