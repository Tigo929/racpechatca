import { telegramUsernameFromUrl } from './client-greeting';

/**
 * Telegram покупателя, записанный руками.
 *
 * Менеджер вставляет то, что под рукой: «@name», «name», ссылку из профиля,
 * иногда с пробелами по краям. В заказе это должно лежать в одном виде —
 * иначе один и тот же человек выглядит разными записями, а воркеру,
 * которому нужен голый никнейм, приходится догадываться.
 *
 * Пустая строка — осознанное «убрать»: клиент дал не тот ник, и держать
 * мусор в заказе хуже, чем не держать ничего.
 *
 * Разбор один на весь проект (`telegramUsernameFromUrl`): он же достаёт
 * никнейм из заявок с сайта, и два разных правила «что считать ником»
 * разошлись бы на первой же ссылке-приглашении.
 */
export interface ClientTelegram {
  /** Что писать в заказ: «@name», либо null — стереть запись. */
  stored: string | null;
  /** Голый никнейм для воркера. null, если записи нет. */
  username: string | null;
}

export class ClientTelegramError extends Error {}

/**
 * Привести к хранимому виду или сказать, что это не Telegram.
 *
 * Отбиваем, а не чистим молча: «t.me/+AbCd» — это приглашение в чат, а не
 * аккаунт, и запись такой ссылки означала бы заказ, по которому нажатие
 * «написать» ведёт в пустоту.
 */
export function normalizeClientTelegram(
  value: string | null | undefined,
): ClientTelegram {
  const raw = (value ?? '').trim();
  if (!raw) return { stored: null, username: null };

  const username = telegramUsernameFromUrl(raw);
  if (!username) {
    throw new ClientTelegramError(
      'Не похоже на Telegram покупателя: нужен ник вида @name или ссылка t.me/name. Ссылки-приглашения (t.me/+…) не подходят — это не личный аккаунт.',
    );
  }
  return { stored: `@${username}`, username };
}
