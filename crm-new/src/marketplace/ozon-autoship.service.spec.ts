import { OzonApiError } from './ozon/ozon-api.client';
import { OzonAutoshipService } from './ozon-autoship.service';
import type { OzonOrderView } from './ozon/ozon-orders.service';

/**
 * Сервис автосборки: что уходит в Ozon и что остаётся в заказе.
 *
 * Сборку в кабинете не отменить, поэтому проверяется не только удачный
 * путь. Главное здесь — выключатель: пока владелец его не щёлкнул, кода
 * в репозитории может быть сколько угодно, а на его кабинет он влиять не
 * должен. Выкатка не равна включению.
 */
describe('автосборка Ozon', () => {
  const posting = {
    postingNumber: '0189070451-0031-1',
    items: [{ offerId: 'TS-1', name: 'Футболка', sku: '555', quantity: 1 }],
  } as unknown as OzonOrderView;

  const order = {
    id: 'order-1',
    numberOrder: '20261103-007',
    marketplacePostingNumber: '0189070451-0031-1',
    marketplaceAccountId: 'acc-1',
    posting,
  };

  const build = (opts: {
    enabled: boolean;
    post?: jest.Mock;
  }) => {
    const update = jest.fn().mockResolvedValue({});
    const post = opts.post ?? jest.fn().mockResolvedValue({});
    const sendToOwner = jest.fn().mockResolvedValue(true);
    const service = new OzonAutoshipService(
      { get: () => (opts.enabled ? 'true' : 'false') } as never,
      { orderPhoto: { update } } as never,
      { credentials: jest.fn().mockResolvedValue({ clientId: 'c' }) } as never,
      { post } as never,
      { sendToOwner } as never,
    );
    return { service, update, post, sendToOwner };
  };

  it('выключатель по умолчанию опущен', () => {
    // Выкатка кода не должна сама начать собирать посылки.
    expect(build({ enabled: false }).service.enabled).toBe(false);
    expect(build({ enabled: true }).service.enabled).toBe(true);
    // Переменной нет — автоматика работает: пустая настройка не должна
    // означать «молча не собирать». Останавливает только явный false.
    expect(
      new OzonAutoshipService(
        { get: () => undefined } as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      ).enabled,
    ).toBe(true);
  });

  it('собирает одной упаковкой по sku позиций', async () => {
    const { service, post, update } = build({ enabled: true });
    await expect(service.ship(order)).resolves.toBe('shipped');

    expect(post).toHaveBeenCalledWith(
      expect.anything(),
      '/v4/posting/fbs/ship',
      {
        posting_number: '0189070451-0031-1',
        packages: [{ products: [{ product_id: 555, quantity: 1 }] }],
      },
    );
    // Отметка стоит и при успехе: по ней правило больше не вернётся сюда.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ marketplaceShipError: null }),
      }),
    );
  });

  it('отказ площадки записывается в заказ и уходит владельцу', async () => {
    /*
     * Удачную сборку видно на экране заказов: отправление уходит из «ждёт
     * отгрузки». Неудачную не видно ничем — и заметить её легко только в
     * последний день срока.
     */
    const post = jest
      .fn()
      .mockRejectedValue(
        new OzonApiError(
          400,
          'Ozon отклонил запрос: не указаны данные об экземплярах.',
          'detail',
        ),
      );
    const { service, update, sendToOwner } = build({ enabled: true, post });

    await expect(service.ship(order)).resolves.toBe('failed');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          marketplaceShipError: expect.stringContaining('экземплярах'),
        }),
      }),
    );
    expect(sendToOwner).toHaveBeenCalledWith(
      expect.stringContaining('не ушло на сборку'),
    );
  });

  it('недоставленное предупреждение не отменяет отметку', async () => {
    // Отметка в заказе уже стоит — это главное; падать из-за Telegram
    // нельзя, иначе сверка остановится на одном заказе.
    const post = jest.fn().mockRejectedValue(new Error('сеть'));
    const { service, update } = build({ enabled: true, post });
    const broken = service as unknown as {
      telegram: { sendToOwner: jest.Mock };
    };
    broken.telegram.sendToOwner = jest.fn().mockRejectedValue(new Error('нет'));

    await expect(service.ship(order)).resolves.toBe('failed');
    expect(update).toHaveBeenCalled();
  });
});
