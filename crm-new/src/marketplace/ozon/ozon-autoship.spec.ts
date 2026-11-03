import { packageProducts, shouldShipToAssembly } from './ozon-autoship';
import { groupForStatus } from './ozon-order-status';

/**
 * Правило автосборки.
 *
 * Единственное место во всей сверке, которое меняет что-то на стороне
 * площадки, — и единственное необратимое. Сборку в Ozon не отменить:
 * площадка считает посылку готовой, печатает ярлык и начинает ждать её у
 * перевозчика. Лишнее «да» означает, что срок пошёл против нас, а футболка
 * ещё не напечатана.
 *
 * Поэтому проверки написаны от запретов, а не от разрешений: каждый случай
 * здесь — отправление, которое собирать НЕЛЬЗЯ.
 */
describe('отправка на сборку', () => {
  const ready = {
    status: 'SENT',
    marketplaceShipRequestedAt: null,
    marketplaceGroup: groupForStatus('awaiting_deliver'),
    items: [{ sku: '123456789', quantity: 1 }],
  };

  it('передан в производство и ждёт отгрузки — собираем', () => {
    expect(shouldShipToAssembly(ready)).toBe(true);
  });

  it('до производства не собираем', () => {
    /*
     * Главный запрет. Футболки ещё нет: ни напечатана, ни упакована.
     * Собранное отправление означает «посылка готова, забирайте», и с
     * этого момента идёт срок, который мы не выдержим.
     */
    for (const status of [
      'LEAD',
      'NEW',
      'APPROVAL_SENT',
      'IN_PROGRESS',
      'PRINTED',
      'READY',
      'PROBLEM',
    ]) {
      expect(shouldShipToAssembly({ ...ready, status })).toBe(false);
    }
  });

  it('после закрытия заказа не собираем', () => {
    // COMPLETED ставит сама сверка — по факту отгрузки площадкой. Собирать
    // в этот момент значило бы делать то, что площадка уже сделала.
    for (const status of ['COMPLETED', 'PAID', 'CANCELLED']) {
      expect(shouldShipToAssembly({ ...ready, status })).toBe(false);
    }
  });

  it('второй раз не пробуем', () => {
    /*
     * Отказ площадки почти всегда требует человека: нет данных об
     * экземплярах, не тот склад, истёк срок. Попытка каждые 15 минут дала
     * бы поток одинаковых сообщений и ни одной собранной посылки.
     */
    expect(
      shouldShipToAssembly({
        ...ready,
        marketplaceShipRequestedAt: new Date('2026-11-03T10:00:00.000Z'),
      }),
    ).toBe(false);
  });

  it('не ждущее отгрузки отправление не трогаем', () => {
    for (const status of [
      'delivering',
      'delivered',
      'cancelled',
      'arbitration',
      'not_accepted',
    ]) {
      expect(
        shouldShipToAssembly({
          ...ready,
          marketplaceGroup: groupForStatus(status),
        }),
      ).toBe(false);
    }
  });

  it('отправление не нашлось — не собираем', () => {
    // Площадка не отдала его в списке: что там происходит, мы не знаем.
    expect(
      shouldShipToAssembly({ ...ready, marketplaceGroup: undefined }),
    ).toBe(false);
    expect(shouldShipToAssembly({ ...ready, marketplaceGroup: null })).toBe(
      false,
    );
  });

  it('без годных позиций не собираем', () => {
    // Упаковку описывают позиции. Пустая упаковка — это не «собрать всё»,
    // а запрос, который площадка либо отвергнет, либо поймёт по-своему.
    expect(shouldShipToAssembly({ ...ready, items: [] })).toBe(false);
    expect(shouldShipToAssembly({ ...ready, items: undefined })).toBe(false);
    expect(
      shouldShipToAssembly({ ...ready, items: [{ sku: null, quantity: 1 }] }),
    ).toBe(false);
  });
});

describe('позиции упаковки', () => {
  it('product_id — это sku позиции, а не наш артикул', () => {
    expect(packageProducts([{ sku: '987654321', quantity: 2 }])).toEqual([
      { product_id: 987654321, quantity: 2 },
    ]);
  });

  it('позиция без sku выбрасывается, а не подменяется', () => {
    // Подставить вместо sku что-нибудь другое значило бы собрать не тот
    // товар — Ozon сопоставляет упаковку с составом отправления по sku.
    expect(
      packageProducts([
        { sku: null, quantity: 1 },
        { sku: 'A-123', quantity: 1 },
        { sku: '0', quantity: 1 },
        { sku: '555', quantity: 1 },
      ]),
    ).toEqual([{ product_id: 555, quantity: 1 }]);
  });

  it('нулевое и отрицательное количество не проходит', () => {
    expect(
      packageProducts([
        { sku: '555', quantity: 0 },
        { sku: '556', quantity: -1 },
        { sku: '557', quantity: 1.5 },
      ]),
    ).toEqual([]);
  });

  it('несколько позиций уходят одной упаковкой', () => {
    // Заказ мы кладём в одну коробку. Делить на посылки — решение склада.
    expect(
      packageProducts([
        { sku: '1', quantity: 1 },
        { sku: '2', quantity: 3 },
      ]),
    ).toEqual([
      { product_id: 1, quantity: 1 },
      { product_id: 2, quantity: 3 },
    ]);
  });
});
