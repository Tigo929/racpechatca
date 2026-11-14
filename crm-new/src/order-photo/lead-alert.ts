/**
 * Очередь уведомлений о заявках: когда повторять и что дописать к тексту.
 *
 * Почему уведомление вообще стоит в очереди. Telegram с боевого сервера
 * доступен только через посредника: имя api.telegram.org фильтруется по
 * пути, и прямой запрос просто не доходит. Посредник — чужая машина, и
 * когда она перестаёт отвечать, бот молчит сутками. Раньше в этот момент
 * уведомление уходило в лог и терялось навсегда: заявка лежала в CRM, а
 * владелец узнавал о ней, только открыв раздел обращений сам. Для заявки с
 * сайта это потерянный клиент — он ждёт ответа в первые минуты.
 *
 * Поэтому текст складывается в очередь в той же транзакции, что и заказ, а
 * отправка — отдельная забота воркера. Канал молчит — строки ждут; канал
 * ответил — всё пропущенное уходит в ближайшие минуты.
 */

/**
 * Сколько всего пытаемся доставить — неделя.
 *
 * Меньше сделать нельзя: прошлая поломка канала длилась больше суток, и
 * очередь, сдающаяся через час, повторила бы ровно ту потерю, от которой
 * заведена. Больше недели — незачем: заявке восьмидневной давности
 * уведомление уже не поможет, а в CRM она никуда не делась.
 */
export const ALERT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** С какого опоздания предупреждаем, что уведомление запоздало. */
const LATE_AFTER_MS = 10 * 60 * 1000;

/** Потолок паузы между попытками. */
const MAX_DELAY_MS = 15 * 60 * 1000;

/**
 * Пауза перед следующей попыткой: 30 с, минута, две… и дальше по 15 минут.
 *
 * Растущая — потому что две первые осечки обычно означают моргнувшую сеть,
 * и ждать из-за них полчаса глупо. Потолок — потому что падение канала
 * измеряется часами, и за эти часы очередь не должна ни молотить в закрытую
 * дверь каждые полминуты, ни проспать открытие на сорок минут.
 */
export function nextAlertDelayMs(attempts: number): number {
  const steps = Math.max(0, attempts - 1);
  // 2 ** 30 уже больше потолка, дальше считать нечего — и переполнения нет.
  if (steps > 30) return MAX_DELAY_MS;
  return Math.min(MAX_DELAY_MS, 30_000 * 2 ** steps);
}

/** Пора ли сдаться: уведомление старше срока жизни. */
export function alertExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() > ALERT_LIFETIME_MS;
}

const moscowTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** «12.11 в 21:48» — время заявки по Москве, как его читает человек. */
export function moscowStamp(at: Date): string {
  const parts = moscowTime.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')} в ${get('hour')}:${get('minute')}`;
}

/**
 * Пометка о задержке — первой строкой сообщения.
 *
 * Без неё догоняющие уведомления выглядят как свежие заявки: канал ожил,
 * и в чат одновременно падают четыре «новая заявка», оставленные в разные
 * дни. Человек звонит по ним как по горячим и слышит «я уже купил в другом
 * месте». Поэтому возраст заявки написан прямо в сообщении.
 */
export function lateNotice(createdAt: Date, now: Date): string | null {
  const ageMs = now.getTime() - createdAt.getTime();
  if (ageMs < LATE_AFTER_MS) return null;
  return `⏳ Уведомление запоздало: заявка пришла ${moscowStamp(createdAt)} (${humanAge(ageMs)} назад). Telegram до этой минуты был недоступен.`;
}

/** Возраст словами: «35 минут», «6 часов», «2 дня». */
export function humanAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} дн`;
}

/** Текст к отправке: тот же, что в очереди, плюс пометка о задержке. */
export function withLateNotice(
  body: string,
  createdAt: Date,
  now: Date,
): string {
  const notice = lateNotice(createdAt, now);
  return notice ? `${notice}\n\n${body}` : body;
}
