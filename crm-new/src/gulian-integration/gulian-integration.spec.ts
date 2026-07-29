import { signGulianBody } from './gulian-client';
import { calculateGulianPayout } from './gulian-payload';

describe('Gulian integration contract', () => {
  it('signs exact raw bytes as timestamp + newline + request id + newline + body', () => {
    const signature = signGulianBody(
      'secret',
      '1722182153',
      'event-1',
      Buffer.from('{"x":1}', 'utf8'),
    );
    expect(signature).toBe(
      '76c508a556cc00b809384ca242cca3315a7b54f14a5045751b638c470e77b25a',
    );
  });

  it('sends one position with quantity 15 and exact payout 681 RUB per unit', () => {
    const payout = calculateGulianPayout(
      [
        {
          quantity: 15,
          pricePosition: 22_500,
          designCost: 0,
          thermalCost: 70,
          blankCost: 260,
          clientItem: false,
        },
      ],
      3000,
    );
    expect(payout).toEqual({
      quantity: 15,
      payoutCalculationMode: 'per_unit',
      unitPayoutAmountKopecks: 68_100,
      totalPayoutAmountKopecks: 1_021_500,
    });
  });

  it('uses order_total when production lines have different unit payouts', () => {
    const payout = calculateGulianPayout(
      [
        {
          quantity: 10,
          pricePosition: 15_000,
          designCost: 0,
          thermalCost: 70,
          blankCost: 260,
          clientItem: false,
        },
        {
          quantity: 5,
          pricePosition: 10_000,
          designCost: 0,
          thermalCost: 70,
          blankCost: 260,
          clientItem: false,
        },
      ],
      3000,
    );
    expect(payout.quantity).toBe(15);
    expect(payout.payoutCalculationMode).toBe('order_total');
    expect(payout.unitPayoutAmountKopecks).toBeNull();
    expect(payout.totalPayoutAmountKopecks).toBeGreaterThan(0);
  });
});
