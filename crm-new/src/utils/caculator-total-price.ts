interface PriceItem {
  price: number;
  quantity: number;
  designCost?: number;
}

const calculatorTotalPrice = (
  items: PriceItem[],
  deliveryCost: number,
): number => {
  const totalItems = items.reduce(
    (acc, v) => acc + v.price * v.quantity + (v.designCost ?? 0),
    0,
  );
  return totalItems + deliveryCost;
};

export default calculatorTotalPrice;
