import {
  EnumDeliveryMethod,
  EnumProductCategory,
  EnumStatus,
} from 'src/generated/prisma/enums';
import { isReviewReminderEligible, reviewDueAt } from './review-reminder-rules';

const day = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-26T12:00:00Z');
const base = {
  productCategory: EnumProductCategory.PHOTO,
  status: EnumStatus.SENT,
  deliveryMethod: EnumDeliveryMethod.OZON_PVZ,
  clientReviewLeft: false,
  reviewReminderNotifiedAt: null,
  sentAt: new Date(now.getTime() - 5 * day),
  isMarketplacePrint: false,
  ozonShipment: { status: 'AT_PICKUP_POINT' },
  pickedUpAt: null as Date | null,
};

describe('отзыв по своему отправлению Ozon', () => {
  it('пока клиент не забрал — не просим, даже если 3,5 дня прошло', () => {
    expect(isReviewReminderEligible(base, now)).toBe(false);
  });

  it('забрал только что — ждём 30 минут', () => {
    const pickedUpAt = new Date(now.getTime() - 10 * 60_000);
    expect(isReviewReminderEligible({ ...base, pickedUpAt }, now)).toBe(false);
  });

  it('забрал полчаса назад — просим', () => {
    const pickedUpAt = new Date(now.getTime() - 31 * 60_000);
    expect(isReviewReminderEligible({ ...base, pickedUpAt }, now)).toBe(true);
    expect(reviewDueAt({ ...base, pickedUpAt })).toEqual(pickedUpAt);
  });

  it('Ozon так и не сказал «забрал» — просим через 14 дней', () => {
    expect(
      isReviewReminderEligible(
        { ...base, sentAt: new Date(now.getTime() - 15 * day) },
        now,
      ),
    ).toBe(true);
  });

  it('без отправления Ozon — старое правило 3,5 дня', () => {
    expect(isReviewReminderEligible({ ...base, ozonShipment: null }, now)).toBe(
      true,
    );
    expect(
      isReviewReminderEligible(
        { ...base, ozonShipment: { status: 'CANCELLED' } },
        now,
      ),
    ).toBe(true);
  });
});
