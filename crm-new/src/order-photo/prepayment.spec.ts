import { computePrepayment, DEFAULT_PREPAY_RATE } from './prepayment';

describe('computePrepayment — предоплата и остаток', () => {
  it('без записанной предоплаты — ориентир 50%, округление вверх', () => {
    const r = computePrepayment(1500, null);
    expect(r).toEqual({ prepaid: 750, balanceDue: 750, recorded: false });
  });

  it('нечётная сумма: предоплата округляется вверх, остаток — меньшая половина', () => {
    // 1501 → предоплата 751, остаток 750. Итог всегда сходится к сумме.
    const r = computePrepayment(1501, undefined);
    expect(r.prepaid).toBe(751);
    expect(r.balanceDue).toBe(750);
    expect(r.prepaid + r.balanceDue).toBe(1501);
    expect(r.recorded).toBe(false);
  });

  it('undefined и null трактуются одинаково — предоплата не записана', () => {
    expect(computePrepayment(2000, undefined)).toEqual(
      computePrepayment(2000, null),
    );
  });

  it('записана реальная предоплата — остаток считается от неё, а не от 50%', () => {
    // Клиент внёс 1500. Потом в заказ добавили позицию, сумма стала 4000.
    // Остаток = 4000 − 1500 = 2500, а НЕ 50% от 4000 (это была старая ошибка).
    const r = computePrepayment(4000, 1500);
    expect(r).toEqual({ prepaid: 1500, balanceDue: 2500, recorded: true });
  });

  it('предоплата покрыла заказ ровно — остаток ноль', () => {
    const r = computePrepayment(3000, 3000);
    expect(r.balanceDue).toBe(0);
    expect(r.recorded).toBe(true);
  });

  it('переплата: убрали позицию после предоплаты — остаток отрицательный (к возврату)', () => {
    // Внёс 2000, потом сумму уменьшили до 1200 → возврат 800.
    const r = computePrepayment(1200, 2000);
    expect(r.balanceDue).toBe(-800);
    expect(r.prepaid).toBe(2000);
    expect(r.recorded).toBe(true);
  });

  it('предоплата = 0 записана явно — это не то же самое, что «не записана»', () => {
    const r = computePrepayment(1500, 0);
    expect(r).toEqual({ prepaid: 0, balanceDue: 1500, recorded: true });
  });

  it('дробные и отрицательные входные значения приводятся к целым и не ломают расчёт', () => {
    expect(computePrepayment(1500.4, 500.6)).toEqual({
      prepaid: 501,
      balanceDue: 999,
      recorded: true,
    });
    // Отрицательная сумма заказа быть не должна, но расчёт не должен уходить в минус.
    expect(computePrepayment(-100, null).prepaid).toBe(0);
    // Отрицательная «внесённая» сумма приводится к 0.
    expect(computePrepayment(1000, -50)).toEqual({
      prepaid: 0,
      balanceDue: 1000,
      recorded: true,
    });
  });

  it('доля предоплаты по умолчанию — половина', () => {
    expect(DEFAULT_PREPAY_RATE).toBe(0.5);
  });
});
