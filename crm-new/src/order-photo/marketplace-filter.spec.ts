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
    applyListStatusDefaults = false,
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
      applyListStatusDefaults,
    });

  it('«По заявкам» прячет заказы с площадок', () => {
    expect(where({ marketplace: 'exclude' }).isMarketplacePrint).toBe(false);
  });

  it('«С маркетплейса» оставляет только их', () => {
    expect(where({ marketplace: 'only' }).isMarketplacePrint).toBe(true);
  });

  it('в списке футболок без параметра площадки скрыты', () => {
    // Решает сервер, а не интерфейс: правило должно работать и в браузере
    // со старой страницей в кэше.
    expect(
      where({ productCategory: 'TSHIRT' }, 'ADMIN', true).isMarketplacePrint,
    ).toBe(false);
  });

  it('«Все» нужно попросить прямо', () => {
    expect(
      where({ productCategory: 'TSHIRT', marketplace: 'all' }, 'ADMIN', true),
    ).not.toHaveProperty('isMarketplacePrint');
  });

  it('у фото и холстов прятать нечего', () => {
    expect(
      where({ productCategory: 'PHOTO' }, 'ADMIN', true),
    ).not.toHaveProperty('isMarketplacePrint');
  });

  it('в обращениях и поиске по всем продуктам тоже не фильтруем', () => {
    expect(where({}, 'ADMIN', true)).not.toHaveProperty('isMarketplacePrint');
  });

  it('отбор не мешает остальным условиям', () => {
    const result = where({ marketplace: 'exclude', productCategory: 'TSHIRT' });
    expect(result.productCategory).toBe('TSHIRT');
    expect(result.isMarketplacePrint).toBe(false);
  });
});
