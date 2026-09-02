import { CANVAS_SIZES, calcCanvasUnitPrice } from '../scenarios/products/canvas.pricing';

/**
 * Сверка прайса с розничным прайс-листом (синтетика, подрамник 2 см).
 *
 * Цены — то единственное, что нельзя проверить взглядом на интерфейс:
 * ошибка в одной цифре выглядит как обычное число и всплывает уже
 * в заказе. Поэтому контрольные точки закреплены тестом: восемь строк
 * из прайс-листа, включая обе границы диапазона.
 */
describe('прайс на холст', () => {
  const byKey = new Map(CANVAS_SIZES.map((s) => [s.key, s.price]));

  it.each([
    ['20x30', 630],
    ['20x40', 770],
    ['30x40', 940],
    ['40x50', 1270],
    ['50x70', 1830],
    ['60x90', 2460],
    ['80x100', 3110],
    ['100x200', 6470],
  ])('%s стоит %i ₽', (key, price) => {
    expect(byKey.get(key as string)).toBe(price);
  });

  it('в прайсе 46 размеров и ключи не повторяются', () => {
    expect(CANVAS_SIZES).toHaveLength(46);
    expect(new Set(CANVAS_SIZES.map((s) => s.key)).size).toBe(46);
  });

  it('самый дешёвый холст — 630 ₽, самый дорогой — 6470 ₽', () => {
    const prices = CANVAS_SIZES.map((s) => s.price);
    expect(Math.min(...prices)).toBe(630);
    expect(Math.max(...prices)).toBe(6470);
  });

  it('цена без опций равна цене из прайса', () => {
    expect(
      calcCanvasUnitPrice({ sizeKey: '30x40', material: 'MATTE', frame: 'NONE' }),
    ).toBe(940);
  });

  it('разрешение считается под 150 dpi', () => {
    const size = CANVAS_SIZES.find((x) => x.key === '30x40');
    expect(size?.minPixels).toEqual({ width: 1772, height: 2362 });
  });
});
