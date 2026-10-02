import { EnumProductCategory } from 'src/generated/prisma/enums';
import { buildReviewRequestText, reviewPlace } from './review-reminder.service';

/**
 * Просьба об отзыве: текст один, площадка и подарок зависят от источника.
 *
 * Тесты сторожат три вещи, в которых ошибка стоит дорого: площадку (зовём
 * человека туда, где он покупал), подарок на Ozon (его там быть не должно —
 * площадка запрещает вознаграждать за отзывы) и порядок фраз (подарок
 * раньше просьбы превращает отзыв в купленный).
 */
describe('просьба об отзыве', () => {
  const site = buildReviewRequestText(EnumProductCategory.PHOTO, 'WEBSITE');
  const avito = buildReviewRequestText(EnumProductCategory.PHOTO, 'AVITO');
  const ozon = buildReviewRequestText(EnumProductCategory.TSHIRT, 'OZON');

  it('клиента с сайта зовёт на Яндекс Карты, а не на Авито', () => {
    expect(site).toContain('yandex.ru/maps/org/raspechatka/169229058790/reviews/');
    expect(site).not.toContain('avito.ru');
  });

  it('ссылка на карты без координат и масштаба — они открывают не то на телефоне', () => {
    expect(site).not.toContain('ll=');
    expect(site).not.toContain('z=');
  });

  it('покупателя с Авито зовёт на Авито', () => {
    expect(avito).toContain('avito.ru');
    expect(avito).not.toContain('yandex.ru/maps');
  });

  it('покупателя с площадки зовёт на площадку', () => {
    expect(ozon).toContain('ozon.ru');
    expect(ozon).not.toContain('avito.ru');
    expect(ozon).not.toContain('yandex.ru/maps');
  });

  it('на Ozon подарка нет: площадка запрещает вознаграждать за отзывы', () => {
    expect(ozon).not.toContain('благодарность');
    expect(ozon).not.toContain('подарим');
    expect(ozon).not.toContain('доставку');
    expect(reviewPlace('OZON').gift).toBeNull();
    expect(reviewPlace('WB').gift).toBeNull();
  });

  it('своим клиентам подарок обещан', () => {
    expect(site).toContain('бесплатную доставку на следующий заказ');
    expect(avito).toContain('бесплатную доставку на следующий заказ');
  });

  it('подарок идёт ПОСЛЕ просьбы, а не вместо неё', () => {
    // Иначе это выглядит как покупка отзыва.
    expect(site.indexOf('оставить небольшой отзыв')).toBeLessThan(
      site.indexOf('в благодарность'),
    );
  });

  it('объясняет, зачем это покупателю, а не только нам', () => {
    expect(site).toContain('другим покупателям легче определиться');
  });

  it('называет то, что человек заказывал', () => {
    expect(
      buildReviewRequestText(EnumProductCategory.TSHIRT, 'AVITO'),
    ).toContain('футболку с принтом');
    expect(
      buildReviewRequestText(EnumProductCategory.CANVAS, 'AVITO'),
    ).toContain('печать на холсте');
    expect(site).toContain('печать фотографий');
  });

  it('без источника — прежнее поведение: текст Авито', () => {
    expect(buildReviewRequestText(EnumProductCategory.PHOTO)).toContain(
      'avito.ru',
    );
  });
});
