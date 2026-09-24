import {
  CANVAS_PRODUCTION_PRICES,
  canvasContractorCost,
  canvasListPrice,
  canvasPriceMode,
  canvasRetailPrice,
  canvasTermsFrom,
  canvasWholesalePrice,
  findCanvasProductionPrice,
  resolveCanvasPosition,
  type CanvasMaterialKind,
  type CanvasTerms,
} from './canvas-production-price';

/** Условия розничной системы: прайс производства минус договорная скидка. */
const retailTerms = (discountBasisPoints: number): CanvasTerms => ({
  mode: 'RETAIL',
  discountBasisPoints,
});

/** Долг производству в розничной системе — как было до оптового прайса. */
const cost = (
  key: string,
  material: CanvasMaterialKind,
  discountBasisPoints: number,
) => canvasContractorCost(key, material, retailTerms(discountBasisPoints));

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
    expect(cost('20x30', 'SYNTHETIC', 2000)).toBe(504);
  });

  it('хлопок того же размера считается по своей колонке', () => {
    expect(canvasRetailPrice('20x30', 'COTTON')).toBe(780);
    expect(cost('20x30', 'COTTON', 2000)).toBe(624);
  });

  it('крайние размеры прайса на месте', () => {
    expect(canvasRetailPrice('100x200', 'COTTON')).toBe(9240);
    expect(findCanvasProductionPrice('60x90')?.synthetic).toBe(2460);
  });

  it('неизвестный размер даёт ноль, а не случайную цену', () => {
    // Ноль обязан быть заметен вызывающему коду: продать холст по цене
    // «примерно такого же размера» — это молча потерять деньги.
    expect(canvasRetailPrice('33x33', 'SYNTHETIC')).toBe(0);
    expect(cost('33x33', 'SYNTHETIC', 2000)).toBe(0);
    expect(findCanvasProductionPrice('33x33')).toBeUndefined();
  });

  it('без скидки должны всю розницу, при 100% — ничего', () => {
    expect(cost('30x40', 'SYNTHETIC', 0)).toBe(940);
    expect(cost('30x40', 'SYNTHETIC', 10000)).toBe(0);
    // Скидка больше ста процентов не превращается в доплату нам.
    expect(cost('30x40', 'SYNTHETIC', 12000)).toBe(0);
  });

  it('округление идёт вниз — за копейки производству не переплачиваем', () => {
    // 790 × 0.8 = 632 ровно; 1090 × 0.8 = 872 ровно; берём размер с остатком.
    expect(cost('30x30', 'SYNTHETIC', 2000)).toBe(632);
    expect(cost('20x30', 'SYNTHETIC', 1500)).toBe(535); // 535.5 → 535
  });

  it('позиция по размеру и материалу собирается сама', () => {
    const p = resolveCanvasPosition(
      { sizeKey: '20x30', material: 'SYNTHETIC' },
      retailTerms(2000),
    );
    expect(p).toEqual({
      formatCanvas: '20 × 30 см, синтетика',
      sizeKey: '20x30',
      material: 'SYNTHETIC',
      contractorPrice: 504,
    });
  });

  it('материал по умолчанию — синтетика', () => {
    expect(
      resolveCanvasPosition({ sizeKey: '20x30' }, retailTerms(2000)).material,
    ).toBe('SYNTHETIC');
  });

  it('цена производства из прайса важнее присланной руками', () => {
    // Иначе цену себестоимости можно было бы занизить с клиента и уйти
    // в минус незаметно: она считается, а не принимается на веру.
    const p = resolveCanvasPosition(
      { sizeKey: '20x30', material: 'COTTON', contractorPrice: 1 },
      retailTerms(2000),
    );
    expect(p.contractorPrice).toBe(624);
  });

  it('нестандартный размер остаётся ручным', () => {
    const p = resolveCanvasPosition(
      { formatCanvas: 'Модульный триптих', contractorPrice: 3200 },
      retailTerms(2000),
    );
    expect(p).toEqual({
      formatCanvas: 'Модульный триптих',
      sizeKey: null,
      material: null,
      contractorPrice: 3200,
    });
  });

  it('размер не из прайса не тянет за собой чужую цену', () => {
    const p = resolveCanvasPosition({ sizeKey: '33x33' }, retailTerms(2000));
    expect(p.sizeKey).toBeNull();
    expect(p.contractorPrice).toBe(0);
    expect(p.formatCanvas).toBe('Нестандартный размер');
  });
});

/**
 * Оптовый прайс (фото от 24.09.2026) и переключение систем расчёта.
 *
 * Две системы считают долг производству по-разному, и перепутать их значит
 * ошибиться в свою пользу на отчётах и в минус на переговорах. Поэтому здесь
 * закреплено и то, что числа взяты из нужной колонки, и то, что скидка в опте
 * второй раз не вычитается.
 */
describe('оптовый прайс производства', () => {
  const wholesaleTerms: CanvasTerms = {
    mode: 'WHOLESALE',
    // Скидка в настройках может лежать любая — в опте она не применяется.
    discountBasisPoints: 2000,
  };

  it('у каждого размера есть обе оптовые цены, и хлопок дороже синтетики', () => {
    for (const row of CANVAS_PRODUCTION_PRICES) {
      expect(row.wholesaleSynthetic).toBeGreaterThan(0);
      expect(row.wholesaleCotton).toBeGreaterThan(row.wholesaleSynthetic);
    }
  });

  it('контрольные строки прайса совпадают с присланной таблицей', () => {
    // Границы и несколько строк из середины: ошибка в разборе таблицы
    // выглядит как обычное число и всплыла бы уже в заказе.
    expect(canvasWholesalePrice('20x30', 'SYNTHETIC')).toBe(470);
    expect(canvasWholesalePrice('20x30', 'COTTON')).toBe(590);
    expect(canvasWholesalePrice('40x60', 'SYNTHETIC')).toBe(770);
    expect(canvasWholesalePrice('60x90', 'COTTON')).toBe(1880);
    expect(canvasWholesalePrice('80x120', 'SYNTHETIC')).toBe(2150);
    expect(canvasWholesalePrice('100x200', 'SYNTHETIC')).toBe(3970);
    expect(canvasWholesalePrice('100x200', 'COTTON')).toBe(5830);
  });

  it('в опте должны ровно прайсовую цену — скидка второй раз не вычитается', () => {
    expect(canvasContractorCost('20x30', 'SYNTHETIC', wholesaleTerms)).toBe(
      470,
    );
    expect(canvasContractorCost('20x30', 'COTTON', wholesaleTerms)).toBe(590);
    // та же позиция по старой системе — другая сумма, и это нормально
    expect(canvasContractorCost('20x30', 'SYNTHETIC', retailTerms(2000))).toBe(
      504,
    );
  });

  it('опт выгоднее прежней системы на каждом размере и материале', () => {
    // Если однажды окажется наоборот — в таблицу попала не та колонка.
    for (const row of CANVAS_PRODUCTION_PRICES) {
      for (const material of ['SYNTHETIC', 'COTTON'] as CanvasMaterialKind[]) {
        const wholesale = canvasContractorCost(
          row.key,
          material,
          wholesaleTerms,
        );
        const retail = canvasContractorCost(
          row.key,
          material,
          retailTerms(2000),
        );
        expect(wholesale).toBeLessThan(retail);
      }
    }
  });

  it('позиция заказа собирается по действующему прайсу', () => {
    expect(
      resolveCanvasPosition(
        { sizeKey: '30x40', material: 'COTTON' },
        wholesaleTerms,
      ),
    ).toEqual({
      formatCanvas: '30 × 40 см, хлопок',
      sizeKey: '30x40',
      material: 'COTTON',
      contractorPrice: 590,
    });
    expect(
      resolveCanvasPosition(
        { sizeKey: '30x40', material: 'COTTON' },
        retailTerms(2000),
      ).contractorPrice,
    ).toBe(944);
  });

  it('нестандартный размер остаётся ручным в любой системе', () => {
    const p = resolveCanvasPosition(
      { formatCanvas: 'Модульный триптих', contractorPrice: 3200 },
      wholesaleTerms,
    );
    expect(p.contractorPrice).toBe(3200);
    expect(p.sizeKey).toBeNull();
  });

  it('неизвестный размер и в опте даёт ноль, а не соседнюю цену', () => {
    expect(canvasWholesalePrice('33x33', 'SYNTHETIC')).toBe(0);
    expect(canvasContractorCost('33x33', 'COTTON', wholesaleTerms)).toBe(0);
  });

  it('цена действующего прайса выбирается по режиму', () => {
    expect(canvasListPrice('50x70', 'SYNTHETIC', 'RETAIL')).toBe(1830);
    expect(canvasListPrice('50x70', 'SYNTHETIC', 'WHOLESALE')).toBe(1000);
  });
});

describe('режим прайса из настроек', () => {
  it('читается как есть, когда значение известно', () => {
    expect(canvasPriceMode('WHOLESALE')).toBe('WHOLESALE');
    expect(canvasPriceMode('RETAIL')).toBe('RETAIL');
  });

  it('мусор и пустота означают прежнюю систему, а не отказ считать', () => {
    // Расчёт себестоимости обязан работать всегда: заказ важнее настройки.
    expect(canvasPriceMode(null)).toBe('RETAIL');
    expect(canvasPriceMode('опт')).toBe('RETAIL');
    expect(canvasPriceMode(undefined)).toBe('RETAIL');
  });

  it('условия собираются из строки настроек', () => {
    expect(
      canvasTermsFrom({
        canvasPriceMode: 'WHOLESALE',
        canvasDiscountBasisPoints: 1500,
      }),
    ).toEqual({ mode: 'WHOLESALE', discountBasisPoints: 1500 });
    // Настройки старой версии, где колонки ещё нет.
    expect(canvasTermsFrom({})).toEqual({
      mode: 'RETAIL',
      discountBasisPoints: 2000,
    });
  });
});
