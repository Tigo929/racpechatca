/**
 * Сообщение в общий чат о заявке с сайта.
 *
 * Заявка приходит в CRM молча: пока кто-нибудь не откроет раздел обращений,
 * клиент ждёт. Поэтому бот пишет в общий чат и тегает того, кто обязан
 * ответить, — упоминание в Telegram даёт push даже при заглушенном чате,
 * а сообщение без тега тонет в общей ленте.
 *
 * Кого тегаем: менеджеров по оформлению (их работа — принять обращение),
 * а если ни одного активного нет — админов, чтобы заявка не осталась
 * вообще ничьей.
 */

export interface NotifiableUser {
  username: string;
  telegramUsername: string | null;
  role: string;
  isActive: boolean;
}

export interface LeadForNotification {
  numberOrder: string;
  name?: string | null;
  productName?: string | null;
  quantity?: number | null;
  total?: number | null;
  comment?: string | null;
}

/** Экранируем то, что уйдёт в Markdown-разметку Telegram. */
function escape(text: string): string {
  return text.replace(/([_*`[\]])/g, '\\$1');
}

/** Приводим к виду @username: собаку и лишние пробелы владелец вводит как придётся. */
function toMention(raw: string): string {
  return `@${raw.trim().replace(/^@+/, '')}`;
}

/**
 * Кого упомянуть. Тег работает только если у человека задан telegramUsername:
 * по внутреннему логину CRM Telegram никого не найдёт.
 *
 * `always` — список из настроек: этих тегаем в любом случае, даже если они
 * не менеджеры и вообще не заведены в CRM. Нужен, чтобы владелец видел
 * заявки лично, не назначая себя менеджером по оформлению и не отбирая
 * заявки у того, кто их ведёт.
 */
export function pickLeadResponders(
  users: NotifiableUser[],
  always: string = '',
): string[] {
  const taggable = users.filter(
    (u) => u.isActive && u.telegramUsername && u.telegramUsername.trim(),
  );
  const managers = taggable.filter((u) => u.role === 'ORDER_MANAGER');
  const chosen = managers.length
    ? managers
    : taggable.filter((u) => u.role === 'ADMIN');

  const fromSettings = always
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(toMention);
  const fromUsers = chosen.map((u) => toMention(u.telegramUsername!));

  // Владелец идёт первым: его тег виден в превью уведомления даже когда
  // менеджеров несколько. Повторы убираем — двойной тег выглядит ошибкой.
  return [...new Set([...fromSettings, ...fromUsers])];
}

/** Текст сообщения в общий чат. */
export function buildLeadNotification(
  lead: LeadForNotification,
  mentions: string[],
): string {
  const lines = [
    '🌐 *Новая заявка с сайта*',
    `Заказ: ${escape(lead.numberOrder)}`,
    lead.name ? `Клиент: ${escape(lead.name)}` : null,
    lead.productName ? `Товар: ${escape(lead.productName)}` : null,
    lead.quantity ? `Тираж: ${lead.quantity} шт` : null,
    lead.total ? `Сумма: ${lead.total} ₽` : null,
    lead.comment ? `💬 ${escape(lead.comment)}` : null,
    '',
    // Тег в конце: так он виден в превью уведомления, даже если текст длинный.
    mentions.length
      ? `${mentions.join(' ')} — заявка ваша, ответьте клиенту`
      : '⚠️ Некого тегнуть: ни у кого из менеджеров не заполнен Telegram в CRM',
  ];
  return lines.filter((l) => l !== null).join('\n');
}
