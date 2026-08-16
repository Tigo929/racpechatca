import { EnumDeliveryMethod, EnumStatus } from 'src/generated/prisma/enums';
import {
  buildShipmentReminder,
  dueReminderStage,
  hoursLeft,
  type ShipmentOrder,
} from './shipment-reminder-rules';

const H = 60 * 60 * 1000;
const START = new Date('2026-08-16T10:00:00Z');

function order(over: Partial<ShipmentOrder> = {}): ShipmentOrder {
  return {
    numberOrder: '20260816-001',
    status: EnumStatus.SHIPMENT_CREATED,
    deliveryMethod: EnumDeliveryMethod.YANDEX_PVZ,
    statusChangedAt: START,
    shipmentRemindersSent: 0,
    ...over,
  };
}

const at = (hours: number) => new Date(START.getTime() + hours * H);

describe('когда напоминать об отгрузке', () => {
  it('сразу после создания не дёргаем', () => {
    expect(dueReminderStage(order(), at(1))).toBeNull();
    expect(dueReminderStage(order(), at(5.9))).toBeNull();
  });

  it('три напоминания за 48 часов: через 6, 24 и 40 часов', () => {
    expect(dueReminderStage(order({ shipmentRemindersSent: 0 }), at(6))).toBe(1);
    expect(dueReminderStage(order({ shipmentRemindersSent: 1 }), at(24))).toBe(2);
    expect(dueReminderStage(order({ shipmentRemindersSent: 2 }), at(40))).toBe(3);
  });

  it('больше трёх раз не напоминаем — это уже шум', () => {
    expect(dueReminderStage(order({ shipmentRemindersSent: 3 }), at(47))).toBeNull();
    expect(dueReminderStage(order({ shipmentRemindersSent: 3 }), at(100))).toBeNull();
  });

  it('одно и то же напоминание не повторяется', () => {
    expect(dueReminderStage(order({ shipmentRemindersSent: 1 }), at(7))).toBeNull();
  });

  it('пропущенные стадии не досылаются пачкой — только актуальная', () => {
    // Бот молчал сутки: нужно одно сообщение про текущий срок, а не три подряд.
    expect(dueReminderStage(order({ shipmentRemindersSent: 0 }), at(41))).toBe(3);
  });

  it('после отправки замолкаем', () => {
    expect(
      dueReminderStage(order({ status: EnumStatus.SENT }), at(30)),
    ).toBeNull();
  });

  it('без даты смены статуса считать не от чего', () => {
    expect(dueReminderStage(order({ statusChangedAt: null }), at(30))).toBeNull();
  });
});

describe('остаток срока', () => {
  it('через 6 часов остаётся 42', () => {
    expect(hoursLeft(order(), at(6))).toBe(42);
  });

  it('через 40 часов остаётся 8', () => {
    expect(hoursLeft(order(), at(40))).toBe(8);
  });

  it('после 48 часов уходит в минус — срок вышел', () => {
    expect(hoursLeft(order(), at(50))).toBeLessThan(0);
  });
});

describe('текст напоминания', () => {
  it('по Яндексу называет остаток и последствие', () => {
    const text = buildShipmentReminder(order(), 1, '@ivan', at(6));
    expect(text).toContain('Осталось 42 ч из 48');
    expect(text).toContain('отменит поставку');
    expect(text).toContain('@ivan');
    expect(text).toContain('«Отправлен»');
  });

  it('последнее напоминание выделено как крайний срок', () => {
    const text = buildShipmentReminder(order(), 3, '@ivan', at(40));
    expect(text).toContain('последний срок');
    expect(text).toContain('Осталось 8 ч');
  });

  it('по Озону обратного отсчёта нет — срока не существует', () => {
    const text = buildShipmentReminder(
      order({ deliveryMethod: EnumDeliveryMethod.OZON_PVZ }),
      1,
      '@ivan',
      at(6),
    );
    expect(text).toContain('Озон');
    expect(text).not.toContain('48');
    expect(text).not.toContain('Осталось');
  });

  it('когда срок вышел, не врём про остаток', () => {
    const text = buildShipmentReminder(order(), 3, '@ivan', at(50));
    expect(text).toContain('вышел');
    expect(text).not.toContain('Осталось -');
  });

  it('без исполнителя честно пишем, что заказ ничей', () => {
    const text = buildShipmentReminder(order(), 1, null, at(6));
    expect(text).toContain('исполнитель не назначен');
  });
});
