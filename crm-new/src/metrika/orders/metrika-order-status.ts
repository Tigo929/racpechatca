/**
 * Статусы заказа CRM → статусы заказа Метрики (этап 06).
 *
 * Метрика знает три состояния заказа из CRM: IN_PROGRESS, PAID, CANCELLED
 * (плюс SPAM, который мы не используем). У CRM статусов пятнадцать, и
 * почти все они — внутренняя кухня производства. Наружу уходит только
 * бизнес-смысл:
 *
 *   LEAD                      → ничего: это заявка, а не заказ
 *   NEW … COMPLETED, PROBLEM  → IN_PROGRESS: заказ принят и в работе/отдан
 *   PAID                      → PAID
 *   CANCELLED                 → CANCELLED
 *
 * Переход между двумя рабочими статусами (NEW → IN_PROGRESS → READY …)
 * нормализованного состояния не меняет и в очередь не попадает.
 *
 * Отдельно — право заказа вообще существовать в Метрике (eligibility):
 * отклонённая заявка LEAD → CANCELLED заказом никогда не была, и создавать
 * из неё «отменённый заказ» нельзя — иначе воронка «заказ создан» наполнится
 * тем, что заказом не стало.
 */

export type MetrikaOrderStatus = 'IN_PROGRESS' | 'PAID' | 'CANCELLED';

/**
 * Статусы, в которых заявка уже стала заказом. Всё, кроме LEAD и CANCELLED.
 * PROBLEM — тоже рабочий статус: проблема бывает только у принятого заказа.
 */
export const ACCEPTED_ORDER_STATUSES: ReadonlySet<string> = new Set([
  'NEW',
  'APPROVAL_SENT',
  'FOLDER_STRUCTURE_CREATED',
  'IN_PROGRESS',
  'PRINTED',
  'READY',
  'SHIPMENT_CREATED',
  'DONE',
  'SENT',
  'PAID',
  'READY_FOR_REVIEW',
  'COMPLETED',
  'PROBLEM',
]);

/** Статус Метрики для статуса CRM; null — заявка (LEAD), заказа ещё нет. */
export function normalizeMetrikaStatus(
  crmStatus: string | null | undefined,
): MetrikaOrderStatus | null {
  if (!crmStatus || crmStatus === 'LEAD') return null;
  if (crmStatus === 'PAID') return 'PAID';
  if (crmStatus === 'CANCELLED') return 'CANCELLED';
  if (ACCEPTED_ORDER_STATUSES.has(crmStatus)) return 'IN_PROGRESS';
  // Неизвестный статус (появится в enum позже) — считаем рабочим: заказ
  // принят, раз он не заявка и не отменён. Лучше лишний IN_PROGRESS, чем
  // молча потерянный заказ.
  return 'IN_PROGRESS';
}

/**
 * Нужно ли ставить переход в очередь: только если бизнес-смысл изменился.
 * Возвращает статус Метрики, который означает переход, либо null.
 *
 *   LEAD → NEW            IN_PROGRESS   (заявка стала заказом)
 *   NEW → APPROVAL_SENT   null          (внутренний шаг)
 *   NEW → PAID            PAID
 *   PAID → CANCELLED      CANCELLED
 *   CANCELLED → NEW       IN_PROGRESS   (заказ вернули в работу)
 *   NEW → LEAD            null          (откат в заявку: в Метрике заказ
 *                                        остаётся как был — врать про
 *                                        отмену нельзя, это не отмена)
 */
export function transitionToMetrikaStatus(
  fromStatus: string | null | undefined,
  toStatus: string,
): MetrikaOrderStatus | null {
  const target = normalizeMetrikaStatus(toStatus);
  if (target === null) return null;
  const source = normalizeMetrikaStatus(fromStatus);
  return source === target ? null : target;
}

export interface EligibilityInput {
  /** Текущий статус заказа в CRM. */
  status: string;
  /** История переходов заказа (порядок не важен). */
  history: { fromStatus: string | null; toStatus: string }[];
  /** Заказ уже успешно уходил в Метрику как заказ (правило C). */
  previouslySynced: boolean;
}

export type EligibilityVerdict =
  | { eligible: true }
  | { eligible: false; reason: 'lead' | 'rejected_lead' };

/**
 * Можно ли отправлять заказ в Метрику (раздел 21 этапа 06).
 *
 *   A. в истории был NEW или более поздний рабочий статус;
 *   B. текущий статус PAID (или любой рабочий — заказ принят прямо сейчас);
 *   C. заказ уже синхронизирован раньше.
 *
 * Фактическая модель StatusHistory хранит fromStatus/toStatus, поэтому
 * правило A читается по обоим полям: заказ, заведённый руками сразу в NEW,
 * строки «→ NEW» не имеет, но его отмена запишется как NEW → CANCELLED, и
 * fromStatus = NEW доказывает, что заказ был принят.
 */
export function orderEligibility(input: EligibilityInput): EligibilityVerdict {
  const current = normalizeMetrikaStatus(input.status);
  if (current === null) return { eligible: false, reason: 'lead' };
  if (current === 'IN_PROGRESS' || current === 'PAID') return { eligible: true };
  // CANCELLED: отменён заказ или отклонена заявка?
  if (input.previouslySynced) return { eligible: true };
  const wasAccepted = input.history.some(
    (h) =>
      ACCEPTED_ORDER_STATUSES.has(h.toStatus) ||
      (h.fromStatus !== null && ACCEPTED_ORDER_STATUSES.has(h.fromStatus)),
  );
  return wasAccepted
    ? { eligible: true }
    : { eligible: false, reason: 'rejected_lead' };
}
