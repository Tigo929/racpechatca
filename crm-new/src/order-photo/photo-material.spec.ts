import {
  photoMaterialCostKopecks,
  printsPerSheet,
  printsPerSheetBySize,
  sheetCostKopecks,
} from './photo-material';

/**
 * Формат позиции вводится руками, поэтому проверяем именно то, что реально
 * лежит в базе: тридцать с лишним написаний одних и тех же форматов.
 * Ошибка здесь не видна глазом — она просто тихо искажает прибыль.
 */
describe('расход бумаги по формату', () => {
  it('10×15 занимает целый лист во всех написаниях', () => {
    for (const format of [
      '10х15',
      '10x15',
      '10Х15',
      '10×15',
      '10X15',
      '10х15 без полей',
      '10х15 с полями',
      '10х15(глянец)',
      '10Х15-ГЛЯНЕЦ',
      '10х15  с полями',
    ]) {
      expect(printsPerSheet(format)).toBe(1);
    }
  });

  it('Polaroid и Instax режутся по два из листа', () => {
    for (const format of [
      'паларойд',
      'Паларойд',
      'паларод',
      'Паларод',
      'полароид',
      'Polaroid портрет 9×11',
      'Polaroid альбомные 11×9',
      'Печать фото в стиле Polaroid',
      'инстакс',
      'Инстакс',
      'Формат инстакс + надпись',
      'Instax альбомные 8,6×5,4',
      '10х15-паларойд',
    ]) {
      expect(printsPerSheet(format)).toBe(2);
    }
  });

  it('7,5×10 выходит два из листа — как и говорит геометрия', () => {
    for (const format of [
      '7.5х10 с полями',
      '7,5х10',
      '7,5×10',
      '7.5x10 с полями',
      'Фото 7,5×10 без полей',
    ]) {
      expect(printsPerSheet(format)).toBe(2);
    }
  });

  it('10×10 — целый лист', () => {
    expect(printsPerSheet('10х10')).toBe(1);
    expect(printsPerSheet('10х10 с полями')).toBe(1);
    expect(printsPerSheet('10×10 (полями)')).toBe(1);
  });

  it('4×4 — шесть штук из листа (2 в ряд × 3 ряда с зазором 5 мм)', () => {
    expect(printsPerSheet('4х4')).toBe(6);
  });

  it('непонятный формат считаем целым листом — переоценка заметна, недооценка нет', () => {
    for (const format of ['яндекс', 'глянец', 'Пользовательский формат', '96']) {
      expect(printsPerSheet(format)).toBe(1);
    }
  });

  it('формат крупнее листа не даёт нулевой расход', () => {
    expect(printsPerSheet('а4')).toBe(1);
    expect(printsPerSheet('30х40')).toBe(1);
  });
});

describe('геометрия раскладки', () => {
  it('10×15 сам по себе — один на лист', () => {
    expect(printsPerSheetBySize(100, 150)).toBe(1);
  });

  it('поворот учитывается: 15×10 тоже помещается', () => {
    expect(printsPerSheetBySize(150, 100)).toBe(1);
  });

  it('крупнее листа — ноль, решение принимает вызывающий код', () => {
    expect(printsPerSheetBySize(210, 297)).toBe(0);
  });
});

describe('себестоимость бумаги', () => {
  const SHEET = sheetCostKopecks(800, 500); // коробка 500 листов за 800 ₽

  it('лист из коробки 800 ₽ / 500 шт стоит 1,6 ₽', () => {
    expect(SHEET).toBe(160);
  });

  it('десять Polaroid — это пять листов, а не десять', () => {
    expect(photoMaterialCostKopecks([{ formatPaper: 'паларойд', quantity: 10 }], SHEET)).toBe(
      5 * 160,
    );
  });

  it('десять 10×15 — десять листов', () => {
    expect(photoMaterialCostKopecks([{ formatPaper: '10х15', quantity: 10 }], SHEET)).toBe(
      10 * 160,
    );
  });

  it('нечётное количество округляется вверх: половину листа не сохранить', () => {
    expect(photoMaterialCostKopecks([{ formatPaper: 'паларойд', quantity: 7 }], SHEET)).toBe(
      4 * 160,
    );
  });

  it('позиции складываются', () => {
    const cost = photoMaterialCostKopecks(
      [
        { formatPaper: '10х15', quantity: 100 },
        { formatPaper: 'Паларойд', quantity: 50 },
        { formatPaper: '4х4', quantity: 12 },
      ],
      SHEET,
    );
    expect(cost).toBe((100 + 25 + 2) * 160);
  });

  it('пустой заказ ничего не стоит', () => {
    expect(photoMaterialCostKopecks([], SHEET)).toBe(0);
    expect(photoMaterialCostKopecks([{ formatPaper: '10х15', quantity: 0 }], SHEET)).toBe(0);
  });
});
