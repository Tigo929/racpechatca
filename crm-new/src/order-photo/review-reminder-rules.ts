import {
  EnumDeliveryMethod,
  EnumProductCategory,
  EnumStatus,
} from 'src/generated/prisma/enums';

/** Доставка (ПВЗ и т.п.): просим отзыв через 3,5 дня после отправки. */
export const REVIEW_REMINDER_DELAY_MS = 84 * 60 * 60 * 1000; // 3.5 days

/** Самовывоз: клиент получил заказ сразу — просим отзыв уже на следующий день. */
export const REVIEW_REMINDER_PICKUP_DELAY_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Маркетплейс: пять дней после отгрузки (решение владельца 02.10.2026).
 *
 * Срок больше, чем у своих заказов, и считается от другой даты. Отсчёт идёт
 * от «Отгружен» — момента, когда посылка ушла площадке, — а дальше её ещё
 * везут до пункта выдачи. Просить отзыв раньше бессмысленно: человек
 * товара в руках не держал.
 */
export const MARKETPLACE_REVIEW_DELAY_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export const REVIEW_REMINDER_CATEGORIES: EnumProductCategory[] = [
  EnumProductCategory.PHOTO,
  EnumProductCategory.TSHIRT,
  EnumProductCategory.CANVAS,
];

export const REVIEW_REMINDER_STATUSES: EnumStatus[] = [
  EnumStatus.SENT,
  EnumStatus.PAID,
];

export function reviewReminderDelayMs(
  deliveryMethod: EnumDeliveryMethod,
): number {
  return deliveryMethod === EnumDeliveryMethod.PICKUP
    ? REVIEW_REMINDER_PICKUP_DELAY_MS
    : REVIEW_REMINDER_DELAY_MS;
}

export function isReviewReminderEligible(
  order: {
    productCategory: EnumProductCategory;
    status: EnumStatus;
    deliveryMethod: EnumDeliveryMethod;
    clientReviewLeft: boolean;
    reviewReminderNotifiedAt: Date | null;
    sentAt: Date | null;
    /** Футболка с площадки: свой срок и своя дата отсчёта. */
    isMarketplacePrint?: boolean | null;
    completedAt?: Date | null;
  },
  now = new Date(),
): boolean {
  if (!REVIEW_REMINDER_CATEGORIES.includes(order.productCategory)) return false;
  if (order.clientReviewLeft) return false;
  if (order.reviewReminderNotifiedAt) return false;

  /*
   * Заказ с площадки идёт своим путём, и общее правило к нему не подходит.
   *
   * У него SENT означает «передан в производство», а не «отдан клиенту»:
   * по общему правилу просьба об отзыве уходила бы через 3,5 дня после
   * передачи в печать — человеку, который ещё ничего не получил. Считаем
   * от «Отгружен» и ждём пять дней, пока посылка доедет.
   */
  if (order.productCategory === EnumProductCategory.TSHIRT && order.isMarketplacePrint) {
    if (order.status !== EnumStatus.COMPLETED) return false;
    if (!order.completedAt) return false;
    return (
      order.completedAt <= new Date(now.getTime() - MARKETPLACE_REVIEW_DELAY_MS)
    );
  }

  if (!REVIEW_REMINDER_STATUSES.includes(order.status)) return false;
  // У холстов SENT = передали подрядчику, а не клиенту. Просим отзыв только
  // после закрытия заказа.
  if (
    order.productCategory === EnumProductCategory.CANVAS &&
    order.status === EnumStatus.SENT
  ) {
    return false;
  }
  if (!order.sentAt) return false;

  const delay = reviewReminderDelayMs(order.deliveryMethod);
  return order.sentAt <= new Date(now.getTime() - delay);
}
