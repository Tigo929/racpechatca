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
 * Статус Ozon → наш. По точной статусной модели из документации Ozon
 * Delivery API (раздел «Статусная модель», прочитан 26.11.2026):
 *
 *   CREATED                  создано, не подтверждено
 *   FORMING                  в процессе подтверждения
 *   FORMING_FAILED           ошибка при подтверждении
 *   READY_FOR_SHIPPING       подтверждено, готово к отгрузке в Ozon
 *   IN_CONTAINER             добавлено в грузоместо
 *   ACCEPTANCE_IN_PROGRESS   принято в пункте отгрузки, идёт приёмка
 *   ON_WAY                   принято в логистику, доставляется
 *   NOT_ACCEPTED_TO_DELIVERY не принято из грузоместа в пункте отгрузки
 *   IN_DELIVERY_POINT        доставлено в ПВЗ или постамат
 *   IN_COURIER_SERVICE       передано курьеру
 *   DELIVERED                выдано получателю
 *   CANCELED                 отменено, движение — как возврат
 *
 * Регистр Ozon отдаёт строчными («ready_for_shipping»), сравниваем без
 * регистра. Незнакомый статус — null: прежний наш статус остаётся, а
 * владелец получает сообщение (OzonShipmentSyncService.reportUnknown).
 */
const OZON_STATUS_MAP: Record<string, ShipmentStatus> = {
  CREATED: 'CREATED',
  FORMING: 'APPROVED',
  FORMING_FAILED: 'ERROR',
  READY_FOR_SHIPPING: 'APPROVED',
  IN_CONTAINER: 'APPROVED',
  ACCEPTANCE_IN_PROGRESS: 'IN_TRANSIT',
  ON_WAY: 'IN_TRANSIT',
  NOT_ACCEPTED_TO_DELIVERY: 'ERROR',
  IN_DELIVERY_POINT: 'AT_PICKUP_POINT',
  IN_COURIER_SERVICE: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELED: 'CANCELLED',
};

/** Статусы Ozon, о которых стоит сразу сказать владельцу. */
export const OZON_PROBLEM_STATUSES: Record<string, string> = {
  FORMING_FAILED: 'Ozon не смог подтвердить отправление',
  NOT_ACCEPTED_TO_DELIVERY: 'посылку не приняли в пункте отгрузки',
};

export function mapOzonStatus(
  raw: string | null | undefined,
): ShipmentStatus | null {
  const key = (raw ?? '').trim().toUpperCase();
  return OZON_STATUS_MAP[key] ?? null;
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
  if (order.status === 'LEAD') {
    return 'Это ещё заявка — сначала переведите её в заказ.';
  }
  if (order.status === 'CANCELLED') return 'Заказ отменён.';
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
