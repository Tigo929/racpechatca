import type { ItemTshirt, OrderSettlement } from '../types/index';

/**
 * Расчёт с партнёром для ОТОБРАЖЕНИЯ в карточке заказа. Повторяет серверную
 * формулу (crm-new/src/partner/partner-settlement.ts). Авторитетная сумма
 * расхода считается на сервере при переходе в «Оплачен» — здесь только показ.
 */
export function computeSettlement(
  items: Pick<
    ItemTshirt,
    'pricePosition' | 'designCost' | 'quantity' | 'thermalCost' | 'blankCost' | 'clientItem'
  >[],
  rateBasisPoints: number,
): OrderSettlement {
  const acc = { materials: 0, margin: 0, reward: 0, partnerProfit: 0, ownerProfit: 0, tshirtRevenue: 0 };
  for (const i of items) {
    const blank = i.clientItem ? 0 : i.blankCost;
    const materials = (i.thermalCost + blank) * i.quantity;
    const printRevenue = i.pricePosition - i.designCost;
    const margin = Math.max(0, printRevenue - materials);
    const partnerProfit = Math.floor((margin * rateBasisPoints) / 10000);
    const reward = partnerProfit + materials;
    acc.materials += materials;
    acc.margin += margin;
    acc.partnerProfit += partnerProfit;
    acc.reward += reward;
    acc.ownerProfit += i.pricePosition - reward;
    acc.tshirtRevenue += i.pricePosition;
  }
  return { ...acc, rateBasisPoints };
}
