import { buildMarketplaceOrderDraft, OzonArticleError } from './ozon-crm-order';
import type { OzonOrderView } from './ozon-orders.service';

/**
 * Заведение заказа из отправления Ozon: всё берётся из самого отправления,
 * выбора у человека нет. Тесты сторожат именно это — что данные не
 * додумываются и что при непонятном артикуле заказ не заводится вовсе.
 */

const posting = (over: Partial<OzonOrderView> = {}): OzonOrderView => ({
  postingNumber: '0189070451-0031-1',
  orderNumber: '48912345-0031',
  status: 'awaiting_deliver',
  statusLabel: 'Ждёт отгрузки',
  group: 'to_ship',
  createdAt: '2026-09-27T09:00:00.000Z',
  shipmentDate: '2026-09-29T09:00:00.000Z',
  shipmentOverdue: false,
  deliveringDate: null,
  trackingNumber: null,
  deliveryMethod: 'Ozon Express',
  warehouse: 'первомай',
  cancelReason: null,
  items: [
    {
      offerId: 'JDM-1-1-black-S',
      name: 'Футболка JDM',
      sku: '123',
      quantity: 1,
      price: 1290,
    },
  ],
  total: 1290,
  payout: 0,
  ...over,
});

describe('черновик заказа из отправления Ozon', () => {
  it('цвет и размер берутся из артикула, а не у человека', () => {
    const draft = buildMarketplaceOrderDraft(posting());
    expect(draft.items).toEqual([
      expect.objectContaining({
        color: 'Чёрный',
        size: 'S',
        printSlug: 'JDM-1-1',
        quantity: 1,
        price: 0,
        printLocation: 'FRONT',
        offerId: 'JDM-1-1-black-S',
      }),
    ]);
  });

  it('деньги остаются на площадке: позиция без цены', () => {
    // Цена в отправлении есть (1290 ₽), и в заказ она сознательно не идёт:
    // выручку по такому заказу считает Ozon, а не CRM.
    const draft = buildMarketplaceOrderDraft(posting());
    expect(draft.items.every((i) => i.price === 0)).toBe(true);
  });

  it('номера заказа и отправления сохраняются оба', () => {
    const draft = buildMarketplaceOrderDraft(posting());
    expect(draft.marketplaceOrderNumber).toBe('48912345-0031');
    expect(draft.marketplacePostingNumber).toBe('0189070451-0031-1');
    expect(draft.sticker).toBe('0311');
  });

  it('несколько позиций разбираются каждая по своему артикулу', () => {
    const draft = buildMarketplaceOrderDraft(
      posting({
        items: [
          {
            offerId: 'JDM-1-1-black-S',
            name: '',
            sku: null,
            quantity: 2,
            price: 1290,
          },
          {
            offerId: 'labrov-nadpis-white-XXL',
            name: '',
            sku: null,
            quantity: 1,
            price: 1490,
          },
        ],
      }),
    );
    expect(
      draft.items.map((i) => `${i.color}/${i.size}/${i.quantity}`),
    ).toEqual(['Чёрный/S/2', 'Белый/XXL/1']);
  });

  it('непонятный артикул отменяет заведение целиком', () => {
    // Половина заказа хуже отказа: вторую половину оператор не заметит.
    expect(() =>
      buildMarketplaceOrderDraft(
        posting({
          items: [
            {
              offerId: 'JDM-1-1-black-S',
              name: '',
              sku: null,
              quantity: 1,
              price: 0,
            },
            {
              offerId: 'sticker-pack',
              name: '',
              sku: null,
              quantity: 1,
              price: 0,
            },
          ],
        }),
      ),
    ).toThrow(OzonArticleError);
  });

  it('в примечании видно, из чего выведены цвет и размер', () => {
    const draft = buildMarketplaceOrderDraft(posting());
    expect(draft.note).toContain('0189070451-0031-1');
    expect(draft.note).toContain('Стикер: …0311');
    expect(draft.note).toContain('JDM-1-1-black-S → Чёрный, S');
    // Срок отгрузки живёт в кабинете и меняется там: замороженная копия
    // в примечании через день врёт.
    expect(draft.note).not.toContain('Отгрузить до');
  });

  it('без номера заказа площадки подставляется номер отправления', () => {
    // Пустой номер оставил бы заказ безымянным: показывать «—» покупателю
    // и печатнику нечем.
    const draft = buildMarketplaceOrderDraft(posting({ orderNumber: '' }));
    expect(draft.marketplaceOrderNumber).toBe('0189070451-0031-1');
  });
});
