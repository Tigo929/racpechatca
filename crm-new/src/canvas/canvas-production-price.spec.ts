import {
  CANVAS_PRODUCTION_PRICES,
  canvasContractorCost,
  canvasRetailPrice,
  findCanvasProductionPrice,
  resolveCanvasPosition,
} from './canvas-production-price';

/**
 * Прайс производства и расчёт долга перед ним.
 *
 * Числа сняты с PDF автоматическим разбором, а не набраны руками, поэтому
 * проверяем не «каждую строку», а то, что таблица цела и что математика
 * совпадает с примером, который владелец посчитал сам.
 */
describe('прайс производства на холст', () => {
  it('в таблице 46 размеров, у каждого оба материала и подрамник 2 см', () => {
    expect(CANVAS_PRODUCTION_PRICES).toHaveLength(46);
    for (const row of CANVAS_PRODUCTION_PRICES) {
      expect(row.synthetic).toBeGreaterThan(0);
      // Хлопок всегда дороже синтетики — если однажды окажется наоборот,
      // значит колонки при разборе нового прайса разъехались.
      expect(row.cotton).toBeGreaterThan(row.synthetic);
      expect(row.key).toBe(`${row.widthCm}x${row.heightCm}`);
    }
  });

  it('ключи размеров не повторяются', () => {
    const keys = CANVAS_PRODUCTION_PRICES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('20×30 синтетика — 630 ₽ розницы, со скидкой 20% должны 504 ₽', () => {
    // Ровно тот пример, которым владелец описал методику.
    expect(canvasRetailPrice('20x30', 'SYNTHETIC')).toBe(630);
    expect(canvasContractorCost('20x30', 'SYNTHETIC', 2000)).toBe(504);
  });

  it('хлопок того же размера считается по своей колонке', () => {
    expect(canvasRetailPrice('20x30', 'COTTON')).toBe(780);
    expect(canvasContractorCost('20x30', 'COTTON', 2000)).toBe(624);
  });

  it('крайние размеры прайса на месте', () => {
    expect(canvasRetailPrice('100x200', 'COTTON')).toBe(9240);
    expect(findCanvasProductionPrice('60x90')?.synthetic).toBe(2460);
  });

  it('неизвестный размер даёт ноль, а не случайную цену', () => {
    // Ноль обязан быть заметен вызывающему коду: продать холст по цене
    // «примерно такого же размера» — это молча потерять деньги.
    expect(canvasRetailPrice('33x33', 'SYNTHETIC')).toBe(0);
    expect(canvasContractorCost('33x33', 'SYNTHETIC', 2000)).toBe(0);
    expect(findCanvasProductionPrice('33x33')).toBeUndefined();
  });

  it('без скидки должны всю розницу, при 100% — ничего', () => {
    expect(canvasContractorCost('30x40', 'SYNTHETIC', 0)).toBe(940);
    expect(canvasContractorCost('30x40', 'SYNTHETIC', 10000)).toBe(0);
    // Скидка больше ста процентов не превращается в доплату нам.
    expect(canvasContractorCost('30x40', 'SYNTHETIC', 12000)).toBe(0);
  });

  it('округление идёт вниз — за копейки производству не переплачиваем', () => {
    // 790 × 0.8 = 632 ровно; 1090 × 0.8 = 872 ровно; берём размер с остатком.
    expect(canvasContractorCost('30x30', 'SYNTHETIC', 2000)).toBe(632);
    expect(canvasContractorCost('20x30', 'SYNTHETIC', 1500)).toBe(535); // 535.5 → 535
  });

  it('позиция по размеру и материалу собирается сама', () => {
    const p = resolveCanvasPosition(
      { sizeKey: '20x30', material: 'SYNTHETIC' },
      2000,
    );
    expect(p).toEqual({
      formatCanvas: '20 × 30 см, синтетика',
      sizeKey: '20x30',
      material: 'SYNTHETIC',
      contractorPrice: 504,
    });
  });

  it('материал по умолчанию — синтетика', () => {
    expect(resolveCanvasPosition({ sizeKey: '20x30' }, 2000).material).toBe(
      'SYNTHETIC',
    );
  });

  it('цена производства из прайса важнее присланной руками', () => {
    // Иначе цену себестоимости можно было бы занизить с клиента и уйти
    // в минус незаметно: она считается, а не принимается на веру.
    const p = resolveCanvasPosition(
      { sizeKey: '20x30', material: 'COTTON', contractorPrice: 1 },
      2000,
    );
    expect(p.contractorPrice).toBe(624);
  });

  it('нестандартный размер остаётся ручным', () => {
    const p = resolveCanvasPosition(
      { formatCanvas: 'Модульный триптих', contractorPrice: 3200 },
      2000,
    );
    expect(p).toEqual({
      formatCanvas: 'Модульный триптих',
      sizeKey: null,
      material: null,
      contractorPrice: 3200,
    });
  });

  it('размер не из прайса не тянет за собой чужую цену', () => {
    const p = resolveCanvasPosition({ sizeKey: '33x33' }, 2000);
    expect(p.sizeKey).toBeNull();
    expect(p.contractorPrice).toBe(0);
    expect(p.formatCanvas).toBe('Нестандартный размер');
  });
});
