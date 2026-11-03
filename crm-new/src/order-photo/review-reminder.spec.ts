import { buildReviewRequestText } from './review-reminder.service';
import { isReviewReminderEligible } from './review-reminder-rules';

describe('review reminder message', () => {
  it('uses a clean Avito review link and promises the gift', () => {
    const text = buildReviewRequestText();

    expect(text).toContain('https://www.avito.ru/user/review?fid=');
    expect(text).not.toContain('utm_source=chatgpt.com');
    expect(text).toContain('подарим вам бесплатную доставку');
  });

  it('names what the person ordered', () => {
    expect(buildReviewRequestText('TSHIRT')).toContain('Как вам футболка');
    expect(buildReviewRequestText('CANVAS')).toContain('Как вам холст');
    expect(buildReviewRequestText()).toContain('Как вам фотографии');
  });
});

describe('review reminder eligibility', () => {
  const now = new Date('2026-07-09T00:00:00.000Z');
  const oldSentAt = new Date(now.getTime() - 85 * 60 * 60 * 1000);

  it('accepts sent and paid delivery orders after the 84 hour delay', () => {
    for (const status of ['SENT', 'PAID'] as const) {
      expect(
        isReviewReminderEligible(
          {
            productCategory: 'TSHIRT',
            status,
            deliveryMethod: 'YANDEX_PVZ',
            clientReviewLeft: false,
            reviewReminderNotifiedAt: null,
            sentAt: oldSentAt,
          },
          now,
        ),
      ).toBe(true);
    }
  });

  it('reminds pickup orders already after 24 hours', () => {
    expect(
      isReviewReminderEligible(
        {
          productCategory: 'PHOTO',
          status: 'PAID',
          deliveryMethod: 'PICKUP',
          clientReviewLeft: false,
          reviewReminderNotifiedAt: null,
          sentAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        },
        now,
      ),
    ).toBe(true);

    // до суток — ещё рано
    expect(
      isReviewReminderEligible(
        {
          productCategory: 'PHOTO',
          status: 'PAID',
          deliveryMethod: 'PICKUP',
          clientReviewLeft: false,
          reviewReminderNotifiedAt: null,
          sentAt: new Date(now.getTime() - 23 * 60 * 60 * 1000),
        },
        now,
      ),
    ).toBe(false);
  });

  it('keeps the 84 hour delay for delivery orders', () => {
    expect(
      isReviewReminderEligible(
        {
          productCategory: 'PHOTO',
          status: 'PAID',
          deliveryMethod: 'YANDEX_PVZ',
          clientReviewLeft: false,
          reviewReminderNotifiedAt: null,
          sentAt: new Date(now.getTime() - 83 * 60 * 60 * 1000),
        },
        now,
      ),
    ).toBe(false);
  });

  it('заказ с площадки ждёт выкупа, а не срока', () => {
    /*
     * Раньше здесь стоял таймер: пять дней от «Отгружен». Заказ CRM
     * закрывается, как только площадка взяла посылку, а везут её и лежит
     * она в пункте выдачи сколько придётся — просьба уходила человеку,
     * который товара ещё не видел.
     */
    const marketplace = {
      productCategory: 'TSHIRT',
      status: 'COMPLETED',
      deliveryMethod: 'YANDEX_PVZ',
      clientReviewLeft: false,
      reviewReminderNotifiedAt: null,
      sentAt: oldSentAt,
      isMarketplacePrint: true,
    } as const;

    // Отгружен месяц назад, но площадка не сказала «Доставлен» — молчим.
    expect(
      isReviewReminderEligible(
        { ...marketplace, marketplaceDeliveredAt: null },
        now,
      ),
    ).toBe(false);

    // Выкупил — спрашиваем сразу, ждать больше нечего.
    expect(
      isReviewReminderEligible({ ...marketplace, marketplaceDeliveredAt: now }, now),
    ).toBe(true);
  });

  it('выкуп работает не только у футболок', () => {
    /*
     * Правило было написано под футболки: только их и печатали для Ozon.
     * Фотокниги и холсты с площадки попадали под общее правило и получали
     * просьбу через 3,5 дня после передачи в печать.
     */
    for (const productCategory of ['PHOTO', 'CANVAS'] as const) {
      expect(
        isReviewReminderEligible(
          {
            productCategory,
            status: 'COMPLETED',
            deliveryMethod: 'YANDEX_PVZ',
            clientReviewLeft: false,
            reviewReminderNotifiedAt: null,
            sentAt: oldSentAt,
            isMarketplacePrint: true,
            marketplaceDeliveredAt: now,
          },
          now,
        ),
      ).toBe(true);
    }
  });

  it('выкуп не отменяет остальных запретов', () => {
    // Отзыв уже оставлен или просьба уже уходила — второй раз не пишем.
    const delivered = {
      productCategory: 'TSHIRT',
      status: 'COMPLETED',
      deliveryMethod: 'YANDEX_PVZ',
      sentAt: oldSentAt,
      isMarketplacePrint: true,
      marketplaceDeliveredAt: now,
    } as const;

    expect(
      isReviewReminderEligible(
        { ...delivered, clientReviewLeft: true, reviewReminderNotifiedAt: null },
        now,
      ),
    ).toBe(false);
    expect(
      isReviewReminderEligible(
        { ...delivered, clientReviewLeft: false, reviewReminderNotifiedAt: now },
        now,
      ),
    ).toBe(false);
  });

  it('does not remind after a previous notification or without sentAt', () => {
    expect(
      isReviewReminderEligible(
        {
          productCategory: 'PHOTO',
          status: 'SENT',
          deliveryMethod: 'PICKUP',
          clientReviewLeft: false,
          reviewReminderNotifiedAt: now,
          sentAt: oldSentAt,
        },
        now,
      ),
    ).toBe(false);

    // заказ, переведённый в PAID мимо SENT до фикса — sentAt нет
    expect(
      isReviewReminderEligible(
        {
          productCategory: 'PHOTO',
          status: 'PAID',
          deliveryMethod: 'PICKUP',
          clientReviewLeft: false,
          reviewReminderNotifiedAt: null,
          sentAt: null,
        },
        now,
      ),
    ).toBe(false);
  });
});
