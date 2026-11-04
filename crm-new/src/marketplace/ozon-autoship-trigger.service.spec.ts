import { OrderEventsService } from 'src/events/order-events.service';
import { OzonAutoshipTriggerService } from './ozon-autoship-trigger.service';

/**
 * Сборка уходит в кабинет сразу, а не через опрос.
 *
 * Раньше отправление собирала только сверка раз в 15 минут. Владелец
 * нажимал «Передан в производство», шёл в Seller и видел отправление всё
 * ещё в «ждёт отгрузки» — для него автоматика просто не работала.
 *
 * Здесь проверяется ровно стык: событие смены статуса → один запрос
 * отправления → сборка. Решение «собирать или нет» живёт в
 * shouldShipToAssembly и проверено своими тестами.
 */

const POSTING = {
  postingNumber: '1234-0001-1',
  orderNumber: '1234-0001',
  status: 'awaiting_deliver',
  items: [{ sku: '987654321', quantity: 1 }],
} as never;

function build(
  opts: {
    enabled?: boolean;
    order?: Record<string, unknown> | null;
    posting?: unknown;
  } = {},
) {
  const events = new OrderEventsService();
  const ship = jest.fn().mockResolvedValue('shipped');
  const get = jest.fn().mockResolvedValue(
    opts.posting === undefined ? POSTING : opts.posting,
  );
  const order =
    opts.order === undefined
      ? {
          id: 'o1',
          numberOrder: '20261104-001',
          status: 'SENT',
          marketplacePostingNumber: '1234-0001-1',
          marketplaceAccountId: 'acc-1',
          marketplaceShipRequestedAt: null,
        }
      : opts.order;

  const service = new OzonAutoshipTriggerService(
    events,
    { orderPhoto: { findUnique: jest.fn().mockResolvedValue(order) } } as never,
    { enabled: opts.enabled ?? true, ship } as never,
    { credentials: jest.fn().mockResolvedValue({ clientId: '1' }) } as never,
    { get } as never,
  );
  service.onModuleInit();
  return { events, ship, get };
}

/** Событие обрабатывается в фоне — даём очереди микрозадач доработать. */
const settle = () => new Promise((r) => setTimeout(r, 0));

const EVENT = {
  orderId: 'o1',
  numberOrder: '20261104-001',
  isMarketplacePrint: true,
};

describe('передан в производство → собрать в кабинете', () => {
  it('отправление уходит на сборку сразу по событию', async () => {
    const { events, ship, get } = build();

    events.emitSentToProduction(EVENT);
    await settle();

    expect(get).toHaveBeenCalledWith(
      { clientId: '1' },
      '1234-0001-1',
    );
    expect(ship).toHaveBeenCalledTimes(1);
    expect(ship.mock.calls[0]![0]).toMatchObject({
      id: 'o1',
      marketplacePostingNumber: '1234-0001-1',
      marketplaceAccountId: 'acc-1',
    });
  });

  it('выключенная автоматика не трогает кабинет', async () => {
    // Выключатель должен останавливать и быстрый путь, иначе
    // OZON_AUTOSHIP_ENABLED=false перестал бы что-либо значить.
    const { events, ship, get } = build({ enabled: false });

    events.emitSentToProduction(EVENT);
    await settle();

    expect(get).not.toHaveBeenCalled();
    expect(ship).not.toHaveBeenCalled();
  });

  it('попытка уже была — второй сборки не будет', async () => {
    /*
      Иначе повторный перевод статуса собирал бы отправление снова, а на
      отказ площадки прилетало бы второе сообщение владельцу.
    */
    const { events, ship } = build({
      order: {
        id: 'o1',
        numberOrder: '20261104-001',
        status: 'SENT',
        marketplacePostingNumber: '1234-0001-1',
        marketplaceAccountId: 'acc-1',
        marketplaceShipRequestedAt: new Date(),
      },
    });

    events.emitSentToProduction(EVENT);
    await settle();

    expect(ship).not.toHaveBeenCalled();
  });

  it('площадка не отдала отправление — отметку не ставим, ждём сверку', async () => {
    const { events, ship } = build({ posting: null });

    events.emitSentToProduction(EVENT);
    await settle();

    expect(ship).not.toHaveBeenCalled();
  });

  it('заказ не маркетплейсный — отправления нет, сборки тоже', async () => {
    const { events, ship, get } = build({
      order: {
        id: 'o1',
        numberOrder: '20261104-001',
        status: 'SENT',
        marketplacePostingNumber: null,
        marketplaceAccountId: null,
        marketplaceShipRequestedAt: null,
      },
    });

    events.emitSentToProduction(EVENT);
    await settle();

    expect(get).not.toHaveBeenCalled();
    expect(ship).not.toHaveBeenCalled();
  });

  it('упавший обработчик не роняет процесс', async () => {
    /*
      Событие приходит из смены статуса. Исключение в подписчике не должно
      ни ронять процесс, ни откатывать статус: статус уже записан, а
      несобранное подберёт сверка.
    */
    const { events } = build({ posting: Promise.reject(new Error('Ozon 429')) });

    expect(() => events.emitSentToProduction(EVENT)).not.toThrow();
    await settle();
  });
});
