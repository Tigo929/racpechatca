/**
 * Что в CRM считается заявкой, заказом, оплатой и закрытием.
 *
 * Определения живут здесь, а не в каждом запросе, по одной причине: если
 * «оплачено» в одном инструменте это статус PAID, а в другом — заполненный
 * clientPaidAt, два ответа на один вопрос разойдутся, и человек поверит
 * тому, который увидел последним. Одно определение — один ответ.
 *
 * Про оплату отдельно. В CRM есть и статус, и дата первой оплаты
 * (clientPaidAt). Дата надёжнее: заказ могли вернуть в работу и снова
 * оплатить, статус при этом уезжает, а дата остаётся. Но заполнять её
 * начали только с 11.09.2026, поэтому признак оплаты — «дата стоит ИЛИ
 * статус не ниже оплаты». По старым периодам работает статус, по новым —
 * дата, и ни один оплаченный заказ не теряется.
 */

/** Статусы, до которых заказ уже оплачен клиентом. */
export const PAID_STATUSES = ['PAID', 'READY_FOR_REVIEW', 'COMPLETED'] as const;

/** SQL-условие «этот заказ оплачен». Подставляется с псевдонимом таблицы. */
export function paidSql(alias = 'o'): string {
  const list = PAID_STATUSES.map((s) => `'${s}'`).join(',');
  return `(${alias}."clientPaidAt" IS NOT NULL OR ${alias}.status IN (${list}))`;
}

/**
 * Заявка стала заказом. LEAD — обращение, с которым ещё не работали;
 * всё остальное, включая отменённое, когда-то было заказом: отмену нельзя
 * прятать из воронки, иначе конверсия окажется выше, чем в жизни.
 */
export function orderedSql(alias = 'o'): string {
  return `${alias}.status <> 'LEAD'`;
}

/** Заказ закрыт (оплачен/завершён/отменён) — по closedAt, его ставит CRM. */
export function closedSql(alias = 'o'): string {
  return `${alias}."closedAt" IS NOT NULL`;
}

/** Русские подписи статусов: в ответе должен быть язык владельца, а не enum. */
export const STATUS_LABELS: Record<string, string> = {
  LEAD: 'Обратился',
  NEW: 'Новый',
  APPROVAL_SENT: 'Макет на согласовании',
  FOLDER_STRUCTURE_CREATED: 'Папки созданы',
  IN_PROGRESS: 'В работе',
  PRINTED: 'Напечатан',
  READY: 'Готов',
  SHIPMENT_CREATED: 'Отгрузка создана',
  DONE: 'Выполнен',
  SENT: 'Отправлен',
  PAID: 'Оплачен',
  READY_FOR_REVIEW: 'Ждём отзыв',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  PROBLEM: 'Проблема',
};

export const CATEGORY_LABELS: Record<string, string> = {
  PHOTO: 'Фотопечать',
  TSHIRT: 'Футболки',
  CANVAS: 'Холсты',
};

export const SOURCE_LABELS: Record<string, string> = {
  AVITO: 'Авито',
  OZON: 'Ozon',
  WB: 'Wildberries',
  LOCAL: 'Самотёк',
  WEBSITE: 'Сайт',
  UNKNOWN: 'Неизвестно',
};

export const ACCRUAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Не выплачено',
  PARTIALLY_PAID: 'Выплачено частично',
  PAID: 'Выплачено',
  SETTLED: 'Закрыто зачётом',
  REVERSED: 'Отменено',
};

export const EXPENSE_LABELS: Record<string, string> = {
  MATERIALS_PHOTO: 'Материалы, фото',
  MATERIALS_TSHIRT: 'Материалы, футболки',
  DELIVERY_SUPPLIES: 'Упаковка и доставка',
  EQUIPMENT: 'Оборудование',
  MARKETING: 'Реклама',
  PARTNER_SHARE: 'Доля партнёра',
  PARTNER_REWARD: 'Вознаграждение партнёру',
  CANVAS_CONTRACTOR: 'Подрядчик по холстам',
  OTHER: 'Прочее',
};

/** Подпись или сам код, если значение незнакомое: молчать про него нельзя. */
export function label(dict: Record<string, string>, code: string | null): string {
  if (!code) return '—';
  return dict[code] ?? code;
}
