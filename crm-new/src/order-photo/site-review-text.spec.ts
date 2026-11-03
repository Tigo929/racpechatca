import { EnumProductCategory } from 'src/generated/prisma/enums';
import { buildReviewRequestText, reviewPlace } from './review-reminder.service';

/**
 * Просьба об отзыве: текст один, площадка и подарок зависят от источника.
 *
 * Тесты сторожат три вещи, в которых ошибка стоит дорого: площадку (зовём
 * человека туда, где он покупал), формулировку подарка (вознаграждение ЗА
 * ОТЗЫВ площадки запрещают — обещать можно только подарок к следующему
 * заказу) и порядок фраз (подарок раньше просьбы превращает отзыв в
 * купленный).
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

  it('на площадке зовём по ссылке из самого заказа, если она указана', () => {
    // Владелец вводит её, заводя отправление: это адрес конкретного заказа
    // покупателя, а не общий список. Общий список — запасной вариант.
    const text = buildReviewRequestText(
      EnumProductCategory.TSHIRT,
      'OZON',
      'https://www.ozon.ru/my/orderlist/12345',
    );
    expect(text).toContain('https://www.ozon.ru/my/orderlist/12345');
    expect(reviewPlace('OZON', 'https://ozon.ru/t/abc').url).toBe(
      'https://ozon.ru/t/abc',
    );
  });

  it('мусор вместо ссылки не уходит клиенту: остаётся общий список', () => {
    // В поле связи у заказа бывает не адрес, а номер отправления —
    // отправлять такое ссылкой нельзя.
    expect(reviewPlace('OZON', '61338075-0033-1').url).toContain(
      'ozon.ru/my/orderlist',
    );
    expect(reviewPlace('OZON', '  ').url).toContain('ozon.ru/my/orderlist');
    expect(reviewPlace('OZON').url).toContain('ozon.ru/my/orderlist');
  });

  it('подарок обещан везде, но нигде не ЗА отзыв', () => {
    /*
     * Решение владельца 03.11.2026: подарок обещаем и покупателям с
     * площадки. До этого на Ozon его не было вовсе — из опасения, что это
     * нарушает запрет вознаграждать за отзывы.
     *
     * Запрет касается платы ИМЕННО ЗА ОТЗЫВ. Поэтому текст обещает подарок
     * к следующему заказу — это программа лояльности, которую площадки не
     * запрещают, — и ни в одном варианте не связывает подарок с отзывом
     * словами «за отзыв» или «в благодарность за отзыв». Эта проверка и
     * сторожит формулировку: подарок останется, а условие появиться не
     * должно.
     */
    for (const text of [site, avito, ozon]) {
      expect(text).toContain('🎁');
      expect(text).not.toContain('за отзыв');
      expect(text).not.toContain('в благодарность');
    }
    // Доставку на площадке считает она сама — дарить её нечем.
    expect(ozon).not.toContain('доставку');
    expect(ozon).toContain('к следующему заказу приготовим');
    expect(reviewPlace('OZON').gift).toContain('подарок');
    expect(reviewPlace('WB').gift).toContain('подарок');
  });

  it('своим клиентам обещана бесплатная доставка', () => {
    expect(site).toContain('подарим вам бесплатную доставку');
    expect(avito).toContain('подарим вам бесплатную доставку');
  });

  it('подарок идёт ПОСЛЕ просьбы, а не вместо неё', () => {
    // Иначе это выглядит как покупка отзыва.
    for (const text of [site, avito, ozon]) {
      expect(text.indexOf('оставить небольшой отзыв')).toBeLessThan(
        text.indexOf('🎁'),
      );
    }
  });

  it('начинается вопросом о товаре, а не просьбой', () => {
    /*
     * «Как вам футболка?» — вопрос, на который отвечают. «Оставьте отзыв»
     * первой строкой — просьба, которую пролистывают. Поэтому вопрос стоит
     * раньше, и в нём названа сама вещь.
     */
    expect(ozon).toContain('Как вам футболка');
    expect(site).toContain('Как вам фотографии');
    expect(
      buildReviewRequestText(EnumProductCategory.CANVAS, 'AVITO'),
    ).toContain('Как вам холст');

    for (const text of [site, avito, ozon]) {
      expect(text.indexOf('Как вам')).toBeLessThan(
        text.indexOf('оставить небольшой отзыв'),
      );
    }
  });

  it('приглашает написать нам, если что-то не так', () => {
    /*
     * Недовольный покупатель напишет всё равно. Лучше нам, пока заказ можно
     * переделать, чем сразу в отзыв, который останется навсегда.
     */
    for (const text of [site, avito, ozon]) {
      expect(text).toContain('Если что-то не так, напишите нам');
      expect(text.indexOf('Если что-то не так')).toBeLessThan(
        text.indexOf('оставить небольшой отзыв'),
      );
    }
  });

  it('объясняет, зачем это покупателю, а не только нам', () => {
    expect(site).toContain('другим покупателям легче определиться');
  });

  it('не обещает того, чего мы не знаем', () => {
    /*
     * Своим клиентам просьба уходит по таймеру от отправки — доехала
     * посылка или нет, мы в этот момент не знаем. «Заказ уже у вас» было бы
     * догадкой, и у половины людей — неверной.
     */
    for (const text of [site, avito, ozon]) {
      expect(text).not.toContain('уже у вас');
      expect(text).not.toContain('получили заказ');
    }
  });

  it('называет то, что человек заказывал, и ровно один раз', () => {
    // Вещь называет сам вопрос. До 03.11.2026 её называла ещё и первая
    // фраза, и выходило «доверили нам футболку… как вам футболка» подряд.
    const tshirt = buildReviewRequestText(EnumProductCategory.TSHIRT, 'AVITO');
    expect(tshirt).toContain('Как вам футболка');
    expect(tshirt.match(/футболк/gi)).toHaveLength(1);

    const canvas = buildReviewRequestText(EnumProductCategory.CANVAS, 'AVITO');
    expect(canvas).toContain('Как вам холст');
    expect(canvas.match(/холст/gi)).toHaveLength(1);

    expect(site).toContain('Как вам фотографии');
    expect(site.match(/фотограф/gi)).toHaveLength(1);
  });

  it('без источника — прежнее поведение: текст Авито', () => {
    expect(buildReviewRequestText(EnumProductCategory.PHOTO)).toContain(
      'avito.ru',
    );
  });
});
