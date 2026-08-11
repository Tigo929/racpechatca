import { LeadMoneyError, resolveLeadMoney } from './lead-pricing';

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
