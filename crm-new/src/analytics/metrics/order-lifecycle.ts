import {
  isRevenueRealized,
  recognitionDate,
} from '../../reports/reports.service';

/**
 * Жизненный цикл заказа CRM (этап 08, разделы 10–14).
 *
 * Одна функция — одна правда о том, когда заказ был заявкой, когда его
 * приняли в работу, когда оплатили, отменили и когда он стал выручкой.
 * StatusHistory пишется только на переходах: у заказа, созданного сразу
 * в NEW (оператор, Avito), истории нет вовсе — его принятие в работу
 * равно созданию. У заявки с сайта первый статус LEAD; принятие — первый
 * переход в рабочий статус.
 *
 * Отмена не отменяет факта принятия: LEAD → NEW → CANCELLED — это принятый
 * и отменённый заказ. Возврат в работу (CANCELLED → NEW, PAID → READY) не
 * двигает acceptedAt — считается самое раннее вхождение в работу.
 *
 * Оплата — только `clientPaidAt`. Статус PAID без даты оплаты значит «деньги
 * были, а когда — неизвестно»: такой заказ не попадает в оплаченные периода,
 * а показывается отдельно как paidWithoutDate. Угадывать дату по статусу
 * нельзя.
 *
 * Реализация (выручка признана) — по правилу P&L-отчёта (reports.service):
 * отдан клиенту или оплачен, дата — recognitionDate. Аналитика не вводит
 * своей трактовки DONE/SENT/COMPLETED.
 */

export const ACCEPTED_STATUSES: ReadonlySet<string> = new Set([
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
]);

export interface LifecycleOrder {
  createdAt: Date;
  status: string;
  productCategory: string;
  clientPaidAt: Date | null;
  completedAt: Date | null;
  statusChangedAt: Date | null;
  sentAt: Date | null;
}

export interface LifecycleTransition {
  fromStatus: string | null;
  toStatus: string;
  createdAt: Date;
}

export interface OrderLifecycle {
  /** Статус, в котором заказ появился: fromStatus первого перехода, иначе текущий. */
  initialStatus: string;
  /** Заявка: создан как LEAD — createdAt; попал в LEAD позже — момент перехода; иначе null. */
  leadAt: Date | null;
  /** Первое вхождение в рабочий статус; создан сразу рабочим — createdAt. */
  acceptedAt: Date | null;
  /** Только clientPaidAt. */
  paidAt: Date | null;
  /** Заказ сейчас отменён — момент последнего перехода в CANCELLED; возвращён в работу — null. */
  cancelledAt: Date | null;
  /** Выручка признана (правило отчёта) — дата признания; иначе null. */
  realizedAt: Date | null;
  hadLeadStage: boolean;
  wasEverCancelled: boolean;
  /** Статус PAID, а даты оплаты нет: оплата была, но в периодах её не посчитать. */
  paidWithoutDate: boolean;
}

export function deriveOrderLifecycle(
  order: LifecycleOrder,
  history: LifecycleTransition[],
): OrderLifecycle {
  const sorted = [...history].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const initialStatus = sorted[0]?.fromStatus ?? order.status;

  const enteredLead = sorted.find((h) => h.toStatus === 'LEAD');
  const hadLeadStage =
    initialStatus === 'LEAD' ||
    order.status === 'LEAD' ||
    sorted.some((h) => h.toStatus === 'LEAD' || h.fromStatus === 'LEAD');
  const leadAt =
    initialStatus === 'LEAD'
      ? order.createdAt
      : (enteredLead?.createdAt ?? null);

  const enteredAccepted = sorted.find((h) => ACCEPTED_STATUSES.has(h.toStatus));
  const acceptedAt = ACCEPTED_STATUSES.has(initialStatus)
    ? order.createdAt
    : (enteredAccepted?.createdAt ??
      (sorted.length === 0 && ACCEPTED_STATUSES.has(order.status)
        ? order.createdAt
        : null));

  const cancelTransitions = sorted.filter((h) => h.toStatus === 'CANCELLED');
  const wasEverCancelled =
    order.status === 'CANCELLED' || cancelTransitions.length > 0;
  const cancelledAt =
    order.status === 'CANCELLED'
      ? (cancelTransitions[cancelTransitions.length - 1]?.createdAt ??
        order.statusChangedAt ??
        order.createdAt)
      : null;

  const realized = isRevenueRealized(order.status, order.productCategory);

  return {
    initialStatus,
    leadAt,
    acceptedAt,
    paidAt: order.clientPaidAt ?? null,
    cancelledAt,
    realizedAt: realized ? recognitionDate(order) : null,
    hadLeadStage,
    wasEverCancelled,
    paidWithoutDate: order.status === 'PAID' && !order.clientPaidAt,
  };
}
