import { CANVAS_PRODUCTION_PRICES } from './canvas-production-price';
import { CANVAS_SIZES, findCanvasSize } from '../scenarios/products/canvas.pricing';

/**
 * Цена холста для клиента — одна на сайт и на CRM.
 *
 * Заявка приходит с сайта с размером и ценой этого размера. Менеджер
 * размер правит, и цена должна ехать следом — иначе заказ уходит в работу
 * с суммой за прежний размер. Чтобы подставлять её в карточке, прайс
 * производства отдаёт рядом и витринную цену — ту же, что читает сайт
 * через /canvas/pricing.
 *
 * Два прайса ведутся раздельно: витринный (CANVAS_SIZES) и
 * производственный (CANVAS_PRODUCTION_PRICES). Связывает их только
 * совпадение ключей размера. Разойдутся ключи — подстановка молча
 * перестанет работать на тех размерах, которые разошлись: цена останется
 * от прежнего размера, а в карточке не будет ни ошибки, ни подписи.
 * Поэтому ключи сторожит тест, а не внимательность.
 */

describe('витринная цена холста рядом с производственной', () => {
  it('ключи размеров совпадают в обоих прайсах', () => {
    const shop = CANVAS_SIZES.map((size) => size.key).sort();
    const production = CANVAS_PRODUCTION_PRICES.map((row) => row.key).sort();
    expect(production).toEqual(shop);
  });

  it('у каждого производственного размера есть цена для клиента', () => {
    const missing = CANVAS_PRODUCTION_PRICES.filter(
      (row) => !findCanvasSize(row.key),
    ).map((row) => row.key);
    expect(missing).toEqual([]);
  });

  it('витринная цена не ноль и не ниже оптовой', () => {
    /*
      Ноль в витринной цене подставился бы в заказ молча. А цена ниже
      оптовой означает, что мы продаём дешевле, чем покупаем, — такое
      бывает только по ошибке в прайсе, и увидеть её лучше здесь, чем
      в отчёте по марже через месяц.
    */
    const broken = CANVAS_PRODUCTION_PRICES.filter((row) => {
      const shop = findCanvasSize(row.key);
      return !shop || shop.price <= 0 || shop.price < row.wholesaleSynthetic;
    }).map((row) => row.key);
    expect(broken).toEqual([]);
  });

  it('размеры подписаны одинаково в обоих прайсах', () => {
    // Иначе менеджер выбирает «30 × 40 см», а в заказ ложится «30×40 см»:
    // то же самое для человека и разное для поиска по заказам.
    const shop = new Map(
      CANVAS_SIZES.map((size) => [size.key, size.label.replace(/\s/g, '')]),
    );
    const mismatched = CANVAS_PRODUCTION_PRICES.filter(
      (row) => shop.get(row.key) !== `${row.widthCm}×${row.heightCm}см`,
    ).map((row) => row.key);
    expect(mismatched).toEqual([]);
  });
});
