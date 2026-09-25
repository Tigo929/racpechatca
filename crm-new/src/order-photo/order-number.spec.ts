import {
  displayOrderNumber,
  marketplaceNumber,
  normalizeMarketplaceNumber,
  MARKETPLACE_NUMBER_MAX,
} from './order-number';

/**
 * Два номера одного заказа.
 *
 * Заказ с площадки существует под её номером: он открыт в кабинете Ozon,
 * он же в переписке с покупателем. Внутренний номер CRM при этом остаётся
 * нетронутым — на нём держатся зарплата, задачи и отчёты. Правило выбора
 * живёт в одном месте, и эти тесты сторожат именно его.
 */
describe('номер заказа', () => {
  it('обычный заказ называется внутренним номером', () => {
    expect(displayOrderNumber({ numberOrder: '20260925-001' })).toBe(
      '20260925-001',
    );
    expect(
      displayOrderNumber({
        numberOrder: '20260925-001',
        marketplaceOrderNumber: null,
      }),
    ).toBe('20260925-001');
  });

  it('заказ с площадки называется её номером', () => {
    expect(
      displayOrderNumber({
        numberOrder: '20260925-001',
        marketplaceOrderNumber: '0123-4567-8901',
      }),
    ).toBe('0123-4567-8901');
  });

  it('пустой номер площадки равен его отсутствию', () => {
    // Иначе заказ выглядел бы «номерным», а показывал бы пустоту.
    for (const value of ['', '   ', '\n']) {
      expect(
        displayOrderNumber({
          numberOrder: '20260925-001',
          marketplaceOrderNumber: value,
        }),
      ).toBe('20260925-001');
      expect(
        marketplaceNumber({
          numberOrder: '20260925-001',
          marketplaceOrderNumber: value,
        }),
      ).toBeNull();
    }
  });

  it('номер из кабинета чистится от пробелов по краям', () => {
    expect(normalizeMarketplaceNumber('  0123-4567-8901 ')).toBe(
      '0123-4567-8901',
    );
  });

  it('пустое значение сохраняется как отсутствие номера, а не пустой строкой', () => {
    expect(normalizeMarketplaceNumber('')).toBeNull();
    expect(normalizeMarketplaceNumber('   ')).toBeNull();
    expect(normalizeMarketplaceNumber(null)).toBeNull();
    expect(normalizeMarketplaceNumber(undefined)).toBeNull();
  });

  it('слишком длинное значение обрезается по границе колонки', () => {
    const long = '9'.repeat(MARKETPLACE_NUMBER_MAX + 20);
    expect(normalizeMarketplaceNumber(long)).toHaveLength(
      MARKETPLACE_NUMBER_MAX,
    );
  });
});
