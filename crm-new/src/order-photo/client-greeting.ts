/**
 * Разбор данных для первого сообщения клиенту.
 *
 * Никнейм и имя лежат в заказе не отдельными колонками, а внутри ссылки
 * на переписку и примечания — так их записывает приём заявки. Разбор живёт
 * здесь, рядом с проверками, а не в воркере: если формат записи изменится,
 * тесты упадут в том же репозитории, где его меняли.
 */

/** Правило Telegram: латиница, цифры и подчёркивание, 5–32 знака. */
const USERNAME_RE = /^[A-Za-z0-9_]{4,32}$/;

/**
 * Никнейм из ссылки на переписку.
 *
 * Приём заявки кладёт в `urlCommunication` адрес вида `https://t.me/name`.
 * Возвращаем без «@» и без ссылки — воркеру нужен голый никнейм.
 *
 * Ссылки-приглашения (`t.me/+AbC`, `t.me/joinchat/...`) отбрасываем: это
 * не личный аккаунт, писать туда нечего.
 */
export function telegramUsernameFromUrl(url: string | null): string | null {
  const value = (url ?? '').trim();
  if (!value) return null;

  const match = value.match(
    /^(?:https?:\/\/)?(?:www\.)?t(?:elegram)?\.me\/(?:s\/)?([^/?#]+)/i,
  );
  const raw = (match?.[1] ?? value).replace(/^@/, '').trim();

  if (raw.startsWith('+') || /^joinchat$/i.test(raw)) return null;
  return USERNAME_RE.test(raw) ? raw : null;
}

/**
 * Имя клиента из примечания.
 *
 * Приём заявки пишет строку «Имя: Пётр». Отдельной колонки под имя в заказе
 * нет, а здороваться по имени без неё нельзя. Не нашли — возвращаем null,
 * и воркер обходится без обращения: «Здравствуйте!» лучше, чем
 * «Здравствуйте, undefined!».
 */
export function clientNameFromNote(note: string | null): string | null {
  const line = (note ?? '')
    .split('\n')
    .map((s) => s.trim())
    .find((s) => /^Имя:\s*/i.test(s));
  if (!line) return null;

  const name = line.replace(/^Имя:\s*/i, '').trim();
  // Мусор в имени бывает: люди пишут «///» или один пробел.
  if (!name || name.length > 100 || !/\p{L}/u.test(name)) return null;
  return name;
}

/**
 * Итоги попытки, которые воркер вправе прислать.
 *
 * Список закрытый: свободная строка со временем превратилась бы в свалку
 * из десятка формулировок одного и того же отказа, и по ней нельзя было бы
 * посчитать, сколько клиентов мы не достаём.
 */
export const GREETING_STATUSES = [
  'sent',
  /** Настройки приватности: аккаунт не принимает сообщения от незнакомых. */
  'privacy',
  /** Такого никнейма нет — почти всегда опечатка клиента. */
  'not_found',
  /** Нас заблокировали. */
  'blocked',
  /** Telegram ограничил массовые действия — воркер останавливается сам. */
  'flood',
  /** Прочий отказ площадки. */
  'error',
] as const;

export type GreetingStatus = (typeof GREETING_STATUSES)[number];

export function isGreetingStatus(value: string): value is GreetingStatus {
  return (GREETING_STATUSES as readonly string[]).includes(value);
}
