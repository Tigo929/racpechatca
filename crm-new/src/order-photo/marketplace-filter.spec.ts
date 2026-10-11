import { OrderPhotoService } from './order-photo.service';

/**
 * Раздел «Футболки» показывает заказы по заявкам, а не с площадок.
 *
 * Футболки приходят двумя потоками: заказ с Ozon ведёт сама площадка —
 * там номер отправления вместо номера заказа, свои сроки отгрузки и нет
 * шага оплаты. В одном списке с заказами по заявкам они путают, и для них
 * есть отдельный раздел.
 *
 * Проверяем сам отбор: что параметр доходит до условия выборки и означает
 * именно то, что написано на кнопке.
 */
describe('отбор заказов по происхождению', () => {
  // buildOrdersWhere приватный: зовём через прототип — это тот же код,
  // которым пользуется список, и подменять его копией бессмысленно.
  const where = (
    query: Record<string, unknown>,
    role = 'ADMIN',
  ): Record<string, unknown> =>
    (
      OrderPhotoService.prototype as unknown as {
        buildOrdersWhere: (
          q: unknown,
          userId: string,
          role: string,
          options: { applyListStatusDefaults: boolean },
        ) => Record<string, unknown>;
      }
    ).buildOrdersWhere.call({}, query, 'user-1', role, {
      applyListStatusDefaults: false,
    });

  it('«По заявкам» прячет заказы с площадок', () => {
    expect(where({ marketplace: 'exclude' }).isMarketplacePrint).toBe(false);
  });

  it('«С маркетплейса» оставляет только их', () => {
    expect(where({ marketplace: 'only' }).isMarketplacePrint).toBe(true);
  });

  it('без параметра не фильтруем вовсе', () => {
    // Иначе «Все» показывало бы не все: фильтр по умолчанию не должен
    // прятать заказы молча.
    expect(where({})).not.toHaveProperty('isMarketplacePrint');
  });

  it('отбор не мешает остальным условиям', () => {
    const result = where({ marketplace: 'exclude', productCategory: 'TSHIRT' });
    expect(result.productCategory).toBe('TSHIRT');
    expect(result.isMarketplacePrint).toBe(false);
  });
});
