import {
  calculateUnitEconomics,
  type OzonTariffs,
  type UnitEconomicsSettings,
} from './ozon-unit-economics';

/** Тарифы, снятые с живого кабинета: pantera-1-M, цена 3500 ₽. */
const tariffs: OzonTariffs = {
  commissionPercent: 54,
  acquiring: 35,
  firstMile: 10,
  directFlow: 236,
  lastMile: 25,
  returnFlow: 236,
};

const settings: UnitEconomicsSettings = {
  blankCost: 260,
  printCost: 70,
  packagingCost: 0,
  otherCost: 0,
  returnRatePercent: 0,
  advertisingPercent: 0,
  taxPercent: 6,
  taxBase: 'income',
};

/** Реальный расклад продавца: изделие 380 ₽, самозанятый без налога. */
const realSettings: UnitEconomicsSettings = {
  blankCost: 380,
  printCost: 0,
  packagingCost: 0,
  otherCost: 0,
  returnRatePercent: 0,
  advertisingPercent: 0,
  taxPercent: 0,
  taxBase: 'income',
};

describe('юнит-экономика: реальный расклад продавца', () => {
  it('футболка за 3500 при себестоимости 380 и без налога', () => {
    const r = calculateUnitEconomics(3500, tariffs, realSettings);

    expect(r.payout).toBe(1304);
    expect(r.costOfGoods).toBe(380);
    expect(r.tax).toBe(0);
    expect(r.profit).toBe(924);
    expect(r.marginPercent).toBe(26.4);
  });

  it('при комиссии 25% вместо 54% прибыль почти вдвое выше', () => {
    const asReported = calculateUnitEconomics(3500, tariffs, realSettings);
    const asIndustry = calculateUnitEconomics(
      3500,
      { ...tariffs, commissionPercent: 25 },
      realSettings,
    );

    expect(asReported.profit).toBe(924);
    expect(asIndustry.profit).toBe(1939);
  });

  it('без налога точка безубыточности ниже', () => {
    const withTax = calculateUnitEconomics(3500, tariffs, {
      ...realSettings,
      taxPercent: 6,
    });
    const withoutTax = calculateUnitEconomics(3500, tariffs, realSettings);

    expect(withoutTax.breakEvenPrice).toBeLessThan(withTax.breakEvenPrice);
  });
});

describe('юнит-экономика Ozon', () => {
  it('удержания площадки складываются в выплату', () => {
    const r = calculateUnitEconomics(3500, tariffs, settings);

    // 54% от 3500 = 1890; плюс 35 + 10 + 236 + 25 = 306
    expect(r.marketplaceTotal).toBe(-2196);
    expect(r.payout).toBe(1304);
  });

  it('из выплаты вычитается себестоимость и налог', () => {
    const r = calculateUnitEconomics(3500, tariffs, settings);

    expect(r.costOfGoods).toBe(330);
    expect(r.profitBeforeTax).toBe(974); // 1304 - 330
    expect(r.tax).toBe(210); // УСН «доходы»: 6% от 3500, а не от прибыли
    expect(r.profit).toBe(764);
  });

  it('налог «доходы» берётся с цены, а не с прибыли — частая ошибка в расчётах', () => {
    const fromIncome = calculateUnitEconomics(3500, tariffs, settings);
    const fromProfit = calculateUnitEconomics(3500, tariffs, {
      ...settings,
      taxBase: 'profit',
    });

    expect(fromIncome.tax).toBe(210);
    expect(fromProfit.tax).toBe(58.44); // 6% от 974
    expect(fromProfit.profit).toBeGreaterThan(fromIncome.profit);
  });

  it('возвраты размазываются по всем продажам долей возвратов', () => {
    const r = calculateUnitEconomics(3500, tariffs, {
      ...settings,
      returnRatePercent: 5,
    });
    const returns = r.sellerLines.find((l) => l.key === 'returns');

    expect(returns?.amount).toBe(-11.8); // 236 × 5%
  });

  it('реклама считается процентом от цены', () => {
    const r = calculateUnitEconomics(3500, tariffs, {
      ...settings,
      advertisingPercent: 10,
    });
    const ads = r.sellerLines.find((l) => l.key === 'ads');

    expect(ads?.amount).toBe(-350);
    expect(r.profit).toBe(414); // на 350 меньше базового 764
  });

  it('нулевые расходы не засоряют разбор пустыми строками', () => {
    const r = calculateUnitEconomics(3500, tariffs, settings);
    const keys = r.sellerLines.map((l) => l.key);

    expect(keys).toEqual(['blank', 'print']);
  });

  it('рентабельность считается к цене, наценка — к себестоимости', () => {
    const r = calculateUnitEconomics(3500, tariffs, settings);

    expect(r.marginPercent).toBe(21.83); // 764 / 3500
    expect(r.markupPercent).toBe(231.52); // 764 / 330
  });

  it('в точке безубыточности прибыль обнуляется', () => {
    const r = calculateUnitEconomics(3500, tariffs, settings);
    const atBreakEven = calculateUnitEconomics(
      r.breakEvenPrice,
      tariffs,
      settings,
    );

    expect(Math.abs(atBreakEven.profit)).toBeLessThan(0.5);
  });

  it('при убыточной цене прибыль отрицательная, а не обрезана нулём', () => {
    const r = calculateUnitEconomics(800, tariffs, settings);
    expect(r.profit).toBeLessThan(0);
  });

  it('на «доходы минус расходы» налога с убытка нет', () => {
    const r = calculateUnitEconomics(800, tariffs, {
      ...settings,
      taxBase: 'profit',
    });
    expect(r.tax).toBe(0);
  });
});
