import {
  orderCostOfGoods,
  type CostSettings,
  type OrderCogsSource,
} from 'src/reports/order-cogs';
import {
  formatCounterDateTime,
  type SimpleOrderRow,
} from './metrika-order-csv';
import {
  orderEligibility,
  type MetrikaOrderStatus,
} from './metrika-order-status';
import {
  isValidYclid,
  NO_YCLID_TARGETS,
  targetFor,
  type YclidConversionRow,
  type YclidConversionTargets,
} from './metrika-yclid-conversions';

/**
 * Снимок заказа для Метрики (этап 06, разделы 7–27, 32; FIX_01, разделы 1–3).
 *
 * Смысл перехода — `order_status` — берётся ТОЛЬКО из строки очереди
 * (targetMetrikaStatus): именно этот переход случился в CRM, и именно его
 * Метрика должна увидеть, даже если заказ с тех пор ушёл дальше. Иначе
 * при задержке воркера цепочка NEW → PAID → CANCELLED превратилась бы в
 * три CANCELLED, а «заказ создан» и «заказ оплачен» пропали бы из воронки.
 *
 * Из актуального заказа берутся только канонические поля, которые
 * переходом не меняются: id, ClientID, дата создания, сумма, позиции для
 * себестоимости. Повторная отправка той же строки даёт тот же файл.
 *
 * Деньги:
 *   revenue = OrderPhoto.totalOrder — договорная сумма заказа целиком
 *             (позиции + доставка + дизайн + срочность), то, что платит
 *             клиент. Именно её отчёт CRM кладёт в оборот (totalRevenue).
 *   cost    = каноническая себестоимость (COGS) из той же функции, что и
 *             P&L (order-cogs.ts). Ненадёжна — колонка пустая, а не ноль.
 *   revenue − cost в Метрике — валовая прибыль (gross contribution), а не
 *   чистая прибыль CRM: зарплата, доставка и операционные расходы в COGS
 *   не входят.
 *
 * Дата создания — OrderPhoto.createdAt в часовом поясе счётчика; датой
 * оплаты не подменяется (clientPaidAt живёт в нашей аналитике).
 */

/** ClientID Метрики — десятичное число до 20 цифр. Только строкой. */
const CLIENT_ID_RE = /^\d{1,20}$/;

export interface OrderForMetrika extends OrderCogsSource {
  id: string;
  createdAt: Date;
  yandexClientId: string | null;
  /** Метка клика Директа — второй идентификатор, когда ClientID нет. */
  yclid: string | null;
  /** Происхождение заказа: у ручных каналов идентификаторов визита не бывает. */
  sourceOrder: string | null;
  totalOrder: number;
  /** История переходов до отправляемого перехода включительно. */
  statusHistory: { fromStatus: string | null; toStatus: string }[];
}

export type SkipReason =
  /** Заказ сайта без ClientID и без yclid — связать с визитом нечем. */
  | 'no_client_id'
  | 'invalid_client_id'
  | 'not_eligible_rejected_lead'
  /**
   * Ручной заказ (Avito, маркетплейсы): идентификатора визита у него нет и
   * быть не может — человек писал в мессенджер, а не приходил на сайт.
   * Отдельная причина, потому что чинить тут нечего: раньше такие заказы
   * копились как `no_client_id` и выглядели в отчётах как поломка.
   */
  | 'manual_order_no_web_identity'
  /**
   * Есть только yclid, а канал офлайн-конверсий не настроен: владелец ещё
   * не завёл отдельные цели в кабинете (см. metrika-yclid-conversions).
   */
  | 'yclid_channel_disabled';

export type OrderSnapshot =
  | {
      kind: 'row';
      row: SimpleOrderRow;
      status: MetrikaOrderStatus;
      costReliable: boolean;
    }
  /** Отправка по метке клика Директа: у заказа нет ClientID, но есть yclid. */
  | {
      kind: 'yclid';
      row: YclidConversionRow;
      status: MetrikaOrderStatus;
    }
  | { kind: 'skip'; reason: SkipReason };

export function buildOrderSnapshot(
  order: OrderForMetrika,
  target: MetrikaOrderStatus,
  settings: CostSettings,
  timeZone: string,
  previouslySynced: boolean,
  /** Цели канала yclid; пусто — канал выключен. */
  yclidTargets: YclidConversionTargets = NO_YCLID_TARGETS,
): OrderSnapshot {
  const verdict = orderEligibility({
    target,
    history: order.statusHistory,
    previouslySynced,
  });
  if (!verdict.eligible) {
    return { kind: 'skip', reason: 'not_eligible_rejected_lead' };
  }

  const clientId = (order.yandexClientId ?? '').trim();
  if (!clientId) {
    /*
     * ClientID нет. Дальше решает происхождение заказа и метка клика.
     *
     * Ручной заказ уходит со своей причиной: у него идентификатора визита
     * не бывает по природе, и складывать его в `no_client_id` значит
     * закрашивать настоящую проблему тремя сотнями ожидаемых пропусков.
     */
    const yclid = (order.yclid ?? '').trim();
    if (isValidYclid(yclid)) {
      const targetGoal = targetFor(target, yclidTargets);
      if (!targetGoal)
        return { kind: 'skip', reason: 'yclid_channel_disabled' };
      return {
        kind: 'yclid',
        status: target,
        row: {
          yclid,
          target: targetGoal,
          // Момент конверсии — время события, а не загрузки: иначе оплата
          // вчерашнего заказа встанет в отчёт сегодняшним днём.
          dateTime: Math.floor(order.createdAt.getTime() / 1000),
          price: Math.max(0, Math.round(order.totalOrder)),
        },
      };
    }
    return {
      kind: 'skip',
      reason:
        (order.sourceOrder ?? '') === 'WEBSITE'
          ? 'no_client_id'
          : 'manual_order_no_web_identity',
    };
  }
  if (!CLIENT_ID_RE.test(clientId))
    return { kind: 'skip', reason: 'invalid_client_id' };

  const cogs = orderCostOfGoods(order, settings);

  return {
    kind: 'row',
    status: target,
    costReliable: cogs.reliable,
    row: {
      id: order.id,
      createDateTime: formatCounterDateTime(order.createdAt, timeZone),
      clientId,
      status: target,
      revenue: Math.max(0, Math.round(order.totalOrder)),
      cost: cogs.reliable ? cogs.rub : null,
    },
  };
}

/** ClientID для логов и отчётов: первые четыре цифры, остальное скрыто. */
export function maskClientId(clientId: string): string {
  return clientId.length <= 4
    ? '****'
    : `${clientId.slice(0, 4)}…(${clientId.length} цифр)`;
}
