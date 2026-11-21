import { bulkShipBlocker, isAwaitingShipment, ordersWord } from './bulk-ship';

describe('пачка «Отправлен»', () => {
  const ok = { productCategory: 'PHOTO', status: 'SHIPMENT_CREATED', executorId: 'u1' };

  it('галочка есть у фотозаказа в «Отгрузка создана»', () => {
    expect(isAwaitingShipment(ok)).toBe(true);
    expect(isAwaitingShipment({ ...ok, status: 'READY' })).toBe(false);
    expect(isAwaitingShipment({ ...ok, productCategory: 'CANVAS' })).toBe(false);
  });

  it('без исполнителя галочку не поставить — зарплата не начислилась бы', () => {
    expect(bulkShipBlocker(ok)).toBeNull();
    expect(bulkShipBlocker({ ...ok, executorId: null })).toMatch(/исполнитель/);
  });

  it('совпадает с сервером по футболкам и чужим статусам', () => {
    expect(bulkShipBlocker({ ...ok, productCategory: 'TSHIRT' })).not.toBeNull();
    expect(bulkShipBlocker({ ...ok, status: 'SENT' })).not.toBeNull();
  });

  it('склоняет «заказ»', () => {
    expect(ordersWord(1)).toBe('1 заказ');
    expect(ordersWord(3)).toBe('3 заказа');
    expect(ordersWord(5)).toBe('5 заказов');
    expect(ordersWord(11)).toBe('11 заказов');
    expect(ordersWord(22)).toBe('22 заказа');
  });
});
