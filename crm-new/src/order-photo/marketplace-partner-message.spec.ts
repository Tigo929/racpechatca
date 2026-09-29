import { buildMarketplacePartnerMessage } from './marketplace-partner-message';

/**
 * Задание исполнителю по заказу с площадки. Тесты сторожат две вещи:
 * в сообщении нет денег (их считает площадка, и выдуманная сумма стала бы
 * для исполнителя обещанием) и есть то, по чему футболка находит коробку.
 */
describe('задание исполнителю по заказу с маркетплейса', () => {
  const order = {
    numberOrder: '20260929-3',
    marketplaceOrderNumber: '48912345-0031',
    marketplacePostingNumber: '0189070451-0031-1',
    tshirtItems: [
      {
        color: 'Чёрный',
        size: 'S',
        quantity: 2,
        printLocation: 'FRONT',
        printType: 'DTF',
        marketplaceArticle: 'JDM-1-1-black-S',
      },
    ],
  };

  it('несёт номер площадки, стикер и артикул', () => {
    const text = buildMarketplacePartnerMessage(order);
    expect(text).toContain('48912345-0031');
    expect(text).toContain('…0311');
    expect(text).toContain('JDM-1-1-black-S');
    expect(text).toContain('Чёрный / S');
    expect(text).toContain('×2');
  });

  it('внутренний номер заказа тоже на месте — по нему ищут в CRM', () => {
    expect(buildMarketplacePartnerMessage(order)).toContain('20260929-3');
  });

  it('в сообщении нет ни одной суммы', () => {
    // Доля исполнителя идёт по договорённости; число здесь он прочитает
    // как обещание и будет ждать именно столько.
    const text = buildMarketplacePartnerMessage(order);
    expect(text).not.toContain('₽');
    expect(text).not.toMatch(/выплат|доля|расчёт для/i);
    expect(text).toContain('считает площадка');
  });

  it('без номеров площадки сообщение всё равно собирается', () => {
    const text = buildMarketplacePartnerMessage({
      numberOrder: '20260929-4',
      tshirtItems: order.tshirtItems,
    });
    expect(text).toContain('20260929-4');
    expect(text).not.toContain('Стикер');
  });

  it('разметка не ломается от угловых скобок в данных', () => {
    const text = buildMarketplacePartnerMessage({
      ...order,
      tshirtItems: [{ ...order.tshirtItems[0], color: '<b>красный' }],
    });
    expect(text).toContain('&lt;b&gt;красный');
  });
});
