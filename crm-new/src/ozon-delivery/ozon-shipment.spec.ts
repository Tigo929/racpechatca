import {
  mapOzonStatus,
  rubles,
  scheduleText,
  shipmentBlocker,
  defaultParcel,
} from './ozon-shipment';
import {
  deepFind,
  findPosting,
  labelFromJson,
  postingStatus,
} from './ozon-json';
import { humanOzonError } from './ozon-delivery.client';
import { ozonShipmentCost } from 'src/reports/reports.service';

const ok = {
  productCategory: 'PHOTO',
  deliveryMethod: 'OZON_PVZ',
  status: 'READY',
  totalOrder: 1300,
  prepaidAmount: 1300,
  clientPaidAt: null,
  pickupPointId: '5627',
  recipientPhone: '+79161234567',
  recipientName: 'Анна',
};

describe('можно ли создать отправление Ozon', () => {
  it('оплаченный заказ с пунктом и получателем — можно', () => {
    expect(shipmentBlocker(ok)).toBeNull();
  });

  it('недоплата — нельзя, и сказано, сколько осталось', () => {
    expect(shipmentBlocker({ ...ok, prepaidAmount: 650 })).toMatch(
      /остаток 650 ₽/,
    );
    expect(shipmentBlocker({ ...ok, prepaidAmount: null })).toMatch(
      /не оплачен/,
    );
  });

  it('статус «Оплачен» или дата оплаты — считается оплаченным', () => {
    expect(
      shipmentBlocker({ ...ok, prepaidAmount: 0, status: 'PAID' }),
    ).toBeNull();
    expect(
      shipmentBlocker({ ...ok, prepaidAmount: 0, clientPaidAt: new Date() }),
    ).toBeNull();
  });

  it('без пункта, телефона, имени или не Ozon — нельзя', () => {
    expect(shipmentBlocker({ ...ok, pickupPointId: null })).toMatch(/пункт/);
    expect(shipmentBlocker({ ...ok, recipientPhone: '123' })).toMatch(
      /телефон/i,
    );
    expect(shipmentBlocker({ ...ok, recipientName: ' ' })).toMatch(/имени/);
    expect(shipmentBlocker({ ...ok, deliveryMethod: 'YANDEX_PVZ' })).toMatch(
      /Ozon ПВЗ/,
    );
    expect(shipmentBlocker({ ...ok, status: 'LEAD' })).toMatch(/заявка/);
  });

  it('у футболки свой размер посылки', () => {
    expect(defaultParcel('TSHIRT')).not.toEqual(defaultParcel('PHOTO'));
    expect(defaultParcel('UNKNOWN')).toEqual(defaultParcel('PHOTO'));
  });
});

describe('ответы Ozon', () => {
  it('деньги — вверх до рубля', () => {
    expect(rubles({ amount: '99.00', currency_code: 'RUB' })).toBe(99);
    expect(rubles('10.01')).toBe(11);
    expect(rubles(null)).toBeNull();
  });

  it('статусы по смыслу', () => {
    expect(mapOzonStatus('delivered')).toBe('DELIVERED');
    // «Доставлено в пункт» — посылка в пункте, а не у клиента: отзыв рано.
    expect(mapOzonStatus('delivered_to_pickup_point')).toBe('AT_PICKUP_POINT');
    expect(mapOzonStatus('delivered_to_pvz')).toBe('AT_PICKUP_POINT');
    expect(mapOzonStatus('delivered_to_customer')).toBe('DELIVERED');
    expect(mapOzonStatus('handed_to_recipient')).toBe('DELIVERED');
    expect(mapOzonStatus('received_at_sorting_center')).toBe('IN_TRANSIT');
    expect(mapOzonStatus('delivering')).toBe('IN_TRANSIT');
    expect(mapOzonStatus('arrived_at_pickup_point')).toBe('AT_PICKUP_POINT');
    expect(mapOzonStatus('in_transit')).toBe('IN_TRANSIT');
    expect(mapOzonStatus('cancelled')).toBe('CANCELLED');
    expect(mapOzonStatus('returning_to_seller')).toBe('RETURNING');
    expect(mapOzonStatus('returned_to_seller')).toBe('RETURNED');
    expect(mapOzonStatus('ready_for_shipping')).toBe('APPROVED');
    expect(mapOzonStatus('что-то новое')).toBeNull();
  });

  it('номер и статус отправления ищутся в глубине ответа', () => {
    const res = {
      order: {
        order_number: 'A-1',
        postings: [{ posting_number: 'P-7', status: 'created' }],
      },
    };
    expect(deepFind(res, /^posting_number$/)).toBe('P-7');
    expect(
      postingStatus(
        findPosting(
          {
            postings: [
              { posting_number: 'X' },
              { posting_number: 'P-7', status: 'delivered' },
            ],
          },
          'P-7',
        ),
      ),
    ).toBe('delivered');
  });

  it('этикетка base64 в JSON распознаётся только если это PDF', () => {
    const pdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(200, 32),
    ]).toString('base64');
    expect(
      labelFromJson({ file_content: pdf })?.subarray(0, 4).toString(),
    ).toBe('%PDF');
    expect(
      labelFromJson({ file_content: Buffer.alloc(200, 65).toString('base64') }),
    ).toBeNull();
  });

  it('расписание пункта одной строкой', () => {
    const day = (d: string) => ({
      date: d,
      periods: [{ from_local: '09:00:00', to_local: '20:00:00' }],
    });
    expect(scheduleText([day('1'), day('2')])).toBe('ежедневно 09:00–20:00');
  });

  it('нехватка баланса — понятными словами', () => {
    expect(humanOzonError('NotEnoughBalance', 'x')).toMatch(/Пополните баланс/);
  });
});

describe('стоимость доставки в отчётах', () => {
  it('факт важнее оценки, отменённое — ноль', () => {
    expect(
      ozonShipmentCost({
        actualCost: 130,
        estimatedCost: 99,
        estimatedInsurance: 10,
      }),
    ).toBe(130);
    expect(
      ozonShipmentCost({
        actualCost: null,
        estimatedCost: 99,
        estimatedInsurance: 10,
      }),
    ).toBe(109);
    expect(
      ozonShipmentCost({
        actualCost: null,
        estimatedCost: 99,
        estimatedInsurance: 10,
        status: 'CANCELLED',
      }),
    ).toBeNull();
    expect(ozonShipmentCost(null)).toBeNull();
  });
});
