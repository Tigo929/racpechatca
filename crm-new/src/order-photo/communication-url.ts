import { EnumCommunication } from 'src/generated/prisma/enums';

/**
 * Сборка ссылки на переписку с клиентом. Чистые функции без БД и сети —
 * поэтому полностью покрыты тестами.
 *
 * Telegram: менеджер вводит `@username`, ссылка собирается сама.
 * MAX: менеджер вводит номер телефона — ссылку собираем по шаблону из
 * настроек ({phone} / {phone_plus}), чтобы формат можно было поправить без
 * правки кода. Остальные каналы (Авито, Ozon) — обычная ссылка как есть.
 */

export const DEFAULT_MAX_LINK_TEMPLATE = 'https://max.ru/{phone}';

/**
 * Российский номер к виду `79991234567`. Принимает то, как люди реально
 * пишут: «+7 999 123-45-67», «8 (999) 123-45-67», «9991234567».
 * null — если это не похоже на номер.
 */
export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
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
    return value.startsWith('@') || /^https?:\/\//i.test(value)
      ? null
      : 'Для Telegram укажите @username (должно начинаться с @)';
  }

  if (platform === EnumCommunication.MAX) {
    if (/^https?:\/\//i.test(value)) return null;
    return normalizePhone(value)
      ? null
      : 'Для MAX укажите номер телефона, например +7 999 123-45-67';
  }

  return null;
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
    const phone = normalizePhone(value);
    return phone ? buildMaxUrl(phone, maxLinkTemplate) : value;
  }

  return value;
}
