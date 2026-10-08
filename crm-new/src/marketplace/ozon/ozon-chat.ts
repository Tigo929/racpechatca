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
