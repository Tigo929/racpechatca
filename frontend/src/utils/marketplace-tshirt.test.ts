import { fulfillmentError } from './fulfillment';
import {
  MARKETPLACE_TSHIRT_FLOW,
  isMarketplaceTshirt,
  marketplaceFlowStatus,
} from './marketplace-tshirt';

const marketplace = (status: string) => ({
  productCategory: 'TSHIRT',
  isMarketplacePrint: true,
  deliveryMethod: 'OZON_SELLER',
  status,
});

describe('футболка с маркетплейса', () => {
  it('опознаётся только по паре «футболка + площадка»', () => {
    expect(isMarketplaceTshirt({ productCategory: 'TSHIRT', isMarketplacePrint: true })).toBe(true);
    expect(isMarketplaceTshirt({ productCategory: 'TSHIRT', isMarketplacePrint: false })).toBe(false);
    expect(isMarketplaceTshirt({ productCategory: 'PHOTO', isMarketplacePrint: true })).toBe(false);
  });

  it('путь без оплаты и заканчивается на «Отгружен»', () => {
    expect(MARKETPLACE_TSHIRT_FLOW).toEqual(['LEAD', 'NEW', 'APPROVAL_SENT', 'SENT', 'IN_PROGRESS', 'COMPLETED']);
  });

  it.each(['PAID', 'READY', 'SHIPMENT_CREATED'])('шага %s нет', (next) => {
    expect(fulfillmentError(marketplace('IN_PROGRESS'), next)).toMatch(/маркетплейса/);
  });

  it('из «В работе» — в «Отгружен»', () => {
    expect(fulfillmentError(marketplace('IN_PROGRESS'), 'COMPLETED')).toBeNull();
  });

  it('старый заказ в «Готов» показывается как «В работе» и может быть отгружен', () => {
    expect(marketplaceFlowStatus('READY')).toBe('IN_PROGRESS');
    expect(marketplaceFlowStatus('SHIPMENT_CREATED')).toBe('IN_PROGRESS');
    expect(marketplaceFlowStatus('NEW')).toBe('NEW');
    expect(fulfillmentError(marketplace('READY'), 'COMPLETED')).toBeNull();
  });
});
