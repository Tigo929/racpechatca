/**
 * Себестоимость бумаги по фотозаказу.
 *
 * Печатаем всё на листах 10×15. Мелкие форматы режутся из одного листа, и
 * именно поэтому оборот по фото никогда не равен заработку: десять снимков
 * в стиле Polaroid — это пять листов, а не десять.
 *
 * Формат позиции — свободный текст, и в базе больше тридцати написаний
 * одного и того же («10х15», «10x15» латиницей, «паларойд», «паларод»,
 * «Инстакс»). Поэтому здесь не таблица точных совпадений, а разбор:
 * сначала узнаём формат по ключевым словам, затем — по размерам в названии,
 * и только потом считаем лист целым.
 */

/** Рабочий лист — 10×15 см. */
const SHEET_WIDTH_MM = 100;
const SHEET_HEIGHT_MM = 150;

/**
 * Зазор на рез — 0,5 см, и только МЕЖДУ снимками, не по краям листа.
 * Иначе печать без полей не «помещается» на собственный лист: 10×15 занимает
 * его целиком, и никакого поля вокруг там нет.
 */
const GAP_MM = 5;

/**
 * Сколько снимков формата W×H (мм) помещается на лист.
 * Пробуем обе ориентации: повернуть картинку дешевле, чем испортить лист.
 */
export function printsPerSheetBySize(widthMm: number, heightMm: number): number {
  const fit = (w: number, h: number): number => {
    if (w <= 0 || h <= 0) return 0;
    // n штук в ряд занимают n×размер + (n−1)×зазор, отсюда и формула.
    const cols = Math.floor((SHEET_WIDTH_MM + GAP_MM) / (w + GAP_MM));
    const rows = Math.floor((SHEET_HEIGHT_MM + GAP_MM) / (h + GAP_MM));
    return Math.max(0, cols) * Math.max(0, rows);
  };
  return Math.max(fit(widthMm, heightMm), fit(heightMm, widthMm));
}

/** Приводим написание к единому виду: регистр, латиница, разделители. */
function normalize(format: string): string {
  return format
    .toLowerCase()
    .replace(/[×хx]/g, 'x') // русская «х», латинская «x», знак умножения
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ключевые слова форматов, которые режутся по два на лист. */
const HALF_SHEET_WORDS = [
  'полароид',
  'поларойд',
  'паларойд',
  'паларод',
  'палароид',
  'polaroid',
  'инстакс',
  'instax',
];

/**
 * Форматы, расход по которым задан владельцем, а не выведен геометрией.
 *
 * Нужны потому, что на практике режут вплотную, без зазора: два снимка
 * 7,5×10 — это ровно лист 10×15, и формула с зазором на рез дала бы один.
 * Реальная раскладка важнее модели.
 */
const DECLARED_PRINTS_PER_SHEET: ReadonlyArray<[RegExp, number]> = [
  [/\b7\.5\s*x\s*10\b/, 2],
  [/\b10\s*x\s*7\.5\b/, 2],
  [/\b10\s*x\s*10\b/, 1],
  [/\b10\s*x\s*15\b/, 1],
  [/\b15\s*x\s*10\b/, 1],
];

/**
 * Сколько снимков этого формата выходит из одного листа 10×15.
 *
 * Возвращаем целое число снимков на лист, а не долю листа: доля — дробь,
 * а все деньги в системе целые, и округлять надёжнее один раз, в самом конце.
 */
export function printsPerSheet(format: string): number {
  const text = normalize(format);

  // 1. Именованные форматы. Проверяем до разбора размеров: в названии
  // «Polaroid портрет 9x11» есть и слово, и размеры, и слово важнее —
  // так печатают по факту.
  if (HALF_SHEET_WORDS.some((word) => text.includes(word))) return 2;

  // 2. Форматы с заданным вручную расходом — раскладка на столе важнее модели.
  for (const [pattern, perSheet] of DECLARED_PRINTS_PER_SHEET) {
    if (pattern.test(text)) return perSheet;
  }

  // 3. Размеры в названии: «4x4», «13x11», «А7».
  const match = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (match) {
    const a = Number(match[1]) * 10; // сантиметры → миллиметры
    const b = Number(match[2]) * 10;
    // Формат крупнее листа (А3, постеры) — считаем лист целиком: это не
    // «много снимков из листа», а другая бумага, и врать в меньшую сторону
    // здесь опаснее, чем не досчитать экономию.
    const fits = printsPerSheetBySize(a, b);
    return fits > 0 ? fits : 1;
  }

  // 4. Ничего не поняли («яндекс», «глянец», «подарок») — считаем лист
  // целиком. Это заведомая переоценка расхода, но она заметна в отчёте,
  // а недооценка — нет.
  return 1;
}

export interface PhotoItemForCost {
  formatPaper: string;
  quantity: number;
}

/**
 * Себестоимость бумаги по позициям, в копейках.
 *
 * В копейках, потому что лист стоит 1,6 ₽: округли до рубля на каждой
 * позиции — и на сотне снимков ошибка съест половину экономии.
 */
export function photoMaterialCostKopecks(
  items: PhotoItemForCost[],
  sheetCostKopecks: number,
): number {
  return items.reduce((sum, item) => {
    const perSheet = printsPerSheet(item.formatPaper);
    const quantity = Math.max(0, item.quantity);
    // Округляем вверх по позиции: половину листа в тумбочку не положишь,
    // но и целый лист на каждый снимок списывать неправильно.
    const sheets = Math.ceil(quantity / perSheet);
    return sum + sheets * sheetCostKopecks;
  }, 0);
}

/** Цена одного листа в копейках из «коробка N листов за M рублей». */
export function sheetCostKopecks(boxCostRub: number, sheetsPerBox: number): number {
  if (sheetsPerBox <= 0) return 0;
  return Math.round((boxCostRub * 100) / sheetsPerBox);
}
