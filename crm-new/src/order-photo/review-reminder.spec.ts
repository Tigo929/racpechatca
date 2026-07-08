import { buildReviewRequestText } from './review-reminder.service';

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
