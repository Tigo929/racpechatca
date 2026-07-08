import { buildReviewRequestText } from './review-reminder.service';

describe('review reminder message', () => {
  it('uses a clean Avito review link and clear customer benefit', () => {
    const text = buildReviewRequestText();

    expect(text).toContain('https://www.avito.ru/user/review?fid=');
    expect(text).not.toContain('utm_source=chatgpt.com');
    expect(text).toContain('20 фотографий в стиле Polaroid');
    expect(text).toContain('доставка следующего заказа');
  });
});

