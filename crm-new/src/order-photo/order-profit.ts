/**
 * Сколько владелец зарабатывает на конкретном заказе.
 *
 * До сих пор это было видно только по холстам — там цена подрядчика лежит
 * в самой позиции. По фото и футболкам в карточке был один оборот, и заказ
 * с нулевым заработком выглядел так же, как выгодный. Пример из базы: холст
 * за 1 500 ₽ при подрядчике 1 464 ₽ принёс 36 ₽ — это должно быть видно до
 * того, как цена названа клиенту, а не через месяц в отчёте.
 *
 * Считаем одинаково для всех категорий, отличается только себестоимость:
 *  - фото     — бумага (см. photo-material.ts);
 *  - футболки — вознаграждение партнёру (материалы + его доля, см. partner-settlement);
 *  - холсты   — фиксированная цена подрядчика из позиции.
 *
 * Доставка вынесена отдельной строкой и НЕ считается транзитом: клиенту
 * называют 300 ₽, перевозчику платят 99 ₽, разница — тоже заработок.
 * Прежний отчёт вычитал доставку целиком и терял эти деньги.
 */

export interface OrderProfitInput {
  /** Полная сумма заказа: позиции + доставка + дизайн + срочность. */
  totalOrder: number;
  /** Сколько взяли с клиента за доставку (входит в totalOrder). */
  deliveryCharged: number;
  /** Сколько реально заплатили перевозчику. */
  deliveryPaid: number;
  /** Себестоимость бумаги в копейках — только у фотозаказов. */
  photoMaterialKopecks?: number;
  /** Подрядчик: партнёр по футболкам или печатник холстов. */
  contractorCost?: number;
  /** Зарплата по заказу: начисленная, а до начисления — прогноз по ставке. */
  salaryCost?: number;
}

export interface OrderProfit {
  /** Выручка за товар — без доставки: на ней зарабатывают отдельно. */
  goodsRevenue: number;
  materialCost: number;
  contractorCost: number;
  salaryCost: number;
  deliveryCharged: number;
  deliveryPaid: number;
  /** Заработок на доставке: сколько взяли минус сколько отдали. */
  deliveryProfit: number;
  /** Чистыми в карман по этому заказу. */
  profit: number;
  /** Доля заработка в сумме заказа, в десятых процента (155 = 15,5%). */
  marginPermille: number;
}

/** Копейки в рубли, вверх: недосчитать расход хуже, чем округлить его. */
function kopecksToRub(kopecks: number): number {
  return Math.ceil(kopecks / 100);
}

export function calcOrderProfit(input: OrderProfitInput): OrderProfit {
  const deliveryCharged = Math.max(0, input.deliveryCharged);
  // Перевозчику платим, только если доставка вообще была: у самовывоза
  // клиент ничего не платит, и списывать себестоимость не с чего.
  const deliveryPaid = deliveryCharged > 0 ? Math.max(0, input.deliveryPaid) : 0;

  const goodsRevenue = input.totalOrder - deliveryCharged;
  const materialCost = kopecksToRub(Math.max(0, input.photoMaterialKopecks ?? 0));
  const contractorCost = Math.max(0, input.contractorCost ?? 0);
  const salaryCost = Math.max(0, input.salaryCost ?? 0);
  const deliveryProfit = deliveryCharged - deliveryPaid;

  const profit =
    goodsRevenue - materialCost - contractorCost - salaryCost + deliveryProfit;

  // Долю считаем от полной суммы заказа: именно её видит владелец в списке,
  // и «заработал 36 ₽ из 1 500 ₽» — то сравнение, ради которого всё затевалось.
  const marginPermille =
    input.totalOrder > 0 ? Math.round((profit / input.totalOrder) * 1000) : 0;

  return {
    goodsRevenue,
    materialCost,
    contractorCost,
    salaryCost,
    deliveryCharged,
    deliveryPaid,
    deliveryProfit,
    profit,
    marginPermille,
  };
}

/**
 * Прогноз зарплаты, пока начисления нет.
 *
 * Начисление появляется только при переходе в «Отправлен», а заработок надо
 * видеть в момент оформления — иначе смысл теряется. База та же, что в
 * salary-calculation: чек без доставки, дизайна и срочности.
 */
export function forecastSalary(
  totalOrder: number,
  deliveryCharged: number,
  designDevelopmentCost: number,
  urgencyFee: number,
  rateBasisPoints: number,
): number {
  const base = Math.max(
    0,
    totalOrder - deliveryCharged - designDevelopmentCost - urgencyFee,
  );
  return Math.floor((base * Math.max(0, rateBasisPoints)) / 10000);
}
