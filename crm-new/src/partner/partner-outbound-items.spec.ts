import {
  NO_PRODUCTION_ITEMS_MESSAGE,
  hasProductionItems,
} from 'src/order-photo/tshirt-production-items';

/**
 * Что считается работой для исполнителя.
 *
 * Проверка живёт в трёх местах — смена статуса, отправка партнёру и
 * подготовка выплаты, — и одно из них про неё уже забывало: отправку
 * исполнителю блокировало собственное условие на позиции-футболки,
 * из-за чего заказ на печать по изделию заказчика провести было нельзя.
 * Тест закрывает именно тот случай, на котором это всплыло.
 */
describe('позиции, при которых заказ можно отдать исполнителю', () => {
  it('обычный заказ с футболкой', () => {
    expect(hasProductionItems({ tshirtItems: [{}], items: [] })).toBe(true);
  });

  it('печать по изделию заказчика — только свободная позиция', () => {
    // Футболку приносит клиент, позиции-футболки нет по определению.
    expect(hasProductionItems({ tshirtItems: [], items: [{}] })).toBe(true);
  });

  it('обе разновидности сразу', () => {
    expect(hasProductionItems({ tshirtItems: [{}], items: [{}] })).toBe(true);
  });

  it('пустой заказ отдавать нечего', () => {
    expect(hasProductionItems({ tshirtItems: [], items: [] })).toBe(false);
    expect(hasProductionItems({})).toBe(false);
    expect(hasProductionItems({ tshirtItems: null, items: null })).toBe(false);
  });

  it('текст отказа подсказывает выход, а не только называет проблему', () => {
    // «Нет позиций» без продолжения оставляет человека гадать, что делать.
    expect(NO_PRODUCTION_ITEMS_MESSAGE).toContain('изделие заказчика');
  });
});
