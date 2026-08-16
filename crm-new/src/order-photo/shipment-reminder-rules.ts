import { EnumDeliveryMethod, EnumStatus } from 'src/generated/prisma/enums';

/**
 * Напоминания об отгрузке.
 *
 * У Яндекс.Маркета на отгрузку даётся 48 часов с момента создания поставки.
 * Не успели — заявка отменяется, и всё оформление приходится делать заново.
 * Заказ при этом лежит готовый: теряется не работа, а время и место.
 *
 * Поэтому бот напоминает сам. Но напоминать «каждый раз как попугай» —
 * верный способ приучить людей не читать чат вообще, и тогда пропущенным
 * окажется как раз важное. Отсюда ровно три напоминания за 48 часов:
 *
 *  - через 6 часов  — «в работе, срок пошёл», ещё можно спокойно спланировать;
 *  - через 24 часа  — половина срока, пора закладывать поездку в день;
 *  - через 40 часов — 8 часов до отмены, дальше терять уже нечего.
 *
 * У Озона жёсткого счётчика нет — там просто напоминаем отвезти, без
 * обратного отсчёта: пугать сроком, которого не существует, нечестно.
 */

/** Сколько даёт Яндекс.Маркет на отгрузку. */
export const YANDEX_SHIPMENT_DEADLINE_MS = 48 * 60 * 60 * 1000;

/** Когда напоминаем, считая от создания отгрузки. */
export const SHIPMENT_REMINDER_STAGES_MS = [
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  40 * 60 * 60 * 1000,
];

/** Способы доставки, у которых срок жёсткий и его считает Яндекс. */
const DEADLINE_METHODS: EnumDeliveryMethod[] = [EnumDeliveryMethod.YANDEX_PVZ];

export interface ShipmentOrder {
  numberOrder: string;
  status: EnumStatus;
  deliveryMethod: EnumDeliveryMethod;
  /** Когда заказ перешёл в «Отгрузка создана». */
  statusChangedAt: Date | null;
  /** Сколько напоминаний уже отправлено. */
  shipmentRemindersSent: number;
}

export function hasDeadline(method: EnumDeliveryMethod): boolean {
  return DEADLINE_METHODS.includes(method);
}

/**
 * Пора ли напоминать. Возвращает номер напоминания (1..3) или null.
 *
 * Пропущенные стадии не досылаем пачкой: если бот молчал сутки, человеку
 * нужно последнее актуальное сообщение, а не три подряд с разными сроками.
 */
export function dueReminderStage(
  order: ShipmentOrder,
  now: Date = new Date(),
): number | null {
  if (order.status !== EnumStatus.SHIPMENT_CREATED) return null;
  if (!order.statusChangedAt) return null;
  if (order.shipmentRemindersSent >= SHIPMENT_REMINDER_STAGES_MS.length) {
    return null;
  }

  const elapsed = now.getTime() - order.statusChangedAt.getTime();
  // Ищем самую позднюю наступившую стадию — она и есть актуальная.
  let stage = 0;
  for (const threshold of SHIPMENT_REMINDER_STAGES_MS) {
    if (elapsed >= threshold) stage += 1;
  }
  return stage > order.shipmentRemindersSent ? stage : null;
}

/** Сколько часов осталось до отмены поставки. Отрицательное — срок вышел. */
export function hoursLeft(order: ShipmentOrder, now: Date = new Date()): number {
  if (!order.statusChangedAt) return 0;
  const left =
    YANDEX_SHIPMENT_DEADLINE_MS -
    (now.getTime() - order.statusChangedAt.getTime());
  return Math.floor(left / (60 * 60 * 1000));
}

/** Текст напоминания. Мягкость тона падает по мере приближения срока. */
export function buildShipmentReminder(
  order: ShipmentOrder,
  stage: number,
  mention: string | null,
  now: Date = new Date(),
): string {
  const who = mention ?? '⚠️ исполнитель не назначен';
  const lines: string[] = [];

  if (hasDeadline(order.deliveryMethod)) {
    const left = hoursLeft(order, now);
    const last = stage >= SHIPMENT_REMINDER_STAGES_MS.length;
    lines.push(
      last ? '🔴 *Отгрузка: последний срок*' : '📦 *Отгрузка ждёт отправки*',
    );
    lines.push(`Заказ: ${order.numberOrder}`);
    lines.push(
      left > 0
        ? `Осталось ${left} ч из 48 — после этого Яндекс отменит поставку и её придётся создавать заново.`
        : 'Срок 48 часов вышел — проверьте поставку в Яндекс.Маркете, скорее всего её уже отменили.',
    );
  } else {
    lines.push('📦 *Отгрузка ждёт отправки*');
    lines.push(`Заказ: ${order.numberOrder}`);
    lines.push('Отвезите заказ в пункт приёма Озон.');
  }

  lines.push('');
  lines.push(`${who} — как отвезёте, поставьте статус «Отправлен», и напоминания прекратятся.`);
  return lines.join('\n');
}
