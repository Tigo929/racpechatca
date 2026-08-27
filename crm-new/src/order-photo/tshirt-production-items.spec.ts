import {
  hasProductionItems,
  NO_PRODUCTION_ITEMS_MESSAGE,
} from './tshirt-production-items';

/**
 * Заказ на печать по изделию заказчика обязан проходить наравне с обычным.
 *
 * Раньше проверялось только наличие позиций-футболок, и такой заказ упирался
 * в «В заказе нет позиций-футболок»: футболку приносит клиент, мы наносим
 * принт, и позиции-футболки там нет по определению. Работа при этом есть —
 * она записана свободной позицией.
 */
describe('hasProductionItems', () => {
  it('обычный заказ на футболки проходит', () => {
    expect(hasProductionItems({ tshirtItems: [{}], items: [] })).toBe(true);
  });

  it('печать по изделию заказчика проходит — работа в свободной позиции', () => {
    expect(hasProductionItems({ tshirtItems: [], items: [{}] })).toBe(true);
  });

  it('смешанный заказ проходит', () => {
    expect(hasProductionItems({ tshirtItems: [{}], items: [{}] })).toBe(true);
  });

  it('пустой заказ не проходит — печатать нечего', () => {
    expect(hasProductionItems({ tshirtItems: [], items: [] })).toBe(false);
    expect(hasProductionItems({})).toBe(false);
    expect(hasProductionItems({ tshirtItems: null, items: null })).toBe(false);
  });

  it('в отказе сказано, что делать, а не только что не так', () => {
    expect(NO_PRODUCTION_ITEMS_MESSAGE).toContain('Нанесение принта');
  });
});
