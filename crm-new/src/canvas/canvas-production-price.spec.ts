import {
  CANVAS_PRODUCTION_PRICES,
  canvasContractorCost,
  canvasRetailPrice,
  canvasWholesalePrice,
  findCanvasProductionPrice,
  resolveCanvasPosition,
  type CanvasMaterialKind,
} from './canvas-production-price';

/**
 * Прайс производства на холст: розница клиенту, опт производству.
 *
 * Числа сняты с присланного прайса автоматическим разбором, а не набраны
 * руками, поэтому проверяем не «каждую строку», а то, что таблица цела,
 * что колонки не разъехались и что долг производству считается ровно по
 * оптовой цене — без вычетов, которые остались в прошлой договорённости.
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

  it('у каждого размера есть обе оптовые цены, и хлопок дороже синтетики', () => {
    for (const row of CANVAS_PRODUCTION_PRICES) {
      expect(row.wholesaleSynthetic).toBeGreaterThan(0);
      expect(row.wholesaleCotton).toBeGreaterThan(row.wholesaleSynthetic);
    }
  });

  it('контрольные строки прайса совпадают с присланной таблицей', () => {
    // Границы и несколько строк из середины: ошибка в разборе таблицы
    // выглядит как обычное число и всплыла бы уже в заказе.
    expect(canvasRetailPrice('20x30', 'SYNTHETIC')).toBe(630);
    expect(canvasRetailPrice('20x30', 'COTTON')).toBe(780);
    expect(canvasWholesalePrice('20x30', 'SYNTHETIC')).toBe(470);
    expect(canvasWholesalePrice('20x30', 'COTTON')).toBe(590);
    expect(canvasWholesalePrice('40x60', 'SYNTHETIC')).toBe(770);
    expect(canvasWholesalePrice('60x90', 'COTTON')).toBe(1880);
    expect(canvasWholesalePrice('80x120', 'SYNTHETIC')).toBe(2150);
    expect(canvasWholesalePrice('100x200', 'SYNTHETIC')).toBe(3970);
    expect(canvasWholesalePrice('100x200', 'COTTON')).toBe(5830);
  });

  it('опт ниже розницы на каждом размере — заработок есть на любом', () => {
    // «Розница минус опт» и есть заработок на полотне. Если на какой-то
    // строке опт окажется не ниже розницы, значит в таблицу попала не та
    // колонка, и заказ по ней уйдёт в минус.
    for (const row of CANVAS_PRODUCTION_PRICES) {
      expect(row.wholesaleSynthetic).toBeLessThan(row.synthetic);
      expect(row.wholesaleCotton).toBeLessThan(row.cotton);
    }
  });

  it('неизвестный размер даёт ноль, а не соседнюю цену', () => {
    expect(findCanvasProductionPrice('33x33')).toBeUndefined();
    expect(canvasRetailPrice('33x33', 'SYNTHETIC')).toBe(0);
    expect(canvasWholesalePrice('33x33', 'COTTON')).toBe(0);
  });
});

/**
 * Долг производству.
 *
 * Одна система: сколько стоит холст по оптовой колонке, столько и должны.
 * Прежняя договорённость («розница минус 20%») отменена, и тест сторожит,
 * что она не вернулась незаметно: 504 ₽ вместо 470 ₽ на 20×30 — это
 * завышенная себестоимость и заниженная прибыль в отчёте.
 */
describe('сколько должны производству', () => {
  it('равен оптовой цене прайса', () => {
    expect(canvasContractorCost('20x30', 'SYNTHETIC')).toBe(470);
    expect(canvasContractorCost('20x30', 'COTTON')).toBe(590);
    expect(canvasContractorCost('50x70', 'SYNTHETIC')).toBe(
      canvasWholesalePrice('50x70', 'SYNTHETIC'),
    );
  });

  it('из розницы ничего не вычитается', () => {
    // 630 − 20% = 504: ровно та цифра, которую мы платили по прежней
    // договорённости. Её здесь быть не должно.
    expect(canvasContractorCost('20x30', 'SYNTHETIC')).not.toBe(504);
    for (const row of CANVAS_PRODUCTION_PRICES) {
      for (const material of ['SYNTHETIC', 'COTTON'] as CanvasMaterialKind[]) {
        expect(canvasContractorCost(row.key, material)).toBe(
          canvasWholesalePrice(row.key, material),
        );
      }
    }
  });

  it('заработок на полотне — розница минус опт', () => {
    // Пример владельца: 20×30 синтетика, 630 ₽ клиенту, 470 ₽ производству.
    const client = canvasRetailPrice('20x30', 'SYNTHETIC');
    const owed = canvasContractorCost('20x30', 'SYNTHETIC');
    expect(client - owed).toBe(160);
  });

  it('размера нет в прайсе — ноль, себестоимость вводят руками', () => {
    expect(canvasContractorCost('33x33', 'COTTON')).toBe(0);
  });
});

describe('позиция заказа по выбору размера', () => {
  it('собирается сама: подпись, ключ, материал и цена производства', () => {
    expect(
      resolveCanvasPosition({ sizeKey: '20x30', material: 'SYNTHETIC' }),
    ).toEqual({
      formatCanvas: '20 × 30 см, синтетика',
      sizeKey: '20x30',
      material: 'SYNTHETIC',
      contractorPrice: 470,
    });
    expect(
      resolveCanvasPosition({ sizeKey: '30x40', material: 'COTTON' }),
    ).toEqual({
      formatCanvas: '30 × 40 см, хлопок',
      sizeKey: '30x40',
      material: 'COTTON',
      contractorPrice: 590,
    });
  });

  it('материал по умолчанию — синтетика', () => {
    expect(resolveCanvasPosition({ sizeKey: '20x30' }).material).toBe(
      'SYNTHETIC',
    );
  });

  it('цена производства из прайса важнее присланной руками', () => {
    // Иначе себестоимость можно было бы занизить из браузера и уйти
    // в минус незаметно: она считается, а не принимается на веру.
    const p = resolveCanvasPosition({
      sizeKey: '20x30',
      material: 'COTTON',
      contractorPrice: 1,
    });
    expect(p.contractorPrice).toBe(590);
  });

  it('нестандартный размер остаётся ручным', () => {
    expect(
      resolveCanvasPosition({
        formatCanvas: 'Модульный триптих',
        contractorPrice: 3200,
      }),
    ).toEqual({
      formatCanvas: 'Модульный триптих',
      sizeKey: null,
      material: null,
      contractorPrice: 3200,
    });
  });

  it('размер не из прайса не тянет за собой чужую цену', () => {
    const p = resolveCanvasPosition({ sizeKey: '33x33' });
    expect(p.sizeKey).toBeNull();
    expect(p.contractorPrice).toBe(0);
    expect(p.formatCanvas).toBe('Нестандартный размер');
  });
});
