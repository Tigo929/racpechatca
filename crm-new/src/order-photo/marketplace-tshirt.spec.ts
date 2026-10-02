import { fulfillmentError } from './fulfillment';
import {
  EXCLUDE_MARKETPLACE_TSHIRT,
  MARKETPLACE_TSHIRT_FLOW,
  isMarketplaceTshirt,
} from './marketplace-tshirt';

const marketplace = (status: string) => ({
  productCategory: 'TSHIRT',
  isMarketplacePrint: true,
  deliveryMethod: 'OZON_SELLER',
  status,
});

describe('футболка с маркетплейса', () => {
  it('опознаётся только по паре «футболка + площадка»', () => {
    expect(
      isMarketplaceTshirt({
        productCategory: 'TSHIRT',
        isMarketplacePrint: true,
      }),
    ).toBe(true);
    expect(
      isMarketplaceTshirt({
        productCategory: 'TSHIRT',
        isMarketplacePrint: false,
      }),
    ).toBe(false);
    expect(isMarketplaceTshirt({ productCategory: 'TSHIRT' })).toBe(false);
    // Флаг без футболки ничего не значит: правило не расползается на фото.
    expect(
      isMarketplaceTshirt({
        productCategory: 'PHOTO',
        isMarketplacePrint: true,
      }),
    ).toBe(false);
  });

  it('путь: обратился → новый → согласование → производство → в работе → отгружен', () => {
    expect([...MARKETPLACE_TSHIRT_FLOW]).toEqual([
      'LEAD',
      'NEW',
      'APPROVAL_SENT',
      'SENT',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
  });

  it.each(['PAID', 'READY', 'SHIPMENT_CREATED'])(
    'шага %s у заказа с площадки нет',
    (next) => {
      expect(fulfillmentError(marketplace('IN_PROGRESS'), next)).toMatch(
        /маркетплейса/,
      );
    },
  );

  it('из «В работе» переходит в «Отгружен»', () => {
    expect(
      fulfillmentError(marketplace('IN_PROGRESS'), 'COMPLETED'),
    ).toBeNull();
  });

  it('старый заказ, застрявший в «Готов», тоже можно отгрузить', () => {
    expect(fulfillmentError(marketplace('READY'), 'COMPLETED')).toBeNull();
  });

  it('отмена доступна', () => {
    expect(fulfillmentError(marketplace('NEW'), 'CANCELLED')).toBeNull();
  });

  it('обычная футболка по-прежнему доходит до «Оплачен»', () => {
    expect(
      fulfillmentError(
        {
          productCategory: 'TSHIRT',
          isMarketplacePrint: false,
          deliveryMethod: 'YANDEX_PVZ',
          status: 'SHIPMENT_CREATED',
        },
        'PAID',
      ),
    ).toBeNull();
  });

  it('отчёты отсекают ровно «футболка И площадка»', () => {
    expect(EXCLUDE_MARKETPLACE_TSHIRT).toEqual({
      NOT: { productCategory: 'TSHIRT', isMarketplacePrint: true },
    });
  });
});
