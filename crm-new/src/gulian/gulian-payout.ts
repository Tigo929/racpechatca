export type PayoutResult = {
  quantity: number;
  totalPayoutKopecks: number;
  unitPayoutKopecks: number | null;
  mode: 'per_unit' | 'order_total';
};

type Item = {
  quantity: number;
  pricePosition: number;
  designCost: number;
  thermalCost: number;
  blankCost: number;
  clientItem: boolean;
};

export function calcGulianPayout(items: Item[], rateBasisPoints: number): PayoutResult {
  const quantity = items.reduce((s, i) => s + i.quantity, 0);
  if (quantity === 0) throw new Error('Нет производственных позиций');
  const totalRewardRub = items.reduce((s, i) => {
    const production = i.pricePosition - i.designCost;
    const materials = i.thermalCost * i.quantity + (i.clientItem ? 0 : i.blankCost * i.quantity);
    return s + Math.round(((production - materials) * rateBasisPoints) / 10000);
  }, 0);
  const totalPayoutKopecks = totalRewardRub * 100;
  if (quantity > 0 && totalPayoutKopecks % quantity === 0) {
    return { quantity, totalPayoutKopecks, unitPayoutKopecks: totalPayoutKopecks / quantity, mode: 'per_unit' };
  }
  return { quantity, totalPayoutKopecks, unitPayoutKopecks: null, mode: 'order_total' };
}