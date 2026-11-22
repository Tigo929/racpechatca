/**
 * Правила отправлений Ozon Доставки — без базы и сети, чтобы их можно было
 * проверить тестами и прочитать целиком.
 *
 * Ozon Доставка для бизнеса не берёт оплату при получении и не проверяет,
 * заплатил ли клиент. Поэтому главное правило: отправление создаётся только
 * по полностью оплаченному заказу. Иначе посылка уедет, а остаток останется
 * разговором в переписке.
 */
import { actualBalanceDue } from 'src/order-photo/prepayment';
import { normalizePhone } from 'src/order-photo/client-contact';

/** Габариты по умолчанию. Менеджер может поправить перед созданием. */
export interface Parcel {
  weightG: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

/*
 * Ориентиры, а не замер: конверт с пачкой фото 10×15 и пакет с одной-двумя
 * футболками. Ozon считает цену по объёму, поэтому завышать не стоит, а
 * занижать нельзя — при приёмке перемеряют и доначислят.
 */
export const DEFAULT_PARCELS: Record<string, Parcel> = {
  PHOTO: { weightG: 300, lengthMm: 250, widthMm: 180, heightMm: 30 },
  TSHIRT: { weightG: 400, lengthMm: 300, widthMm: 250, heightMm: 40 },
  CANVAS: { weightG: 1500, lengthMm: 500, widthMm: 400, heightMm: 50 },
};

export function defaultParcel(category: string | null | undefined): Parcel {
  return DEFAULT_PARCELS[category ?? ''] ?? DEFAULT_PARCELS.PHOTO;
}

/** Наши статусы отправления. */
export type ShipmentStatus =
  | 'CREATED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'AT_PICKUP_POINT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNING'
  | 'RETURNED'
  | 'ERROR';

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  CREATED: 'Создано, не подтверждено',
  APPROVED: 'Готово к сдаче в ПВЗ',
  IN_TRANSIT: 'Едет',
  AT_PICKUP_POINT: 'Ждёт в пункте выдачи',
  DELIVERED: 'Получено клиентом',
  CANCELLED: 'Отменено',
  RETURNING: 'Возвращается',
  RETURNED: 'Вернулось',
  ERROR: 'Ошибка',
};

/** Отправление ещё в пути — его статус надо подтягивать. */
export const ACTIVE_STATUSES: readonly ShipmentStatus[] = [
  'CREATED',
  'APPROVED',
  'IN_TRANSIT',
  'AT_PICKUP_POINT',
  'RETURNING',
];

/**
 * Статус Ozon → наш.
 *
 * Полного справочника статусов у нас нет (документация Ozon закрыта от
 * автоматического чтения), поэтому разбираем по смыслу слова, а сам статус
 * Ozon храним рядом и показываем. Неизвестное — null: прежний наш статус
 * остаётся, а в карточке видно, что сказал Ozon.
 */
export function mapOzonStatus(
  raw: string | null | undefined,
): ShipmentStatus | null {
  const s = (raw ?? '').toLowerCase();
  if (!s) return null;
  if (/cancel|отмен/.test(s)) return 'CANCELLED';
  if (/returned|возвращ[её]н|return_completed|returned_to_seller/.test(s))
    return 'RETURNED';
  if (/return|возврат/.test(s)) return 'RETURNING';
  if (/delivered|вручен|получен|issued|completed/.test(s)) return 'DELIVERED';
  if (
    /pickup_point|at_pvz|arrived|awaiting_pickup|ready_for_pickup|ready_to_issue|в пункте|ожидает получ/.test(
      s,
    )
  ) {
    return 'AT_PICKUP_POINT';
  }
  if (
    /transit|delivering|accepted|sorting|on_the_way|в пути|принят|доставля/.test(
      s,
    )
  )
    return 'IN_TRANSIT';
  if (
    /approved|forming|ready_for_shipping|awaiting_(registration|shipment|handover)|подтвержд/.test(
      s,
    )
  )
    return 'APPROVED';
  if (/created|new|draft|создан/.test(s)) return 'CREATED';
  return null;
}

/** «99.00» / {amount:"99.00"} → 99 (вверх до рубля). */
export function rubles(value: unknown): number | null {
  const raw: unknown =
    value && typeof value === 'object' && 'amount' in value
      ? value.amount
      : value;
  if (typeof raw === 'number')
    return Number.isFinite(raw) ? Math.ceil(raw) : null;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? Math.ceil(n) : null;
}

export interface ShipmentCandidate {
  productCategory: string;
  deliveryMethod: string;
  status: string;
  totalOrder: number | null;
  prepaidAmount: number | null;
  clientPaidAt?: Date | null;
  pickupPointId: string | null;
  recipientPhone: string | null;
  recipientName: string | null;
}

/** Почему отправление создать нельзя; null — можно. */
export function shipmentBlocker(order: ShipmentCandidate): string | null {
  if (!['PHOTO', 'TSHIRT', 'CANVAS'].includes(order.productCategory)) {
    return 'Отправления Ozon — только для фото, футболок и холстов.';
  }
  if (order.deliveryMethod !== 'OZON_PVZ') {
    return 'Способ доставки в заказе — не «Ozon ПВЗ».';
  }
  if (['LEAD', 'CANCELLED'].includes(order.status)) {
    return 'Заказ ещё заявка или отменён.';
  }
  if (!order.pickupPointId) return 'Не выбран пункт выдачи Ozon.';
  if (!normalizePhone(order.recipientPhone)) {
    return 'Нет телефона получателя — по нему Ozon выдаёт посылку.';
  }
  if (!order.recipientName?.trim()) return 'Нет имени получателя.';
  const paid =
    Boolean(order.clientPaidAt) ||
    actualBalanceDue(
      order.totalOrder ?? 0,
      order.prepaidAmount,
      order.status,
    ) <= 0;
  if (!paid) {
    const due = actualBalanceDue(
      order.totalOrder ?? 0,
      order.prepaidAmount,
      order.status,
    );
    return `Заказ не оплачен полностью: остаток ${due} ₽. Ozon не берёт оплату при получении — сначала остаток, потом отправка.`;
  }
  return null;
}

/** Расписание пункта одной строкой: «пн–вс 09:00–20:00» по первым дням. */
export function scheduleText(
  schedule:
    | {
        date?: string;
        periods?: { from_local?: string; to_local?: string }[];
      }[]
    | undefined,
): string | null {
  const first = schedule?.find((d) => d.periods && d.periods.length > 0);
  if (!first?.periods) return null;
  const hm = (t?: string) => (t ?? '').slice(0, 5);
  const periods = first.periods
    .map((p) => `${hm(p.from_local)}–${hm(p.to_local)}`)
    .join(', ');
  const sameEveryDay = (schedule ?? [])
    .slice(0, 7)
    .every(
      (d) =>
        (d.periods ?? [])
          .map((p) => `${hm(p.from_local)}–${hm(p.to_local)}`)
          .join(', ') === periods,
    );
  return sameEveryDay ? `ежедневно ${periods}` : `сегодня ${periods}`;
}
