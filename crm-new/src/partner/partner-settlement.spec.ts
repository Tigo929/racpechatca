import {
  positionMaterials,
  settleOrder,
  settlePosition,
  type SettlementPosition,
} from './partner-settlement';

// Базовая позиция из согласованного примера:
// цена печати 850 (pricePosition 1000 − дизайн 150), термо 70, футболка 260.
const base: SettlementPosition = {
  pricePosition: 1000,
  designCost: 150,
  quantity: 1,
  thermalCost: 70,
  blankCost: 260,
  clientItem: false,
};

describe('расчёт по позиции (пример из согласования)', () => {
  const r = settlePosition(base, 3000); // 30%

  it('материалы = термо + футболка на штуку', () => {
    expect(r.materials).toBe(330);
  });

  it('делимая маржа = цена − дизайн − материалы', () => {
    // 1000 − 150 − 330 = 520
    expect(r.margin).toBe(520);
  });

  it('вознаграждение = маржа×30% + материалы', () => {
    // 520×0.3=156, +330 = 486
    expect(r.reward).toBe(486);
  });

  it('чистый заработок партнёра = маржа×30%', () => {
    expect(r.partnerProfit).toBe(156);
  });

  it('прибыль владельца = сумма позиции − вознаграждение', () => {
    // 1000 − 486 = 514  (= дизайн 150 + 70% маржи 364)
    expect(r.ownerProfit).toBe(514);
  });

  it('деньги сходятся: прибыль + вознаграждение = сумма позиции', () => {
    expect(r.ownerProfit + r.reward).toBe(base.pricePosition);
  });
});

describe('давальческая футболка (клиент со своей)', () => {
  const own: SettlementPosition = { ...base, clientItem: true };

  it('стоимость футболки не входит в материалы, термо остаётся', () => {
    expect(positionMaterials(own)).toBe(70);
  });

  it('партнёру не возвращаем 260 за то, чего он не покупал', () => {
    const r = settlePosition(own, 3000);
    // маржа = 850 − 70 = 780; вознаграждение = 234 + 70 = 304
    expect(r.margin).toBe(780);
    expect(r.reward).toBe(304);
    expect(r.ownerProfit + r.reward).toBe(1000);
  });
});

describe('количество больше одного', () => {
  const three: SettlementPosition = {
    pricePosition: 3000, // 3 шт × 1000, дизайн 0
    designCost: 0,
    quantity: 3,
    thermalCost: 70,
    blankCost: 260,
    clientItem: false,
  };

  it('материалы считаются на каждую штуку', () => {
    // (70+260)×3 = 990
    expect(positionMaterials(three)).toBe(990);
  });

  it('расчёт на весь объём позиции', () => {
    const r = settlePosition(three, 3000);
    // маржа = 3000 − 990 = 2010; заработок = 603; вознаграждение = 1593
    expect(r.margin).toBe(2010);
    expect(r.partnerProfit).toBe(603);
    expect(r.reward).toBe(1593);
    expect(r.ownerProfit).toBe(1407);
  });
});

describe('краевые случаи', () => {
  it('печать в минус: партнёр получает только возврат материалов', () => {
    const loss: SettlementPosition = {
      pricePosition: 300, // печать 300 < материалы 330
      designCost: 0,
      quantity: 1,
      thermalCost: 70,
      blankCost: 260,
      clientItem: false,
    };
    const r = settlePosition(loss, 3000);
    expect(r.margin).toBe(0); // не уходит в минус
    expect(r.partnerProfit).toBe(0);
    expect(r.reward).toBe(330); // только материалы
    expect(r.ownerProfit).toBe(-30); // владелец в убытке, и это видно честно
  });

  it('настраиваемая ставка: 40% меняет доли', () => {
    const r = settlePosition(base, 4000);
    // маржа 520 × 0.4 = 208; вознаграждение 208 + 330 = 538
    expect(r.partnerProfit).toBe(208);
    expect(r.reward).toBe(538);
  });

  it('округление доли — вниз до рубля', () => {
    // маржа 100, ставка 33.33% → 33.33 → 33
    const p: SettlementPosition = {
      pricePosition: 430,
      designCost: 0,
      quantity: 1,
      thermalCost: 70,
      blankCost: 260,
      clientItem: false,
    };
    // печать 430 − материалы 330 = маржа 100
    const r = settlePosition(p, 3333);
    expect(r.margin).toBe(100);
    expect(r.partnerProfit).toBe(33);
  });
});

describe('расчёт по заказу (несколько позиций)', () => {
  it('суммирует позиции и сохраняет ставку', () => {
    const own: SettlementPosition = { ...base, clientItem: true };
    const order = settleOrder([base, own], 3000);
    // reward: 486 + 304 = 790; partnerProfit: 156 + 234 = 390
    expect(order.reward).toBe(790);
    expect(order.partnerProfit).toBe(390);
    expect(order.tshirtRevenue).toBe(2000);
    expect(order.rateBasisPoints).toBe(3000);
    // Баланс по заказу тоже сходится.
    expect(order.ownerProfit + order.reward).toBe(order.tshirtRevenue);
  });

  it('пустой заказ — нули', () => {
    const order = settleOrder([], 3000);
    expect(order.reward).toBe(0);
    expect(order.partnerProfit).toBe(0);
    expect(order.ownerProfit).toBe(0);
  });
});
