import type { MetrikaOrderStatus } from './metrika-order-status';

/**
 * CSV для загрузки заказов в Метрику (POST …/data/simple_orders).
 *
 * Заголовок — полный официальный, с пустыми необязательными колонками:
 * так файл совпадает с примером из документации и не зависит от того,
 * как Метрика относится к усечённому заголовку. Заполняем только то, что
 * договорились передавать (этап 06, раздел 53): id заказа, дату создания,
 * ClientID, статус, сумму, себестоимость, валюту. Почта, телефоны,
 * client_uniq_id и goals остаются пустыми — персональные данные в Метрику
 * не уходят.
 *
 * Документация формата: https://yandex.ru/dev/metrika/ru/data-import/simple-orders-data
 * Форматы дат:         https://yandex.ru/dev/metrika/ru/data-import/date
 */

export const SIMPLE_ORDERS_HEADER = [
  'id',
  'create_date_time',
  'client_uniq_id',
  'client_ids',
  'emails',
  'phones',
  'order_status',
  'revenue',
  'cost',
  'goals',
  'currency',
] as const;

export const ORDER_CURRENCY = 'RUB';

export interface SimpleOrderRow {
  /** OrderPhoto.id — стабильный ключ, по которому Метрика обновляет заказ. */
  id: string;
  /** yyyy-MM-dd HH:mm:ss в часовом поясе счётчика. */
  createDateTime: string;
  /** ClientID Метрики — строка цифр, как есть. В number не превращать: до 20 цифр. */
  clientId: string;
  status: MetrikaOrderStatus;
  /** Сумма заказа в рублях, целое. */
  revenue: number;
  /** Себестоимость в рублях; null — неизвестна, колонка остаётся пустой. */
  cost: number | null;
}

/**
 * Экранирование поля по RFC 4180: запятая, кавычка, перевод строки —
 * значение в кавычках, кавычка внутри удваивается. Персональных данных
 * в файле нет, но правило нужно всё равно: id и даты сегодня безобидны,
 * а завтра кто-то положит в колонку строку с запятой.
 */
export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function simpleOrderToCsvLine(row: SimpleOrderRow): string {
  const cells: Record<(typeof SIMPLE_ORDERS_HEADER)[number], string> = {
    id: row.id,
    create_date_time: row.createDateTime,
    client_uniq_id: '',
    client_ids: row.clientId,
    emails: '',
    phones: '',
    order_status: row.status,
    revenue: String(row.revenue),
    cost: row.cost === null ? '' : String(row.cost),
    goals: '',
    currency: ORDER_CURRENCY,
  };
  return SIMPLE_ORDERS_HEADER.map((h) => csvEscape(cells[h])).join(',');
}

/** Полный файл: заголовок и строки, разделитель — запятая, перевод строки — \n. */
export function buildSimpleOrdersCsv(rows: SimpleOrderRow[]): string {
  return [SIMPLE_ORDERS_HEADER.join(','), ...rows.map(simpleOrderToCsvLine)].join('\n') + '\n';
}

/**
 * Дата в часовом поясе счётчика, формат `yyyy-MM-dd HH:mm:ss` — один из
 * официально поддерживаемых для CSV. Часовой пояс — из метаданных счётчика
 * (`time_zone_name`, IANA), не из предположения «Москва».
 *
 * Intl считает переход на летнее время сам; для одного и того же момента
 * и пояса результат всегда один — этого требует Метрика: дату создания
 * заказа менять нельзя.
 */
export function formatCounterDateTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/** Проверка IANA-имени пояса: неизвестное имя Intl отвергает исключением. */
export function isValidTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}
