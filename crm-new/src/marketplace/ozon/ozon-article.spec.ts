import { buildOfferId, colorCodeFor } from './ozon-attributes';
import { parseOzonArticle, stickerCode, STICKER_DIGITS } from './ozon-article';

/**
 * Разбор артикула — единственный источник цвета и размера для заказа
 * с площадки. Ошибка здесь стоит заготовки: «black» на белой футболке
 * замечают после печати.
 */
describe('артикул Ozon', () => {
  it('разбирает то, что собрал buildOfferId', () => {
    // Обратная операция к выгрузке карточек: если одна изменится, вторая
    // должна сломаться в тесте, а не на складе.
    for (const [slug, label, size] of [
      ['JDM-1-1', 'чёрный', 'S'],
      ['labrov-nadpis', 'белый', 'XXL'],
      ['cat', 'черный', 'XXXL'],
    ] as const) {
      const offerId = buildOfferId(slug, colorCodeFor(label), size);
      const parsed = parseOzonArticle(offerId);
      expect(parsed).not.toBeNull();
      expect(parsed!.printSlug).toBe(slug);
      expect(parsed!.size).toBe(size);
    }
  });

  it('чёрный и белый узнаются по коду цвета', () => {
    expect(parseOzonArticle('JDM-1-1-black-S')).toMatchObject({
      colorCode: 'black',
      colorLabel: 'Чёрный',
      size: 'S',
      printSlug: 'JDM-1-1',
    });
    expect(parseOzonArticle('JDM-1-1-white-XL')).toMatchObject({
      colorCode: 'white',
      colorLabel: 'Белый',
      size: 'XL',
    });
  });

  it('код принта может содержать дефисы — разбираем с конца', () => {
    expect(parseOzonArticle('labrov-nadpis-2-black-M')?.printSlug).toBe(
      'labrov-nadpis-2',
    );
  });

  it('размер читается в любом регистре', () => {
    expect(parseOzonArticle('cat-black-xxl')?.size).toBe('XXL');
  });

  it('чужая схема артикула не разбирается, а отвергается', () => {
    // Гадать нельзя: подставленный наугад «Чёрный, M» дороже отказа.
    for (const bad of [
      '',
      'JDM-1-1',
      'JDM-1-1-black',
      'JDM-1-1-black-XXXXL',
      'JDM-1-1-purple-S',
      'black-S',
      null,
      undefined,
    ]) {
      expect(parseOzonArticle(bad)).toBeNull();
    }
  });

  it('живой артикул линейки Customer разбирается целиком', () => {
    // Формат из кабинета: customer-black-1-L — принт «customer», номер
    // принта «1», цвет «black», размер последним. Номер остаётся в коде
    // принта: Customer-1 и Customer-2 — разные макеты, и слить их в один
    // код значило бы напечатать не тот.
    expect(parseOzonArticle('customer-black-1-L')).toEqual({
      printSlug: 'customer-1',
      colorCode: 'black',
      colorLabel: 'Чёрный',
      size: 'L',
    });
    for (const size of ['s', 'm', 'l', 'xl', 'xxl']) {
      expect(parseOzonArticle(`customer-black-1-${size}`)?.size).toBe(
        size.toUpperCase(),
      );
    }
  });

  it('новая линейка: цвет стоит в середине артикула', () => {
    /*
     * «Customer Black-1» заведён в кабинете так, что цвет оказался не
     * предпоследним куском, а раньше номера принта. Отсчёт от конца дал бы
     * цвет «1» — и заказ не завёлся бы вовсе: ни цвета, ни размера.
     */
    expect(parseOzonArticle('customer-black-1-XS')).toMatchObject({
      printSlug: 'customer-1',
      colorCode: 'black',
      colorLabel: 'Чёрный',
      size: 'XS',
    });
  });

  it('тот же принт в другом цвете — тот же код принта', () => {
    // «Customer Black-1» и «Customer White-1» — один макет в двух цветах,
    // а не два разных: цвет у позиции и так свой.
    expect(parseOzonArticle('customer-white-1-S')?.printSlug).toBe(
      'customer-1',
    );
    expect(parseOzonArticle('customer-black-1-S')?.printSlug).toBe(
      'customer-1',
    );
  });

  it('«2XL» — это XXL, как бы ни написали в карточке', () => {
    // Размерный ряд новых карточек — XS…2XL. Непонятый размер означает
    // незаведённый заказ и ненапечатанную футболку.
    expect(parseOzonArticle('customer-black-1-2XL')?.size).toBe('XXL');
    expect(parseOzonArticle('papa-black-3xl')?.size).toBe('XXXL');
  });

  it('цвет в коде принта не путается с цветом футболки', () => {
    // Берём тот код цвета, что ближе к размеру: слово «black» бывает и
    // частью названия принта.
    expect(parseOzonArticle('black-star-white-M')).toMatchObject({
      printSlug: 'black-star',
      colorLabel: 'Белый',
    });
  });

  it('стикер — последние цифры номера отправления', () => {
    expect(stickerCode('0189070451-0031-1')).toBe('0311');
    expect(stickerCode('12345678')).toBe('5678');
    expect(stickerCode('12345678')).toHaveLength(STICKER_DIGITS);
  });

  it('короткий или пустой номер стикера не даёт', () => {
    expect(stickerCode('12')).toBeNull();
    expect(stickerCode('')).toBeNull();
    expect(stickerCode(null)).toBeNull();
  });
});
