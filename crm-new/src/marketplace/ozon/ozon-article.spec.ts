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
