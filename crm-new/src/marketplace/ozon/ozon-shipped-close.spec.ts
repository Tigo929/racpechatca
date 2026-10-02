import { shouldCloseAsShipped } from './ozon-shipped-close';

/**
 * Когда заказ можно закрыть за площадкой.
 *
 * Ошибка здесь тихая в обе стороны: лишнее «да» уберёт из активных заказ,
 * который ещё печатают, а лишнее «нет» вернёт владельцу ручную работу,
 * ради избавления от которой всё и делалось. Поэтому правило живёт
 * отдельной функцией и проверяется по каждому состоянию.
 */
describe('закрытие заказа по отгрузке на площадке', () => {
  it('везут или доставили — закрываем', () => {
    for (const group of ['in_transit', 'delivered']) {
      expect(
        shouldCloseAsShipped({ status: 'SENT', marketplaceGroup: group }),
      ).toBe(true);
    }
  });

  it('ждёт отгрузки — не закрываем: посылка ещё у нас на столе', () => {
    expect(
      shouldCloseAsShipped({ status: 'SENT', marketplaceGroup: 'to_ship' }),
    ).toBe(false);
  });

  it('проблемное отправление не закрываем: с ним надо разбираться', () => {
    expect(
      shouldCloseAsShipped({ status: 'SENT', marketplaceGroup: 'problem' }),
    ).toBe(false);
  });

  it('отменённое на площадке не закрываем как отгруженное', () => {
    expect(
      shouldCloseAsShipped({ status: 'SENT', marketplaceGroup: 'cancelled' }),
    ).toBe(false);
  });

  it('отправление не нашли — ничего не трогаем', () => {
    expect(shouldCloseAsShipped({ status: 'SENT' })).toBe(false);
    expect(
      shouldCloseAsShipped({ status: 'SENT', marketplaceGroup: null }),
    ).toBe(false);
  });

  it('заказ в любом рабочем статусе закрывается', () => {
    for (const status of [
      'LEAD',
      'NEW',
      'APPROVAL_SENT',
      'SENT',
      'IN_PROGRESS',
      'READY',
      'SHIPMENT_CREATED',
      'DONE',
    ]) {
      expect(
        shouldCloseAsShipped({ status, marketplaceGroup: 'delivered' }),
      ).toBe(true);
    }
  });

  it('отменённый человеком заказ автоматика не воскрешает', () => {
    expect(
      shouldCloseAsShipped({ status: 'CANCELLED', marketplaceGroup: 'delivered' }),
    ).toBe(false);
  });

  it('уже завершённый не закрываем повторно', () => {
    expect(
      shouldCloseAsShipped({ status: 'COMPLETED', marketplaceGroup: 'delivered' }),
    ).toBe(false);
  });
});
