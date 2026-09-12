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
 * Отмена — историческое событие (FIX_01): возврат в работу его не стирает.
 * `firstCancelledAt` / `lastCancelledAt` — первый и последний вход в
 * CANCELLED, `currentlyCancelled` — отменён ли заказ сейчас,
 * `wasEverCancelled` — был ли отменён хоть раз. Метрика «отменено за период»
 * считается по первой отмене (один заказ — одно событие, сколько бы раз его
 * ни возвращали и ни отменяли снова), «сейчас отменено» — отдельно.
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
  /** Первый вход в CANCELLED — сохраняется и после возврата в работу; не отменялся — null. */
  firstCancelledAt: Date | null;
  /** Последний вход в CANCELLED; не отменялся — null. */
  lastCancelledAt: Date | null;
  /** Все моменты входа в CANCELLED (для счётчика событий отмены). */
  cancellationTimes: Date[];
  /** Текущий статус — CANCELLED. */
  currentlyCancelled: boolean;
  /** Выручка признана (правило отчёта) — дата признания; иначе null. */
  realizedAt: Date | null;
  hadLeadStage: boolean;
  /** Хотя бы один переход в CANCELLED (или создан отменённым). */
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

  // Входы в CANCELLED по истории; заказ, отменённый сейчас без единого перехода
  // (создан отменённым), — один вход в момент смены статуса или создания.
  const cancellationTimes = sorted
    .filter((h) => h.toStatus === 'CANCELLED')
    .map((h) => h.createdAt);
  const currentlyCancelled = order.status === 'CANCELLED';
  if (currentlyCancelled && cancellationTimes.length === 0) {
    cancellationTimes.push(order.statusChangedAt ?? order.createdAt);
  }
  const wasEverCancelled = cancellationTimes.length > 0;

  const realized = isRevenueRealized(order.status, order.productCategory);

  return {
    initialStatus,
    leadAt,
    acceptedAt,
    paidAt: order.clientPaidAt ?? null,
    firstCancelledAt: cancellationTimes[0] ?? null,
    lastCancelledAt: cancellationTimes[cancellationTimes.length - 1] ?? null,
    cancellationTimes,
    currentlyCancelled,
    realizedAt: realized ? recognitionDate(order) : null,
    hadLeadStage,
    wasEverCancelled,
    paidWithoutDate: order.status === 'PAID' && !order.clientPaidAt,
  };
}
