/**
 * Расход бумаги для ОТОБРАЖЕНИЯ в карточке заказа.
 *
 * Повторяет серверную формулу (crm-new/src/order-photo/photo-material.ts) —
 * ровно как computeSettlement повторяет расчёт с партнёром. Авторитетные
 * суммы считает сервер, здесь только показ.
 *
 * Печатаем на листах 10×15, мелкие форматы режутся из одного листа: десять
 * снимков Polaroid — это пять листов, а не десять.
 */

const SHEET_WIDTH_MM = 100;
const SHEET_HEIGHT_MM = 150;
/** Зазор на рез — только между снимками, не по краям: печать без полей
 *  занимает лист целиком. */
const GAP_MM = 5;

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

/** Форматы, раскладку которых задал владелец: режут вплотную, без зазора. */
const DECLARED: ReadonlyArray<[RegExp, number]> = [
  [/\b7\.5\s*x\s*10\b/, 2],
  [/\b10\s*x\s*7\.5\b/, 2],
  [/\b10\s*x\s*10\b/, 1],
  [/\b10\s*x\s*15\b/, 1],
  [/\b15\s*x\s*10\b/, 1],
];

function normalize(format: string): string {
  return format
    .toLowerCase()
    .replace(/[×хx]/g, 'x')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function fitsOnSheet(widthMm: number, heightMm: number): number {
  const fit = (w: number, h: number): number => {
    if (w <= 0 || h <= 0) return 0;
    const cols = Math.floor((SHEET_WIDTH_MM + GAP_MM) / (w + GAP_MM));
    const rows = Math.floor((SHEET_HEIGHT_MM + GAP_MM) / (h + GAP_MM));
    return Math.max(0, cols) * Math.max(0, rows);
  };
  return Math.max(fit(widthMm, heightMm), fit(heightMm, widthMm));
}

/** Сколько снимков этого формата выходит из одного листа 10×15. */
export function printsPerSheet(format: string): number {
  const text = normalize(format);
  if (HALF_SHEET_WORDS.some((w) => text.includes(w))) return 2;
  for (const [pattern, perSheet] of DECLARED) {
    if (pattern.test(text)) return perSheet;
  }
  const match = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (match) {
    const fits = fitsOnSheet(Number(match[1]) * 10, Number(match[2]) * 10);
    return fits > 0 ? fits : 1;
  }
  return 1;
}

export interface PhotoPaperUsage {
  /** Сколько листов уйдёт на заказ. */
  sheets: number;
  /** Себестоимость бумаги в рублях, округление вверх. */
  cost: number;
}

/** Расход бумаги по позициям заказа. */
export function computePaperUsage(
  items: { formatPaper: string; quantity: number }[],
  boxCost: number,
  sheetsPerBox: number,
): PhotoPaperUsage {
  const sheets = items.reduce((sum, item) => {
    const perSheet = printsPerSheet(item.formatPaper);
    // Вверх по позиции: половину листа обратно в пачку не положишь.
    return sum + Math.ceil(Math.max(0, item.quantity) / perSheet);
  }, 0);
  const kopecksPerSheet =
    sheetsPerBox > 0 ? Math.round((boxCost * 100) / sheetsPerBox) : 0;
  return { sheets, cost: Math.ceil((sheets * kopecksPerSheet) / 100) };
}
