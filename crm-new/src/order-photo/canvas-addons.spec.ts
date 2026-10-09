import {
  addonsSummary,
  canvasPositionMoney,
  NO_ADDONS,
  normalizeAddons,
} from './canvas-addons';

/**
 * Допы к холсту считаются деньгами, а не подписью.
 *
 * Ошибка здесь не видна глазом: заказ выглядит правильно, а маржа по нему
 * врёт — себестоимость лака или багета просто не учтена. Поэтому правила
 * проверяются отдельно от интерфейса.
 */
describe('допы к холсту', () => {
  it('без допов считается как раньше', () => {
    expect(
      canvasPositionMoney({
        quantity: 2,
        clientPrice: 1500,
        contractorPrice: 900,
        addons: NO_ADDONS,
      }),
    ).toEqual({
      pricePosition: 3000,
      contractorCostPosition: 1800,
      profitPosition: 1200,
    });
  });

  it('лак и багет входят и в выручку, и в себестоимость', () => {
    const money = canvasPositionMoney({
      quantity: 1,
      clientPrice: 1500,
      contractorPrice: 900,
      addons: normalizeAddons({
        varnish: true,
        varnishClientPrice: 500,
        varnishContractorPrice: 300,
        frame: true,
        frameClientPrice: 1200,
        frameContractorPrice: 800,
      }),
    });
    expect(money.pricePosition).toBe(3200);
    expect(money.contractorCostPosition).toBe(2000);
    // Заработок на допах — 600 ₽ сверх 600 ₽ на самом холсте.
    expect(money.profitPosition).toBe(1200);
  });

  it('допы считаются за штуку: два холста в багете — два багета', () => {
    const money = canvasPositionMoney({
      quantity: 3,
      clientPrice: 1000,
      contractorPrice: 600,
      addons: normalizeAddons({
        frame: true,
        frameClientPrice: 1000,
        frameContractorPrice: 700,
      }),
    });
    expect(money.pricePosition).toBe(6000);
    expect(money.contractorCostPosition).toBe(3900);
  });

  it('можно взять только лак', () => {
    const addons = normalizeAddons({
      varnish: true,
      varnishClientPrice: 400,
      varnishContractorPrice: 250,
    });
    expect(addons.frame).toBe(false);
    expect(addons.frameClientPrice).toBe(0);
    expect(addonsSummary(addons)).toBe('лак');
  });

  it('можно взять только багет', () => {
    const addons = normalizeAddons({ frame: true, frameClientPrice: 1200 });
    expect(addons.varnish).toBe(false);
    expect(addonsSummary(addons)).toBe('багет');
  });

  it('оба допа называются вместе', () => {
    expect(addonsSummary(normalizeAddons({ varnish: true, frame: true }))).toBe(
      'лак, багет',
    );
    expect(addonsSummary(NO_ADDONS)).toBe('');
  });

  it('снятая галочка обнуляет цены допа', () => {
    // Иначе в строке осталась бы сумма, которой не видно в интерфейсе,
    // но которая продолжала бы считаться в выручке и себестоимости.
    const addons = normalizeAddons({
      varnish: false,
      varnishClientPrice: 500,
      varnishContractorPrice: 300,
    });
    expect(addons).toMatchObject({
      varnish: false,
      varnishClientPrice: 0,
      varnishContractorPrice: 0,
    });
  });

  it('бесплатный доп остаётся допом', () => {
    // Подарок или компенсация: денег не взяли, а лакировать всё равно надо.
    const addons = normalizeAddons({ varnish: true, varnishClientPrice: 0 });
    expect(addons.varnish).toBe(true);
    expect(addonsSummary(addons)).toBe('лак');
  });

  it('отрицательные и дробные цены не проходят', () => {
    const addons = normalizeAddons({
      varnish: true,
      varnishClientPrice: -100,
      varnishContractorPrice: 10.7,
    });
    expect(addons.varnishClientPrice).toBe(0);
    expect(addons.varnishContractorPrice).toBe(11);
  });

  it('количество меньше одного считается как одна штука', () => {
    expect(
      canvasPositionMoney({
        quantity: 0,
        clientPrice: 1000,
        contractorPrice: 600,
        addons: NO_ADDONS,
      }).pricePosition,
    ).toBe(1000);
  });
});
