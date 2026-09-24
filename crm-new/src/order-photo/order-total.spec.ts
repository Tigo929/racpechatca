import {
  clampOrderDiscount,
  maxOrderDiscount,
  orderTotal,
} from './order-total';

/**
 * Скидка клиенту в рублях.
 *
 * Решение владельца 24.09.2026: скидку делим с исполнителем — она уменьшает
 * и чек, и базу зарплаты. Значит вычесть её нужно ровно один раз и ровно
 * в сумме заказа; всё остальное (зарплата, предоплата, выручка в отчётах)
 * считается от этой суммы и подтянется само.
 */

const parts = (over: Partial<Parameters<typeof orderTotal>[0]> = {}) => ({
  positionsTotal: 5000,
  deliveryCost: 300,
  designDevelopmentCost: 0,
  urgencyFee: 0,
  discountAmount: 0,
  ...over,
});

describe('сумма заказа со скидкой', () => {
  it('без скидки считается как раньше', () => {
    expect(orderTotal(parts())).toBe(5300);
    expect(
      orderTotal(parts({ designDevelopmentCost: 500, urgencyFee: 200 })),
    ).toBe(6000);
  });

  it('скидка уменьшает чек ровно на себя', () => {
    expect(orderTotal(parts({ discountAmount: 500 }))).toBe(4800);
  });

  it('база зарплаты падает вместе с чеком — скидку делим с исполнителем', () => {
    // База = чек − доставка − срочность (salary-calculation.ts).
    const p = parts({ discountAmount: 500, urgencyFee: 200 });
    const salaryBase = orderTotal(p) - p.deliveryCost - p.urgencyFee;
    expect(salaryBase).toBe(4500); // было бы 5000 без скидки
  });

  it('скидка не съедает доставку и срочность', () => {
    // Потолок — товар и дизайн: доставку мы платим перевозчику живыми
    // деньгами, а «скидка на срочность» означала бы её отсутствие.
    const p = parts({ discountAmount: 99999, urgencyFee: 200 });
    expect(maxOrderDiscount(p)).toBe(5000);
    expect(orderTotal(p)).toBe(500); // доставка 300 + срочность 200
  });

  it('скидка считается и от дизайна', () => {
    const p = parts({ designDevelopmentCost: 1000, discountAmount: 6000 });
    expect(maxOrderDiscount(p)).toBe(6000);
    expect(orderTotal(p)).toBe(300);
  });

  it('отрицательная скидка — это ноль, а не наценка', () => {
    expect(orderTotal(parts({ discountAmount: -500 }))).toBe(5300);
  });

  it('копейки округляются, чтобы чек оставался в рублях', () => {
    expect(
      clampOrderDiscount(499.6, {
        positionsTotal: 5000,
        designDevelopmentCost: 0,
      }),
    ).toBe(500);
  });

  it('заказ без поля скидки (заведён до её появления) считается без неё', () => {
    // NaN в сумме тише и опаснее любой ошибки: он ломает и чек, и зарплату.
    const base = { positionsTotal: 5000, designDevelopmentCost: 0 };
    expect(clampOrderDiscount(undefined, base)).toBe(0);
    expect(clampOrderDiscount(null, base)).toBe(0);
    expect(clampOrderDiscount(Number.NaN, base)).toBe(0);
  });

  it('скидка обрезается, когда позиции подешевели после её назначения', () => {
    // Убрали холст из заказа — скидка в 1 000 ₽ больше того, на что её давали.
    expect(
      clampOrderDiscount(1000, {
        positionsTotal: 700,
        designDevelopmentCost: 0,
      }),
    ).toBe(700);
  });
});
