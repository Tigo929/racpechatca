import {
  LeadMoneyError,
  resolveLeadItemsMoney,
  resolveLeadMoney,
} from './lead-pricing';

describe('resolveLeadMoney', () => {
  it('считает итог сам и принимает сходящийся расчёт сайта', () => {
    expect(resolveLeadMoney({ quantity: 20, unitPrice: 15, total: 300 })).toEqual(
      { quantity: 20, unitPrice: 15, pricePosition: 300 },
    );
  });

  it('итог считается на нашей стороне, даже если сайт его не прислал', () => {
    expect(resolveLeadMoney({ quantity: 10, unitPrice: 12 })).toEqual({
      quantity: 10,
      unitPrice: 12,
      pricePosition: 120,
    });
  });

  it('отклоняет заявку, если присланный итог не сходится', () => {
    // Ровно тот случай, ради которого проверка и нужна: 200 фото по 15 ₽
    // «за 1 рубль» дальше утянули бы за собой зарплату и расчёт с партнёром.
    expect(() =>
      resolveLeadMoney({ quantity: 200, unitPrice: 15, total: 1 }),
    ).toThrow(LeadMoneyError);
  });

  it('заявка без расчёта — просто контакты, это допустимо', () => {
    expect(resolveLeadMoney({})).toEqual({
      quantity: 0,
      unitPrice: 0,
      pricePosition: 0,
    });
  });

  it('бесплатная позиция допустима, если тираж указан', () => {
    expect(resolveLeadMoney({ quantity: 5, unitPrice: 0, total: 0 })).toEqual({
      quantity: 5,
      unitPrice: 0,
      pricePosition: 0,
    });
  });

  it('дробный или отрицательный тираж не проходит', () => {
    expect(() => resolveLeadMoney({ quantity: 1.5, unitPrice: 10 })).toThrow(
      LeadMoneyError,
    );
    expect(() => resolveLeadMoney({ quantity: -3, unitPrice: 10 })).toThrow(
      LeadMoneyError,
    );
  });

  it('запредельная сумма не проходит', () => {
    expect(() =>
      resolveLeadMoney({ quantity: 100000, unitPrice: 1000000 }),
    ).toThrow(LeadMoneyError);
  });
});

/**
 * Заказ из нескольких строк: часть фотографий с полями, часть без.
 *
 * Проверка та же, что и для одиночной позиции, и по той же причине: по
 * этим суммам дальше считается зарплата и расчёт с партнёром.
 */
describe('resolveLeadItemsMoney', () => {
  it('складывает строки и считает итог сам', () => {
    expect(
      resolveLeadItemsMoney([
        { quantity: 20, unitPrice: 7, total: 140 },
        { quantity: 10, unitPrice: 10, total: 100 },
      ]),
    ).toEqual({ quantity: 30, unitPrice: 0, pricePosition: 240 });
  });

  it('кривая строка отбивает всю заявку', () => {
    // «10 штук по 10 рублей за 1 рубль» — ровно то, ради чего проверка есть.
    expect(() =>
      resolveLeadItemsMoney([
        { quantity: 20, unitPrice: 7, total: 140 },
        { quantity: 10, unitPrice: 10, total: 1 },
      ]),
    ).toThrow(LeadMoneyError);
  });

  it('пустая строка не проходит', () => {
    expect(() =>
      resolveLeadItemsMoney([{ quantity: 0, unitPrice: 0, total: 0 }]),
    ).toThrow(LeadMoneyError);
  });

  it('средней цены за штуку не придумывает', () => {
    // Средняя по смешанному заказу однажды уехала бы в зарплату.
    expect(
      resolveLeadItemsMoney([{ quantity: 2, unitPrice: 7, total: 14 }]).unitPrice,
    ).toBe(0);
  });
});
