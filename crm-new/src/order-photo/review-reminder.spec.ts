import { buildReviewRequestText } from './review-reminder.service';
import { isReviewReminderEligible } from './review-reminder-rules';

describe('review reminder message', () => {
  it('uses a clean Avito review link and clear photo benefit', () => {
    const text = buildReviewRequestText();

    expect(text).toContain('https://www.avito.ru/user/review?fid=');
    expect(text).not.toContain('utm_source=chatgpt.com');
    expect(text).toContain('20 фотографий в стиле Polaroid');
    expect(text).toContain('доставка следующего заказа');
  });

  it('uses a T-shirt-specific gift offer', () => {
    const text = buildReviewRequestText('TSHIRT');

    expect(text).toContain('печати футболки');
    expect(text).toContain('макет/дизайн');
    expect(text).toContain('доставку следующего заказа');
  });
});

describe('review reminder eligibility', () => {
  const now = new Date('2026-07-09T00:00:00.000Z');
  const oldSentAt = new Date(now.getTime() - 85 * 60 * 60 * 1000);

  it('accepts sent and paid orders after the 84 hour delay', () => {
    for (const status of ['SENT', 'PAID'] as const) {
      expect(
        isReviewReminderEligible(
          {
            productCategory: 'TSHIRT',
            status,
            clientReviewLeft: false,
            reviewReminderNotifiedAt: null,
            sentAt: oldSentAt,
          },
          now,
        ),
      ).toBe(true);
    }
  });

  it('does not remind before the delay or after a previous notification', () => {
    expect(
      isReviewReminderEligible(
        {
          productCategory: 'PHOTO',
          status: 'PAID',
          clientReviewLeft: false,
          reviewReminderNotifiedAt: null,
          sentAt: new Date(now.getTime() - 83 * 60 * 60 * 1000),
        },
        now,
      ),
    ).toBe(false);

    expect(
      isReviewReminderEligible(
        {
          productCategory: 'PHOTO',
          status: 'SENT',
          clientReviewLeft: false,
          reviewReminderNotifiedAt: now,
          sentAt: oldSentAt,
        },
        now,
      ),
    ).toBe(false);
  });
});
