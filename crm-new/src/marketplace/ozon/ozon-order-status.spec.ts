import {
  groupForStatus,
  isShipmentOverdue,
  statusLabel,
} from './ozon-order-status';

describe('группировка статусов заказов Ozon', () => {
  it('сводит статусы ожидания отгрузки в одну группу', () => {
    for (const s of [
      'awaiting_packaging',
      'awaiting_deliver',
      'awaiting_approve',
      'awaiting_registration',
      'acceptance_in_progress',
    ]) {
      expect(groupForStatus(s)).toBe('to_ship');
    }
  });

  it('различает доставку, доставленные и отменённые', () => {
    expect(groupForStatus('delivering')).toBe('in_transit');
    expect(groupForStatus('driver_pickup')).toBe('in_transit');
    expect(groupForStatus('delivered')).toBe('delivered');
    expect(groupForStatus('cancelled')).toBe('cancelled');
    expect(groupForStatus('arbitration')).toBe('problem');
  });

  it('незнакомый статус показывает как проблемный, а не прячет', () => {
    expect(groupForStatus('какой_то_новый_статус')).toBe('problem');
  });

  it('подпись неизвестного статуса не теряется', () => {
    expect(statusLabel('awaiting_deliver')).toBe('Ждёт отгрузки');
    expect(statusLabel('nonexistent')).toBe('nonexistent');
  });
});

describe('просрочка отгрузки', () => {
  const now = new Date('2026-08-17T22:00:00Z');

  it('срок прошёл, а заказ не отгружен — просрочен', () => {
    expect(isShipmentOverdue('to_ship', '2026-08-17T15:00:00Z', now)).toBe(
      true,
    );
  });

  it('срок ещё не наступил — не просрочен', () => {
    expect(isShipmentOverdue('to_ship', '2026-08-18T15:00:00Z', now)).toBe(
      false,
    );
  });

  it('у доставленного заказа прошедший срок отгрузки — норма', () => {
    expect(isShipmentOverdue('delivered', '2026-06-21T09:14:00Z', now)).toBe(
      false,
    );
    expect(isShipmentOverdue('cancelled', '2026-06-21T09:14:00Z', now)).toBe(
      false,
    );
  });

  it('без даты отгрузки просрочки нет', () => {
    expect(isShipmentOverdue('to_ship', null, now)).toBe(false);
  });

  it('битую дату не считаем просрочкой', () => {
    expect(isShipmentOverdue('to_ship', 'не дата', now)).toBe(false);
  });
});
