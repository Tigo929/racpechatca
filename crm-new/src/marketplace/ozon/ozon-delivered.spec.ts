import { isMarketplaceDelivered } from './ozon-shipped-close';
import { groupForStatus } from './ozon-order-status';

/**
 * Выкуп — не то же самое, что отгрузка.
 *
 * Заказ CRM закрывается, как только посылка уехала: нашей работы в ней
 * больше нет. Для покупателя в этот момент не изменилось ничего — товара он
 * не видел. Спрашивать «как вам футболка» можно только после выкупа, и
 * ровно это условие проверяется здесь: `delivered` — да, всё остальное,
 * включая «везут», — нет.
 */
describe('выкуп на площадке', () => {
  it('доставленное отправление считается выкупленным', () => {
    expect(isMarketplaceDelivered(groupForStatus('delivered'))).toBe(true);
  });

  it('везут — ещё не выкупил', () => {
    for (const status of ['sent_by_seller', 'driver_pickup', 'delivering']) {
      expect(isMarketplaceDelivered(groupForStatus(status))).toBe(false);
    }
  });

  it('ждёт отгрузки, отменён, арбитраж — не выкуп', () => {
    for (const status of [
      'awaiting_deliver',
      'awaiting_packaging',
      'cancelled',
      'arbitration',
      'not_accepted',
    ]) {
      expect(isMarketplaceDelivered(groupForStatus(status))).toBe(false);
    }
  });

  it('отправление не нашлось — не выкуп', () => {
    // Площадка не отдала заказ в списке: молчим, а не додумываем.
    expect(isMarketplaceDelivered(undefined)).toBe(false);
    expect(isMarketplaceDelivered(null)).toBe(false);
    expect(isMarketplaceDelivered('')).toBe(false);
  });
});
