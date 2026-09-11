import {
  orderCostOfGoods,
  type CostSettings,
  type OrderCogsSource,
} from 'src/reports/order-cogs';
import { formatCounterDateTime, type SimpleOrderRow } from './metrika-order-csv';
import {
  normalizeMetrikaStatus,
  orderEligibility,
  type MetrikaOrderStatus,
} from './metrika-order-status';

/**
 * Снимок заказа для Метрики (этап 06, разделы 7–27, 32).
 *
 * Строится из ТЕКУЩЕГО состояния заказа в момент отправки, а не из
 * сохранённого в очереди: очередь хранит «почему отправляем», а «что
 * отправляем» — всегда правда на сейчас. Повторная отправка того же
 * заказа даёт тот же файл, если заказ не менялся (merge_mode=SAVE).
 *
 * Деньги:
 *   revenue = OrderPhoto.totalOrder — договорная сумма заказа целиком
 *             (позиции + доставка + дизайн + срочность), то, что платит
 *             клиент. Именно её отчёт CRM кладёт в оборот (totalRevenue).
 *   cost    = себестоимость по заказу из той же функции, что и P&L
 *             (order-cogs.ts). Ненадёжна — колонка пустая, а не ноль.
 *
 * Дата создания — OrderPhoto.createdAt в часовом поясе счётчика; датой
 * оплаты не подменяется (clientPaidAt живёт в нашей аналитике).
 */

/** ClientID Метрики — десятичное число до 20 цифр. Только строкой. */
const CLIENT_ID_RE = /^\d{1,20}$/;

export interface OrderForMetrika extends OrderCogsSource {
  id: string;
  createdAt: Date;
  status: string;
  yandexClientId: string | null;
  totalOrder: number;
  statusHistory: { fromStatus: string | null; toStatus: string }[];
}

export type SkipReason =
  | 'no_client_id'
  | 'invalid_client_id'
  | 'not_eligible_lead'
  | 'not_eligible_rejected_lead';

export type OrderSnapshot =
  | {
      kind: 'row';
      row: SimpleOrderRow;
      status: MetrikaOrderStatus;
      costReliable: boolean;
    }
  | { kind: 'skip'; reason: SkipReason };

export function buildOrderSnapshot(
  order: OrderForMetrika,
  settings: CostSettings,
  timeZone: string,
  previouslySynced: boolean,
): OrderSnapshot {
  const verdict = orderEligibility({
    status: order.status,
    history: order.statusHistory,
    previouslySynced,
  });
  if (!verdict.eligible) {
    return {
      kind: 'skip',
      reason: verdict.reason === 'lead' ? 'not_eligible_lead' : 'not_eligible_rejected_lead',
    };
  }

  const clientId = (order.yandexClientId ?? '').trim();
  if (!clientId) return { kind: 'skip', reason: 'no_client_id' };
  if (!CLIENT_ID_RE.test(clientId)) return { kind: 'skip', reason: 'invalid_client_id' };

  // Право на отправку проверено выше, значит статус здесь не LEAD.
  const status = normalizeMetrikaStatus(order.status) as MetrikaOrderStatus;
  const cogs = orderCostOfGoods(order, settings);

  return {
    kind: 'row',
    status,
    costReliable: cogs.reliable,
    row: {
      id: order.id,
      createDateTime: formatCounterDateTime(order.createdAt, timeZone),
      clientId,
      status,
      revenue: Math.max(0, Math.round(order.totalOrder)),
      cost: cogs.reliable ? cogs.rub : null,
    },
  };
}

/** ClientID для логов и отчётов: первые четыре цифры, остальное скрыто. */
export function maskClientId(clientId: string): string {
  return clientId.length <= 4 ? '****' : `${clientId.slice(0, 4)}…(${clientId.length} цифр)`;
}
