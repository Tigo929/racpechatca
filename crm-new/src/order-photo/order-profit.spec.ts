import { calcOrderProfit, forecastSalary } from './order-profit';
import { photoMaterialCostKopecks, sheetCostKopecks } from './photo-material';
import { settleOrder } from '../partner/partner-settlement';

const SHEET = sheetCostKopecks(800, 500); // 1,6 ₽ за лист

describe('заработок по заказу', () => {
  it('холст за 1 500 ₽ при подрядчике 1 464 ₽ приносит 36 ₽', () => {
    // Реальный заказ 20260815-047 из базы: выглядит как обычная продажа,
    // а заработка почти нет. Ради этого случая всё и делалось.
    const p = calcOrderProfit({
      totalOrder: 1500,
      deliveryCharged: 0,
      deliveryPaid: 99,
      contractorCost: 1464,
    });

    expect(p.profit).toBe(36);
    expect(p.marginPermille).toBe(24); // 2,4%
  });

  it('футболка 1 500 ₽: партнёру 681 ₽, владельцу 819 ₽', () => {
    // Формула владельца: 1500 − 260 − 70 = 1170; 30% = 351; 351+70+260 = 681.
    const settlement = settleOrder(
      [
        {
          pricePosition: 1500,
          quantity: 1,
          designCost: 0,
          thermalCost: 70,
          blankCost: 260,
          clientItem: false,
        },
      ],
      3000,
    );
    expect(settlement.reward).toBe(681);

    const p = calcOrderProfit({
      totalOrder: 1500,
      deliveryCharged: 0,
      deliveryPaid: 0,
      contractorCost: settlement.reward,
    });

    expect(p.profit).toBe(819);
  });

  it('фото: бумага и зарплата уменьшают заработок', () => {
    // 100 снимков 10×15 по 10 ₽ = 1 000 ₽; бумаги 100 листов = 160 ₽;
    // зарплата исполнителя 30% от чека = 300 ₽.
    const material = photoMaterialCostKopecks(
      [{ formatPaper: '10х15', quantity: 100 }],
      SHEET,
    );
    const p = calcOrderProfit({
      totalOrder: 1000,
      deliveryCharged: 0,
      deliveryPaid: 0,
      photoMaterialKopecks: material,
      salaryCost: 300,
    });

    expect(p.materialCost).toBe(160);
    expect(p.profit).toBe(540);
  });

  it('Polaroid экономит бумагу вдвое', () => {
    const base = {
      totalOrder: 1000,
      deliveryCharged: 0,
      deliveryPaid: 0,
      salaryCost: 300,
    };
    const asPhoto = calcOrderProfit({
      ...base,
      photoMaterialKopecks: photoMaterialCostKopecks(
        [{ formatPaper: '10х15', quantity: 100 }],
        SHEET,
      ),
    });
    const asPolaroid = calcOrderProfit({
      ...base,
      photoMaterialKopecks: photoMaterialCostKopecks(
        [{ formatPaper: 'паларойд', quantity: 100 }],
        SHEET,
      ),
    });

    expect(asPolaroid.materialCost).toBe(80);
    expect(asPolaroid.profit - asPhoto.profit).toBe(80);
  });

  it('доставка приносит заработок, а не проходит транзитом', () => {
    // Взяли 300, отдали 99 — прежний отчёт вычитал все 300 и терял 201 ₽.
    const p = calcOrderProfit({
      totalOrder: 1300,
      deliveryCharged: 300,
      deliveryPaid: 99,
      salaryCost: 0,
    });

    expect(p.goodsRevenue).toBe(1000);
    expect(p.deliveryProfit).toBe(201);
    expect(p.profit).toBe(1201);
  });

  it('самовывоз: доставки нет — и себестоимости её нет', () => {
    const p = calcOrderProfit({
      totalOrder: 1000,
      deliveryCharged: 0,
      deliveryPaid: 99,
    });

    expect(p.deliveryProfit).toBe(0);
    expect(p.profit).toBe(1000);
  });

  it('убыточный заказ показывается минусом, а не нулём', () => {
    const p = calcOrderProfit({
      totalOrder: 1000,
      deliveryCharged: 0,
      deliveryPaid: 0,
      contractorCost: 1200,
    });

    expect(p.profit).toBe(-200);
    expect(p.marginPermille).toBe(-200);
  });
});

describe('прогноз зарплаты до начисления', () => {
  it('база — чек без доставки, дизайна и срочности', () => {
    // Чек 2 000 = товар 1 500 + доставка 300 + дизайн 100 + срочность 100.
    expect(forecastSalary(2000, 300, 100, 100, 3000)).toBe(450);
  });

  it('ставка ноль — зарплаты нет', () => {
    expect(forecastSalary(1000, 0, 0, 0, 0)).toBe(0);
  });

  it('база не уходит в минус', () => {
    expect(forecastSalary(100, 300, 0, 0, 3000)).toBe(0);
  });
});
