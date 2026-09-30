import { EnumProductCategory } from 'src/generated/prisma/enums';
import {
  buildReviewRequestText,
  buildSiteReviewRequestText,
} from './review-reminder.service';

/**
 * Просьба об отзыве у клиента с сайта.
 *
 * Он не покупал на Авито — звать его туда некуда, площадка отзыв без сделки
 * не примет. Тесты сторожат площадку, подарок и порядок фраз: если подарок
 * окажется раньше просьбы, отзыв читается как купленный.
 */
describe('просьба об отзыве для клиента с сайта', () => {
  const text = buildSiteReviewRequestText(EnumProductCategory.PHOTO);

  it('зовёт на Яндекс Карты, а не на Авито', () => {
    expect(text).toContain(
      'yandex.ru/maps/org/raspechatka/169229058790/reviews/',
    );
    expect(text).not.toContain('avito.ru');
  });

  it('ссылка без координат и масштаба — они открывают не то на телефоне', () => {
    expect(text).not.toContain('ll=');
    expect(text).not.toContain('z=');
  });

  it('просит мнение и объясняет зачем', () => {
    expect(text).toContain('поможет ваше мнение');
    expect(text).toContain('находят новые люди');
  });

  it('подсказывает про пять звёзд', () => {
    expect(text).toMatch(/пят[ии] звёзд/i);
  });

  it('обещает выбор: доставка или полароиды', () => {
    expect(text).toContain('бесплатную доставку');
    expect(text).toContain('10–15 фотографий в стиле Polaroid');
  });

  it('подарок идёт ПОСЛЕ просьбы, а не вместо неё', () => {
    // Иначе это выглядит как покупка отзыва.
    expect(text.indexOf('поможет ваше мнение')).toBeLessThan(
      text.indexOf('в благодарность'),
    );
  });

  it('называет то, что человек заказывал', () => {
    expect(buildSiteReviewRequestText(EnumProductCategory.TSHIRT)).toContain(
      'футболку с принтом',
    );
    expect(buildSiteReviewRequestText(EnumProductCategory.CANVAS)).toContain(
      'печать на холсте',
    );
    expect(text).toContain('печать фотографий');
  });

  it('источник решает площадку: сайт — Яндекс, остальные — Авито', () => {
    const site = buildReviewRequestText(EnumProductCategory.PHOTO, 'WEBSITE');
    const avito = buildReviewRequestText(EnumProductCategory.PHOTO, 'AVITO');
    expect(site).toContain('yandex.ru/maps');
    expect(avito).toContain('avito.ru');
    // Без источника — прежнее поведение: текст Авито.
    expect(buildReviewRequestText(EnumProductCategory.PHOTO)).toContain(
      'avito.ru',
    );
  });
});
