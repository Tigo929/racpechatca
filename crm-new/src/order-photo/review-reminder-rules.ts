import { EnumProductCategory, EnumStatus } from 'src/generated/prisma/enums';

export const REVIEW_REMINDER_DELAY_MS = 84 * 60 * 60 * 1000; // 3.5 days

export const REVIEW_REMINDER_CATEGORIES: EnumProductCategory[] = [
  EnumProductCategory.PHOTO,
  EnumProductCategory.TSHIRT,
];

export const REVIEW_REMINDER_STATUSES: EnumStatus[] = [
  EnumStatus.SENT,
  EnumStatus.PAID,
];

export function isReviewReminderEligible(
  order: {
    productCategory: EnumProductCategory;
    status: EnumStatus;
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

  return order.sentAt <= new Date(now.getTime() - REVIEW_REMINDER_DELAY_MS);
}
