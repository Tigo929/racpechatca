import { fulfillmentError } from './fulfillment';

describe('delivery and production workflow', () => {
  it.each(['PHOTO', 'CANVAS', 'TSHIRT'])(
    '%s pickup never creates shipment',
    (productCategory) => {
      expect(
        fulfillmentError(
          { productCategory, deliveryMethod: 'PICKUP', status: 'READY' },
          'SHIPMENT_CREATED',
        ),
      ).not.toBeNull();
    },
  );
  it.each(['PHOTO', 'CANVAS', 'TSHIRT'])(
    '%s cannot close an unready pickup',
    (productCategory) => {
      expect(
        fulfillmentError(
          { productCategory, deliveryMethod: 'PICKUP', status: 'NEW' },
          'PAID',
        ),
      ).not.toBeNull();
    },
  );
  it.each(['CANVAS', 'TSHIRT'])(
    '%s ready pickup closes without shipping',
    (productCategory) => {
      expect(
        fulfillmentError(
          { productCategory, deliveryMethod: 'PICKUP', status: 'READY' },
          'PAID',
        ),
      ).toBeNull();
      expect(
        fulfillmentError(
          { productCategory, deliveryMethod: 'PICKUP', status: 'SENT' },
          'PAID',
        ),
      ).not.toBeNull();
    },
  );
  it('photo pickup is handed over before payment, preserving salary accrual', () => {
    const order = {
      productCategory: 'PHOTO',
      deliveryMethod: 'PICKUP',
      status: 'READY',
    };
    expect(fulfillmentError(order, 'SENT')).toBeNull();
    expect(fulfillmentError(order, 'PAID')).not.toBeNull();
    expect(fulfillmentError({ ...order, status: 'SENT' }, 'PAID')).toBeNull();
  });
  it('production courier uses a client shipment after canvas production', () => {
    const order = {
      productCategory: 'CANVAS',
      deliveryMethod: 'PRODUCTION_MSK',
      status: 'READY',
    };
    expect(fulfillmentError(order, 'SHIPMENT_CREATED')).toBeNull();
    expect(fulfillmentError(order, 'PAID')).not.toBeNull();
    expect(
      fulfillmentError({ ...order, status: 'SHIPMENT_CREATED' }, 'PAID'),
    ).toBeNull();
  });
  it('does not reopen financial closure or reject an idempotent status', () => {
    const order = {
      productCategory: 'PHOTO',
      deliveryMethod: 'PICKUP',
      status: 'PAID',
    };
    expect(fulfillmentError(order, 'READY')).not.toBeNull();
    expect(fulfillmentError(order, 'PAID')).toBeNull();
  });
});
