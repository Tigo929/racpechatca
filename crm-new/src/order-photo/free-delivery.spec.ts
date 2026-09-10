import { FREE_DELIVERY_FROM, leadDeliveryCost } from './free-delivery';

/**
 * Доставка в заявке с сайта.
 *
 * Сумму клиент видит на сайте до отправки. Если CRM посчитает иначе, в
 * подтверждении окажется другое число — а названную и потом изменённую
 * сумму человек запоминает надолго.
 */
describe('стоимость доставки в заявке', () => {
  const price = 300;

  it('самовывоз бесплатен всегда', () => {
    expect(leadDeliveryCost({ yandexPvz: false, positionsTotal: 100, price })).toBe(0);
    expect(leadDeliveryCost({ yandexPvz: false, positionsTotal: 5000, price })).toBe(0);
  });

  it('ниже порога доставка платная', () => {
    expect(leadDeliveryCost({ yandexPvz: true, positionsTotal: 700, price })).toBe(300);
  });

  it('на пороге доставка уже бесплатна', () => {
    // Ровно 1200 — это «заказ от 1200», а не «больше 1200».
    expect(
      leadDeliveryCost({ yandexPvz: true, positionsTotal: FREE_DELIVERY_FROM, price }),
    ).toBe(0);
  });

  it('выше порога бесплатна', () => {
    expect(leadDeliveryCost({ yandexPvz: true, positionsTotal: 5000, price })).toBe(0);
  });

  it('порог считается по позициям, а не по итогу с доставкой', () => {
    /*
     * Иначе доплата проталкивала бы сама себя: 950 + 300 = 1250 ≥ 1200,
     * и доставка обнулялась бы, снова опуская сумму под порог.
     */
    expect(leadDeliveryCost({ yandexPvz: true, positionsTotal: 950, price })).toBe(300);
  });

  it('порог по умолчанию совпадает с тем, что показывает сайт', () => {
    // Числа живут в двух местах и меняются только вместе.
    expect(FREE_DELIVERY_FROM).toBe(1200);
  });
});
