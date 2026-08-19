import type { ItemTshirt, OrderSettlement } from '../types/index';

/**
 * Расчёт с партнёром для ОТОБРАЖЕНИЯ в карточке заказа. Повторяет серверную
 * формулу (crm-new/src/partner/partner-settlement.ts). Авторитетная сумма
 * расхода считается на сервере при переходе в «Оплачен» — здесь только показ.
 */

/** Поля позиции, от которых зависят деньги. Остальное расчёту не нужно. */
export type SettlementInput = Pick<
  ItemTshirt,
  'pricePosition' | 'designCost' | 'quantity' | 'thermalCost' | 'blankCost' | 'clientItem'
>;

export interface PositionSettlement {
  /** Себестоимость материалов — её партнёру возвращаем целиком. */
  materials: number;
  /** Стоимость заготовок в материалах. 0, если футболка клиента. */
  blanks: number;
  /** Термоперенос: платим всегда, это и есть работа печати. */
  thermal: number;
  /** Выручка печати: цена позиции без дизайна. */
  printRevenue: number;
  /** Делимая маржа — после дизайна и материалов. */
  margin: number;
  /** Чистый заработок партнёра: маржа × ставка. */
  partnerProfit: number;
  /** Что уходит партнёру всего: заработок + возврат материалов. */
  reward: number;
  /** Что остаётся владельцу по этой позиции. */
  ownerProfit: number;
}

/**
 * Расчёт по одной позиции.
 *
 * Вынесен отдельно, чтобы карточка позиции показывала те же цифры, что и
 * итог по заказу: раньше формула жила одним циклом внутри общего расчёта, и
 * показать разбор по строке было нечем — прибыль была видна только суммой.
 *
 * Для «только нанесения» (clientItem) заготовку покупает клиент, поэтому она
 * не в материалах и партнёру не возвращается: делится ровно работа печати.
 */
export function computePositionSettlement(
  i: SettlementInput,
  rateBasisPoints: number,
): PositionSettlement {
  const blanks = i.clientItem ? 0 : i.blankCost * i.quantity;
  const thermal = i.thermalCost * i.quantity;
  const materials = thermal + blanks;
  const printRevenue = i.pricePosition - i.designCost;
  // Маржа не уходит в минус: если печать в убыток, партнёр получает возврат
  // материалов, а не «минусовой» процент.
  const margin = Math.max(0, printRevenue - materials);
  const partnerProfit = Math.floor((margin * rateBasisPoints) / 10000);
  const reward = partnerProfit + materials;
  return {
    materials,
    blanks,
    thermal,
    printRevenue,
    margin,
    partnerProfit,
    reward,
    ownerProfit: i.pricePosition - reward,
  };
}

export function computeSettlement(
  items: SettlementInput[],
  rateBasisPoints: number,
): OrderSettlement {
  const acc = { materials: 0, margin: 0, reward: 0, partnerProfit: 0, ownerProfit: 0, tshirtRevenue: 0 };
  for (const i of items) {
    const r = computePositionSettlement(i, rateBasisPoints);
    acc.materials += r.materials;
    acc.margin += r.margin;
    acc.partnerProfit += r.partnerProfit;
    acc.reward += r.reward;
    acc.ownerProfit += r.ownerProfit;
    acc.tshirtRevenue += i.pricePosition;
  }
  return { ...acc, rateBasisPoints };
}
