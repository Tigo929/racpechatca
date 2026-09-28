import { describe, expect, it } from 'vitest';
import { parseOzonArticle, stickerCode } from './ozon-article';

/**
 * Разбор артикула во фронте — зеркало серверного. Он показывает оператору,
 * что система поняла товар правильно, ДО того как заказ заведён. Ответы
 * обязаны совпадать с сервером: расхождение означало бы, что человек видит
 * одно, а в заказ уходит другое.
 */
describe('артикул Ozon', () => {
  it('цвет и размер читаются из артикула', () => {
    expect(parseOzonArticle('JDM-1-1-black-S')).toEqual({
      printSlug: 'JDM-1-1',
      colorCode: 'black',
      colorLabel: 'Чёрный',
      size: 'S',
    });
    expect(parseOzonArticle('labrov-nadpis-white-XXL')).toMatchObject({
      colorLabel: 'Белый',
      size: 'XXL',
      printSlug: 'labrov-nadpis',
    });
  });

  it('код принта с дефисами не ломает разбор', () => {
    expect(parseOzonArticle('labrov-nadpis-2-black-M')?.printSlug).toBe(
      'labrov-nadpis-2',
    );
  });

  it('чужая схема отвергается, а не угадывается', () => {
    for (const bad of ['', 'JDM-1-1', 'JDM-1-1-black', 'JDM-1-1-purple-S', null]) {
      expect(parseOzonArticle(bad)).toBeNull();
    }
  });

  it('стикер — последние четыре цифры номера отправления', () => {
    expect(stickerCode('0189070451-0031-1')).toBe('0311');
    expect(stickerCode('12')).toBeNull();
  });
});
