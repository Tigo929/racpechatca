import type { EnumTshirtSize } from 'src/generated/prisma/enums';
import { SIZE_TO_RUSSIAN_LABEL } from '../marketplace/ozon/ozon-attributes';
import { TSHIRT_SIZE_TAG, tshirtSizeLabel } from './tshirt-size';

/**
 * Подпись размера.
 *
 * Проверяется не форматирование само по себе, а то, ради чего оно сделано:
 * номер в скобках обязан совпадать с номером, которым размер уходит в
 * карточку маркетплейса. Разойдутся — клиент получит «46» на бирке и «48»
 * в макете, и спорить будет с нами.
 */
describe('подпись размера футболки', () => {
  const sizes: EnumTshirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  it('показывает букву и номер на бирке', () => {
    expect(sizes.map(tshirtSizeLabel)).toEqual([
      'XS(44)',
      'S(46)',
      'M(48)',
      'L(50)',
      'XL(52)',
      'XXL(54)',
      'XXXL(56)',
    ]);
  });

  it('номера те же, что уходят в карточку маркетплейса', () => {
    expect(SIZE_TO_RUSSIAN_LABEL).toEqual(TSHIRT_SIZE_TAG);
  });

  it('знает все размеры из перечисления', () => {
    for (const size of sizes) {
      expect(TSHIRT_SIZE_TAG[size]).toMatch(/^\d{2}$/);
    }
  });
});
