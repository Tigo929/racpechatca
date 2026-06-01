interface PriceItem {
  price: number;
  quantity: number;
}

const calculatorTotalPrice = (
  items: PriceItem[],
  deliveryCost: number,
): number => {
  const totalItems = items.reduce((acc, v) => acc + v.price * v.quantity, 0);
  return totalItems + deliveryCost;
};

export default calculatorTotalPrice;
