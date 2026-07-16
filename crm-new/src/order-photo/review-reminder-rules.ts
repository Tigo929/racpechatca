import {
  EnumDeliveryMethod,
  EnumProductCategory,
  EnumStatus,
} from 'src/generated/prisma/enums';

/** Доставка (ПВЗ и т.п.): просим отзыв через 3,5 дня после отправки. */
export const REVIEW_REMINDER_DELAY_MS = 84 * 60 * 60 * 1000; // 3.5 days

/** Самовывоз: клиент получил заказ сразу — просим отзыв уже на следующий день. */
export const REVIEW_REMINDER_PICKUP_DELAY_MS = 24 * 60 * 60 * 1000; // 1 day

export const REVIEW_REMINDER_CATEGORIES: EnumProductCategory[] = [
  EnumProductCategory.PHOTO,
  EnumProductCategory.TSHIRT,
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
  },
  now = new Date(),
): boolean {
  if (!REVIEW_REMINDER_CATEGORIES.includes(order.productCategory)) return false;
  if (!REVIEW_REMINDER_STATUSES.includes(order.status)) return false;
  if (order.clientReviewLeft) return false;
  if (order.reviewReminderNotifiedAt) return false;
  if (!order.sentAt) return false;

  const delay = reviewReminderDelayMs(order.deliveryMethod);
  return order.sentAt <= new Date(now.getTime() - delay);
}
