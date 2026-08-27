import { settlementPositions } from './settlement-positions';
import { settleOrder } from './partner-settlement';

/**
 * Печать на изделии заказчика заводится свободной позицией, и до появления
 * этого модуля она проходила мимо расчёта: партнёру начислялся ноль, а вся
 * сумма падала владельцу в прибыль. Числа в тестах — тот самый заказ, на
 * котором расхождение и заметили.
 */
const RATE = 3000; // 30%

const freePrint = {
  pricePosition: 1500,
  quantity: 3,
  printOnClientItem: true,
  thermalCost: 70,
};

describe('позиции заказа для расчёта с партнёром', () => {
  it('печать на изделии заказчика попадает в расчёт: плёнка плюс доля', () => {
    const s = settleOrder(
      settlementPositions({ tshirtItems: [], items: [freePrint] }),
      RATE,
    );

    // Материалы — только термоперенос: заготовку купил клиент.
    expect(s.materials).toBe(210); // 70 × 3
    expect(s.margin).toBe(1290); // 1500 − 210
    expect(s.partnerProfit).toBe(387); // 30% от маржи
    expect(s.reward).toBe(597); // 387 + 210 возврата материалов
    expect(s.ownerProfit).toBe(903); // 1500 − 597
  });

  it('заготовка клиента не оплачивается, сколько бы ни стоила наша', () => {
    const withBlank = settleOrder(
      settlementPositions({ items: [freePrint] }),
      RATE,
    );
    // Та же позиция как обычная футболка стоила бы нам ещё 260 × 3 материалов.
    const asOwnTshirt = settleOrder(
      [
        {
          pricePosition: 1500,
          designCost: 0,
          quantity: 3,
          thermalCost: 70,
          blankCost: 260,
          clientItem: false,
        },
      ],
      RATE,
    );
    expect(asOwnTshirt.materials).toBe(990);
    expect(withBlank.materials).toBe(210);
  });

  it('обычная свободная позиция (кружка, баннер) в расчёт не идёт', () => {
    const s = settleOrder(
      settlementPositions({
        items: [
          {
            pricePosition: 2000,
            quantity: 2,
            printOnClientItem: false,
            thermalCost: 0,
          },
        ],
      }),
      RATE,
    );
    expect(s.reward).toBe(0);
    expect(s.tshirtRevenue).toBe(0);
  });

  it('футболки и печать на изделии заказчика складываются в один расчёт', () => {
    const s = settleOrder(
      settlementPositions({
        tshirtItems: [
          {
            pricePosition: 1000,
            designCost: 0,
            quantity: 1,
            thermalCost: 70,
            blankCost: 260,
            clientItem: false,
          },
        ],
        items: [freePrint],
      }),
      RATE,
    );
    expect(s.tshirtRevenue).toBe(2500); // 1000 + 1500
    expect(s.materials).toBe(540); // 330 + 210
  });

  it('пустой заказ не ломает расчёт', () => {
    expect(settlementPositions({})).toEqual([]);
    expect(settlementPositions({ tshirtItems: null, items: null })).toEqual([]);
  });
});
