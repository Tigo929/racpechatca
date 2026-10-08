/**
 * Ссылка на чат с покупателем Ozon.
 *
 * Чат живёт в кабинете площадки, и адрес его страницы API не сообщает:
 * оно отдаёт только идентификатор. Поэтому адрес собирается здесь по
 * шаблону — и шаблон вынесен в окружение. Если Ozon поменяет адрес
 * кабинета, это правка одной переменной и перезапуск, а не релиз.
 *
 * Идентификатор сохраняется в самой ссылке: по нему её всегда можно
 * собрать заново, даже если шаблон окажется неверным.
 */

/*
 * Шаблон по умолчанию. Документация Ozon адрес страницы чата не описывает,
 * и проверить его можно только в самом кабинете — поэтому он и вынесен
 * в переменную окружения: ошибка здесь чинится настройкой, а не релизом.
 */
export const OZON_CHAT_URL_TEMPLATE = 'https://seller.ozon.ru/app/chat/{chatId}';

/** Переменная окружения с шаблоном — на случай смены адреса кабинета. */
export const OZON_CHAT_URL_ENV = 'OZON_CHAT_URL_TEMPLATE';

/**
 * Собрать адрес чата. Пустой или мусорный идентификатор — null: лучше
 * никакой ссылки, чем ссылка в никуда, по которой оператор будет гадать,
 * чат удалён или ошибка у нас.
 */
export function ozonChatUrl(
  chatId: string | null | undefined,
  template: string = OZON_CHAT_URL_TEMPLATE,
): string | null {
  const id = (chatId ?? '').trim();
  if (!id) return null;
  // Идентификатор уходит в адрес: допускаем только то, из чего Ozon их
  // делает (uuid), иначе чужая строка подставилась бы в ссылку как есть.
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return null;
  const pattern = template.includes('{chatId}')
    ? template
    : OZON_CHAT_URL_TEMPLATE;
  return pattern.replace('{chatId}', id);
}

/** Ответ Ozon на создание чата. */
export interface OzonChatStartResponse {
  result?: { chat_id?: string } | null;
}

/** Чат из списка /v3/chat/list. */
export interface OzonChatListItem {
  chat?: {
    chat_id?: string;
    chat_type?: string;
    chat_status?: string;
    created_at?: string;
  } | null;
}

/** Сообщение из /v3/chat/history. */
export interface OzonChatMessage {
  /** Строки сообщения; у первого в заказном чате это номер отправления. */
  data?: string[] | null;
  /** Контекст Ozon: номер заказа, к которому относится переписка. */
  context?: { order_number?: string; sku?: string } | null;
}

/**
 * Номер заказа по номеру отправления: «48866017-0495-1» → «48866017-0495».
 *
 * Чат на площадке привязан к заказу, а не к отправлению: в заказе из двух
 * товаров отправлений два, а переписка одна. Поэтому ищем по заказу.
 */
export function postingOrderNumber(postingNumber: string): string {
  const parts = (postingNumber ?? '').trim().split('-');
  return parts.length > 2 ? parts.slice(0, -1).join('-') : parts.join('-');
}

/**
 * Эта ли переписка относится к отправлению.
 *
 * Сверяем двумя способами, потому что Ozon кладёт связь в оба места:
 * в контекст сообщения — номер заказа, а первой строкой заказного чата —
 * номер отправления. Одного поля мало: у части сообщений контекст пуст.
 */
export function chatMatchesPosting(
  messages: readonly OzonChatMessage[] | null | undefined,
  postingNumber: string,
): boolean {
  const posting = (postingNumber ?? '').trim();
  if (!posting) return false;
  const order = postingOrderNumber(posting);
  return (messages ?? []).some((message) => {
    if ((message.context?.order_number ?? '').trim() === order) return true;
    return (message.data ?? []).some((line) => (line ?? '').trim() === posting);
  });
}

/**
 * Отказ площадки из-за подписки, а не из-за ключей.
 *
 * Ozon отвечает на создание чата 403 с текстом про Premium Plus. Наш общий
 * разбор ошибок переводит 403 как «проверьте ключи» — и это сбивает с толку:
 * ключ в порядке, остальные методы им работают. Поэтому такой ответ узнаём
 * отдельно и говорим правду.
 */
export function isPremiumRequired(ozonMessage: string | undefined): boolean {
  return /premium/i.test(ozonMessage ?? '');
}

export const PREMIUM_REQUIRED_MESSAGE =
  'Покупатель вам ещё не писал, а открыть чат первыми Ozon не даёт: ' +
  'создание чата доступно только с подпиской Premium Plus. ' +
  'Когда покупатель напишет, нажмите кнопку снова — ссылка подтянется.';

/**
 * Можно ли открыть чат по отправлению: площадка перечисляет доступные
 * действия сама. Спрашиваем её, а не угадываем — у доставленного месяц
 * назад заказа чат уже не открыть, и ошибку от Ozon оператор увидеть
 * не должен.
 */
export function canCreateChat(
  availableActions: readonly string[] | null | undefined,
): boolean {
  return (availableActions ?? []).includes('can_create_chat');
}
