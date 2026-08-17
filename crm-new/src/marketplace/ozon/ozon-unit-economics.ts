/**
 * Юнит-экономика товара на Ozon: сколько остаётся продавцу с одной продажи.
 *
 * Считается чистой функцией без похода в сеть и базу — это денежная
 * арифметика, её должно быть можно проверить тестом построчно.
 *
 * Порядок удержаний повторяет то, как считает сам Ozon и как расписывают
 * юнит-экономику в отрасли: сначала площадка забирает своё из цены продажи
 * (комиссия, эквайринг, логистика), остаток приходит продавцу выплатой; из
 * выплаты продавец платит за товар, возвраты, рекламу и налог.
 *
 * Все составляющие вынесены наружу отдельными полями намеренно: владелец
 * хочет видеть каждую копейку и сверять с отчётом Ozon, а не доверять
 * одной итоговой цифре.
 */

/** Тарифы площадки по конкретному товару — приходят из Ozon. */
export interface OzonTariffs {
  /** Комиссия за продажу, % от цены. */
  commissionPercent: number;
  /** Эквайринг, ₽ за заказ. */
  acquiring: number;
  /** Первая миля (передача товара в доставку), ₽. */
  firstMile: number;
  /** Прямая логистика — до покупателя, ₽. */
  directFlow: number;
  /** Последняя миля, ₽. */
  lastMile: number;
  /** Обратная логистика — возврат товара продавцу, ₽ за возврат. */
  returnFlow: number;
}

/** Что задаёт продавец: себестоимость и его собственные расходы. */
export interface UnitEconomicsSettings {
  /** Заготовка — сама футболка, ₽. */
  blankCost: number;
  /** Нанесение принта, ₽. */
  printCost: number;
  /** Упаковка, ₽. */
  packagingCost: number;
  /** Прочие расходы на единицу, ₽. */
  otherCost: number;
  /** Доля возвратов, % от заказов. Возврат стоит обратной логистики. */
  returnRatePercent: number;
  /** Реклама, % от цены продажи. */
  advertisingPercent: number;
  /** Ставка налога, %. */
  taxPercent: number;
  /**
   * База налога: «доходы» (УСН 6% с выручки) или «доходы минус расходы»
   * (налог с прибыли). От выбора сильно зависит итог, поэтому это настройка,
   * а не константа.
   */
  taxBase: 'income' | 'profit';
}

export interface UnitEconomicsLine {
  key: string;
  label: string;
  /** Отрицательное — удержание, положительное — доход. */
  amount: number;
  /** Пояснение, откуда цифра. */
  hint?: string;
}

export interface UnitEconomicsResult {
  price: number;
  /** Удержания площадки построчно. */
  marketplaceLines: UnitEconomicsLine[];
  /** Сумма удержаний площадки. */
  marketplaceTotal: number;
  /** Сколько Ozon перечислит продавцу. */
  payout: number;
  /** Расходы продавца построчно. */
  sellerLines: UnitEconomicsLine[];
  sellerTotal: number;
  /** Себестоимость товара (без возвратов, рекламы и налога). */
  costOfGoods: number;
  /** Прибыль до налога. */
  profitBeforeTax: number;
  tax: number;
  /** Чистая прибыль с одной продажи. */
  profit: number;
  /** Рентабельность к цене продажи, %. */
  marginPercent: number;
  /** Наценка к себестоимости, %. */
  markupPercent: number;
  /** Цена, при которой прибыль обнуляется. */
  breakEvenPrice: number;
}

const round = (v: number) => Math.round(v * 100) / 100;

export function calculateUnitEconomics(
  price: number,
  tariffs: OzonTariffs,
  settings: UnitEconomicsSettings,
): UnitEconomicsResult {
  const commission = (price * tariffs.commissionPercent) / 100;

  const marketplaceLines: UnitEconomicsLine[] = [
    {
      key: 'commission',
      label: 'Комиссия за продажу',
      amount: -commission,
      hint: `${tariffs.commissionPercent}% от цены`,
    },
    { key: 'acquiring', label: 'Эквайринг', amount: -tariffs.acquiring },
    { key: 'first_mile', label: 'Первая миля', amount: -tariffs.firstMile },
    {
      key: 'direct_flow',
      label: 'Прямая логистика',
      amount: -tariffs.directFlow,
      hint: 'доставка товара покупателю',
    },
    { key: 'last_mile', label: 'Последняя миля', amount: -tariffs.lastMile },
  ];
  const marketplaceTotal = marketplaceLines.reduce((s, l) => s + l.amount, 0);
  const payout = price + marketplaceTotal;

  const costOfGoods =
    settings.blankCost +
    settings.printCost +
    settings.packagingCost +
    settings.otherCost;

  // Возврат случается не с каждой продажей, поэтому обратная логистика
  // размазывается по всем заказам долей возвратов: при 5% возвратов каждая
  // продажа «несёт» 5% стоимости обратной доставки.
  const returnCost = (tariffs.returnFlow * settings.returnRatePercent) / 100;
  const advertising = (price * settings.advertisingPercent) / 100;

  const sellerLines: UnitEconomicsLine[] = [
    {
      key: 'blank',
      label: 'Заготовка (футболка)',
      amount: -settings.blankCost,
    },
    { key: 'print', label: 'Нанесение принта', amount: -settings.printCost },
  ];
  if (settings.packagingCost) {
    sellerLines.push({
      key: 'packaging',
      label: 'Упаковка',
      amount: -settings.packagingCost,
    });
  }
  if (settings.otherCost) {
    sellerLines.push({
      key: 'other',
      label: 'Прочие расходы',
      amount: -settings.otherCost,
    });
  }
  if (returnCost) {
    sellerLines.push({
      key: 'returns',
      label: 'Возвраты',
      amount: -returnCost,
      hint: `обратная логистика ${tariffs.returnFlow} ₽ × ${settings.returnRatePercent}% возвратов`,
    });
  }
  if (advertising) {
    sellerLines.push({
      key: 'ads',
      label: 'Реклама',
      amount: -advertising,
      hint: `${settings.advertisingPercent}% от цены`,
    });
  }

  const sellerTotal = sellerLines.reduce((s, l) => s + l.amount, 0);
  const profitBeforeTax = payout + sellerTotal;

  // При УСН «доходы» налог платится с полной цены продажи, а не с того, что
  // осталось. Это частая ошибка в самодельных расчётах: продавец считает 6%
  // от прибыли и недосчитывается денег.
  const taxBaseAmount =
    settings.taxBase === 'income' ? price : Math.max(0, profitBeforeTax);
  const tax = (taxBaseAmount * settings.taxPercent) / 100;
  const profit = profitBeforeTax - tax;

  // Цена безубыточности: при ней прибыль равна нулю. Все удержания, кроме
  // комиссии, рекламы и налога, от цены не зависят — поэтому решается
  // линейно относительно цены.
  const variableShare =
    tariffs.commissionPercent / 100 +
    settings.advertisingPercent / 100 +
    (settings.taxBase === 'income' ? settings.taxPercent / 100 : 0);
  const fixedCosts =
    tariffs.acquiring +
    tariffs.firstMile +
    tariffs.directFlow +
    tariffs.lastMile +
    costOfGoods +
    returnCost;
  const breakEvenPrice =
    variableShare < 1 ? fixedCosts / (1 - variableShare) : Infinity;

  return {
    price: round(price),
    marketplaceLines: marketplaceLines.map((l) => ({
      ...l,
      amount: round(l.amount),
    })),
    marketplaceTotal: round(marketplaceTotal),
    payout: round(payout),
    sellerLines: sellerLines.map((l) => ({ ...l, amount: round(l.amount) })),
    sellerTotal: round(sellerTotal),
    costOfGoods: round(costOfGoods),
    profitBeforeTax: round(profitBeforeTax),
    tax: round(tax),
    profit: round(profit),
    marginPercent: price > 0 ? round((profit / price) * 100) : 0,
    markupPercent: costOfGoods > 0 ? round((profit / costOfGoods) * 100) : 0,
    breakEvenPrice: Number.isFinite(breakEvenPrice) ? round(breakEvenPrice) : 0,
  };
}
