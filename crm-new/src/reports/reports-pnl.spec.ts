import { addExpense, emptyBucket, finalize } from './reports.service';

/**
 * Себестоимость холстов считается по самим заказам. Авто-расход
 * CANVAS_CONTRACTOR — та же сумма, и раньше она прибавлялась к себестоимости
 * второй раз: прибыль по холстам занижалась. Тест держит это исправленным.
 */
describe('отчёт: подрядчик по холстам не задваивается', () => {
  it('CANVAS_CONTRACTOR не попадает в себестоимость (cogs)', () => {
    const b = emptyBucket();
    // Себестоимость из заказа — как её ставит addOrder.
    b.canvasContractorCost = 1160;
    // Тот же подрядчик приходит ещё и авто-расходом.
    addExpense(b, {
      createdAt: new Date(),
      amount: 1160,
      category: 'CANVAS_CONTRACTOR',
    });

    const f = finalize(b);
    // Себестоимость — ровно один раз, а не 2320.
    expect(f.cogs).toBe(1160);
    // Выплата подрядчику видна отдельно, справочно.
    expect(b.canvasContractorPaid).toBe(1160);
  });

  it('вознаграждение партнёру по футболкам тоже не в cogs', () => {
    const b = emptyBucket();
    b.tshirtContractorCost = 597;
    addExpense(b, {
      createdAt: new Date(),
      amount: 597,
      category: 'PARTNER_REWARD',
    });

    const f = finalize(b);
    expect(f.cogs).toBe(597);
    expect(b.partnerReward).toBe(597);
  });

  it('расходы бизнеса и себестоимость — разные суммы', () => {
    const b = emptyBucket();
    b.canvasContractorCost = 1000; // себестоимость
    b.marketing = 500; // ваши деньги
    b.salaryAccrued = 300;

    const f = finalize(b);
    expect(f.cogs).toBe(1000);
    expect(f.operatingExpenses).toBe(500);
    // «Расходы» на экране = operatingExpenses + зарплата, БЕЗ себестоимости.
    expect(f.operatingExpenses + b.salaryAccrued).toBe(800);
  });
});
