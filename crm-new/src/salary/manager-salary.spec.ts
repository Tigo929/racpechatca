import {
  calculateManagerSalarySnapshot,
  calculateSalarySnapshot,
} from './salary-calculation';

/**
 * Зарплата менеджера по оформлению. Эталон — пример владельца:
 * футболка 1500 + дизайн 1000, базовая ставка 10%, премия за дизайн 40% →
 * база 1500 × 10% = 150, премия 1000 × 40% = 400, итого 550 (владельцу 600).
 */
describe('calculateManagerSalarySnapshot', () => {
  it('пример владельца: 1500 футболка + 1000 дизайн, 10% + 40% → 550', () => {
    // totalOrder = 2500 (дизайн входит в чек), доставки нет.
    const snap = calculateManagerSalarySnapshot(2500, 0, 1000, 1000, 4000);
    expect(snap.salaryBase).toBe(1500); // чек − доставка − дизайн
    expect(snap.designBase).toBe(1000);
    expect(snap.rateBasisPoints).toBe(1000);
    expect(snap.designRateBasisPoints).toBe(4000);
    expect(snap.salaryAmount).toBe(550); // 150 базовая + 400 премия
    expect(snap.status).toBe('PENDING');
  });

  it('доставка не входит в базовую часть', () => {
    // Чек 2500 + доставка 300, дизайн 1000 → база = 2800 − 300 − 1000 = 1500.
    const snap = calculateManagerSalarySnapshot(2800, 300, 1000, 1000, 4000);
    expect(snap.salaryBase).toBe(1500);
    expect(snap.salaryAmount).toBe(550);
  });

  it('без дизайна остаётся только базовая ставка', () => {
    const snap = calculateManagerSalarySnapshot(1500, 0, 0, 1000, 4000);
    expect(snap.salaryBase).toBe(1500);
    expect(snap.designBase).toBe(0);
    expect(snap.salaryAmount).toBe(150);
  });

  it('без ставок начисление нулевое (SETTLED)', () => {
    const snap = calculateManagerSalarySnapshot(1500, 0, 1000, null, null);
    expect(snap.salaryAmount).toBe(0);
    expect(snap.status).toBe('SETTLED');
  });

  it('только премия за дизайн, если базовая ставка не задана', () => {
    const snap = calculateManagerSalarySnapshot(2500, 0, 1000, null, 4000);
    expect(snap.salaryAmount).toBe(400);
  });

  it('база не уходит в минус при огромном дизайне', () => {
    const snap = calculateManagerSalarySnapshot(1000, 0, 5000, 1000, 4000);
    expect(snap.salaryBase).toBe(0);
    // Премия считается от заявленной стоимости дизайна независимо от базы.
    expect(snap.designBase).toBe(5000);
  });

  it('база менеджера отличается от базы исполнителя ровно на дизайн', () => {
    const manager = calculateManagerSalarySnapshot(2500, 200, 1000, 1000, 4000);
    const executor = calculateSalarySnapshot(2500, 200, 1000);
    expect(executor.salaryBase - manager.salaryBase).toBe(1000);
  });
});
