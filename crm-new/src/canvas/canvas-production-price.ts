/**
 * Прайс производства на печать по холсту — две колонки одной таблицы.
 *
 * Производство дало два прайса на один и тот же холст: розничный и оптовый.
 * Розницу мы называем клиенту — витринный прайс (canvas.pricing.ts) собран
 * из этих же чисел, и их совпадение сторожит canvas-client-price.spec.ts.
 * Опт отдаём производству. Поэтому «розница минус опт» и есть заработок на
 * полотне, и оба числа лежат в одной строке — разъехаться им негде.
 *
 * Долг производству равен оптовой цене, и больше из неё ничего не
 * вычитается. Прежняя договорённость была другой: оптового прайса не
 * существовало, производство присылало только розничный, и мы платили
 * розницу минус 20% — так и считался опт, пока его не называли. С прайса
 * от 24.09.2026 опт есть в явном виде, поэтому вычет отменён, а вместе с
 * ним и переключатель систем: пока он был, долг можно было посчитать по
 * договорённости, которой больше нет, и прибыль в отчёте завысилась бы
 * молча.
 *
 * Обе колонки — «подрамник 2 см», единственный, который мы заказываем.
 * Колонки 3,5 см, ламинации и геля в расчёт не берём: их не заказываем.
 *
 * Проверка на живом примере владельца: 20×30 синтетика, подрамник 2 см —
 * 630 ₽ клиенту, 470 ₽ производству, заработок 160 ₽ с полотна.
 *
 * Заказы, оформленные до отмены вычета, не пересчитываются: в их позициях
 * лежат свои числа, по ним с производством уже рассчитались.
 */

export type CanvasMaterialKind = 'SYNTHETIC' | 'COTTON';

export const CANVAS_MATERIAL_KIND_LABELS: Record<CanvasMaterialKind, string> = {
  SYNTHETIC: 'Синтетика',
  COTTON: 'Хлопок',
};

export interface CanvasProductionPrice {
  /** Ключ размера, он же попадает в позицию заказа: «20x30». */
  key: string;
  widthCm: number;
  heightCm: number;
  /** Розница производства, синтетика + подрамник 2 см, ₽. */
  synthetic: number;
  /** Розница производства, хлопок + подрамник 2 см, ₽. */
  cotton: number;
  /** Оптовая цена, синтетика + подрамник 2 см, ₽. */
  wholesaleSynthetic: number;
  /** Оптовая цена, хлопок + подрамник 2 см, ₽. */
  wholesaleCotton: number;
}

/** Прайс производства: 46 размеров, подрамник 2 см, обе системы цен. */
export const CANVAS_PRODUCTION_PRICES: CanvasProductionPrice[] = [
  {
    key: '20x30',
    widthCm: 20,
    heightCm: 30,
    synthetic: 630,
    cotton: 780,
    wholesaleSynthetic: 470,
    wholesaleCotton: 590,
  },
  {
    key: '20x40',
    widthCm: 20,
    heightCm: 40,
    synthetic: 770,
    cotton: 950,
    wholesaleSynthetic: 470,
    wholesaleCotton: 590,
  },
  {
    key: '30x30',
    widthCm: 30,
    heightCm: 30,
    synthetic: 790,
    cotton: 980,
    wholesaleSynthetic: 470,
    wholesaleCotton: 590,
  },
  {
    key: '30x40',
    widthCm: 30,
    heightCm: 40,
    synthetic: 940,
    cotton: 1180,
    wholesaleSynthetic: 470,
    wholesaleCotton: 590,
  },
  {
    key: '30x50',
    widthCm: 30,
    heightCm: 50,
    synthetic: 1090,
    cotton: 1380,
    wholesaleSynthetic: 560,
    wholesaleCotton: 700,
  },
  {
    key: '30x60',
    widthCm: 30,
    heightCm: 60,
    synthetic: 1240,
    cotton: 1570,
    wholesaleSynthetic: 640,
    wholesaleCotton: 810,
  },
  {
    key: '40x40',
    widthCm: 40,
    heightCm: 40,
    synthetic: 1110,
    cotton: 1410,
    wholesaleSynthetic: 570,
    wholesaleCotton: 720,
  },
  {
    key: '40x50',
    widthCm: 40,
    heightCm: 50,
    synthetic: 1270,
    cotton: 1630,
    wholesaleSynthetic: 670,
    wholesaleCotton: 850,
  },
  {
    key: '40x60',
    widthCm: 40,
    heightCm: 60,
    synthetic: 1450,
    cotton: 1870,
    wholesaleSynthetic: 770,
    wholesaleCotton: 990,
  },
  {
    key: '40x70',
    widthCm: 40,
    heightCm: 70,
    synthetic: 1610,
    cotton: 2090,
    wholesaleSynthetic: 860,
    wholesaleCotton: 1120,
  },
  {
    key: '40x80',
    widthCm: 40,
    heightCm: 80,
    synthetic: 1780,
    cotton: 2320,
    wholesaleSynthetic: 960,
    wholesaleCotton: 1260,
  },
  {
    key: '50x50',
    widthCm: 50,
    heightCm: 50,
    synthetic: 1470,
    cotton: 1900,
    wholesaleSynthetic: 780,
    wholesaleCotton: 1010,
  },
  {
    key: '50x60',
    widthCm: 50,
    heightCm: 60,
    synthetic: 1650,
    cotton: 2150,
    wholesaleSynthetic: 890,
    wholesaleCotton: 1170,
  },
  {
    key: '50x70',
    widthCm: 50,
    heightCm: 70,
    synthetic: 1830,
    cotton: 2410,
    wholesaleSynthetic: 1000,
    wholesaleCotton: 1330,
  },
  {
    key: '50x80',
    widthCm: 50,
    heightCm: 80,
    synthetic: 2030,
    cotton: 2680,
    wholesaleSynthetic: 1100,
    wholesaleCotton: 1470,
  },
  {
    key: '50x90',
    widthCm: 50,
    heightCm: 90,
    synthetic: 2210,
    cotton: 2930,
    wholesaleSynthetic: 1210,
    wholesaleCotton: 1630,
  },
  {
    key: '60x60',
    widthCm: 60,
    heightCm: 60,
    synthetic: 1850,
    cotton: 2440,
    wholesaleSynthetic: 1010,
    wholesaleCotton: 1350,
  },
  {
    key: '60x70',
    widthCm: 60,
    heightCm: 70,
    synthetic: 2060,
    cotton: 2730,
    wholesaleSynthetic: 1130,
    wholesaleCotton: 1520,
  },
  {
    key: '60x80',
    widthCm: 60,
    heightCm: 80,
    synthetic: 2260,
    cotton: 3010,
    wholesaleSynthetic: 1250,
    wholesaleCotton: 1700,
  },
  {
    key: '60x90',
    widthCm: 60,
    heightCm: 90,
    synthetic: 2460,
    cotton: 3300,
    wholesaleSynthetic: 1370,
    wholesaleCotton: 1880,
  },
  {
    key: '60x100',
    widthCm: 60,
    heightCm: 100,
    synthetic: 2670,
    cotton: 3600,
    wholesaleSynthetic: 1500,
    wholesaleCotton: 2060,
  },
  {
    key: '60x120',
    widthCm: 60,
    heightCm: 120,
    synthetic: 3070,
    cotton: 4160,
    wholesaleSynthetic: 1750,
    wholesaleCotton: 2420,
  },
  {
    key: '60x150',
    widthCm: 60,
    heightCm: 150,
    synthetic: 3680,
    cotton: 5020,
    wholesaleSynthetic: 2120,
    wholesaleCotton: 2950,
  },
  {
    key: '70x70',
    widthCm: 70,
    heightCm: 70,
    synthetic: 2280,
    cotton: 3040,
    wholesaleSynthetic: 1260,
    wholesaleCotton: 1720,
  },
  {
    key: '70x80',
    widthCm: 70,
    heightCm: 80,
    synthetic: 2500,
    cotton: 3360,
    wholesaleSynthetic: 1400,
    wholesaleCotton: 1920,
  },
  {
    key: '70x90',
    widthCm: 70,
    heightCm: 90,
    synthetic: 2720,
    cotton: 3680,
    wholesaleSynthetic: 1540,
    wholesaleCotton: 2120,
  },
  {
    key: '70x100',
    widthCm: 70,
    heightCm: 100,
    synthetic: 2940,
    cotton: 4000,
    wholesaleSynthetic: 1670,
    wholesaleCotton: 2330,
  },
  {
    key: '70x120',
    widthCm: 70,
    heightCm: 120,
    synthetic: 3380,
    cotton: 4630,
    wholesaleSynthetic: 1950,
    wholesaleCotton: 2730,
  },
  {
    key: '70x150',
    widthCm: 70,
    heightCm: 150,
    synthetic: 4050,
    cotton: 5580,
    wholesaleSynthetic: 2360,
    wholesaleCotton: 3340,
  },
  {
    key: '80x80',
    widthCm: 80,
    heightCm: 80,
    synthetic: 2740,
    cotton: 3710,
    wholesaleSynthetic: 1550,
    wholesaleCotton: 2150,
  },
  {
    key: '80x90',
    widthCm: 80,
    heightCm: 90,
    synthetic: 2970,
    cotton: 4050,
    wholesaleSynthetic: 1700,
    wholesaleCotton: 2370,
  },
  {
    key: '80x100',
    widthCm: 80,
    heightCm: 100,
    synthetic: 3110,
    cotton: 4400,
    wholesaleSynthetic: 1850,
    wholesaleCotton: 2600,
  },
  {
    key: '80x120',
    widthCm: 80,
    heightCm: 120,
    synthetic: 3690,
    cotton: 5090,
    wholesaleSynthetic: 2150,
    wholesaleCotton: 3050,
  },
  {
    key: '80x150',
    widthCm: 80,
    heightCm: 150,
    synthetic: 4400,
    cotton: 6130,
    wholesaleSynthetic: 2600,
    wholesaleCotton: 3720,
  },
  {
    key: '90x90',
    widthCm: 90,
    heightCm: 90,
    synthetic: 3230,
    cotton: 4430,
    wholesaleSynthetic: 1860,
    wholesaleCotton: 2620,
  },
  {
    key: '90x100',
    widthCm: 90,
    heightCm: 100,
    synthetic: 3490,
    cotton: 4810,
    wholesaleSynthetic: 2030,
    wholesaleCotton: 2870,
  },
  {
    key: '90x120',
    widthCm: 90,
    heightCm: 120,
    synthetic: 3990,
    cotton: 5550,
    wholesaleSynthetic: 2360,
    wholesaleCotton: 3360,
  },
  {
    key: '90x150',
    widthCm: 90,
    heightCm: 150,
    synthetic: 4750,
    cotton: 6670,
    wholesaleSynthetic: 2850,
    wholesaleCotton: 4110,
  },
  {
    key: '100x100',
    widthCm: 100,
    heightCm: 100,
    synthetic: 3760,
    cotton: 5210,
    wholesaleSynthetic: 2210,
    wholesaleCotton: 3140,
  },
  {
    key: '100x120',
    widthCm: 100,
    heightCm: 120,
    synthetic: 4300,
    cotton: 6020,
    wholesaleSynthetic: 2560,
    wholesaleCotton: 3680,
  },
  {
    key: '100x140',
    widthCm: 100,
    heightCm: 140,
    synthetic: 4840,
    cotton: 6820,
    wholesaleSynthetic: 2910,
    wholesaleCotton: 4220,
  },
  {
    key: '100x150',
    widthCm: 100,
    heightCm: 150,
    synthetic: 5120,
    cotton: 7230,
    wholesaleSynthetic: 3080,
    wholesaleCotton: 4480,
  },
  {
    key: '100x170',
    widthCm: 100,
    heightCm: 170,
    synthetic: 5650,
    cotton: 8030,
    wholesaleSynthetic: 3430,
    wholesaleCotton: 5020,
  },
  {
    key: '100x180',
    widthCm: 100,
    heightCm: 180,
    synthetic: 5930,
    cotton: 8440,
    wholesaleSynthetic: 3610,
    wholesaleCotton: 5290,
  },
  {
    key: '100x190',
    widthCm: 100,
    heightCm: 190,
    synthetic: 6200,
    cotton: 8840,
    wholesaleSynthetic: 3790,
    wholesaleCotton: 5560,
  },
  {
    key: '100x200',
    widthCm: 100,
    heightCm: 200,
    synthetic: 6470,
    cotton: 9240,
    wholesaleSynthetic: 3970,
    wholesaleCotton: 5830,
  },
];

export function findCanvasProductionPrice(
  key: string,
): CanvasProductionPrice | undefined {
  return CANVAS_PRODUCTION_PRICES.find((p) => p.key === key);
}

/** Ключи всех размеров прайса — выбор в заказе ограничен ими. */
export const CANVAS_SIZE_KEYS: string[] = CANVAS_PRODUCTION_PRICES.map(
  (row) => row.key,
);

/**
 * Есть ли такой размер в прайсе.
 *
 * Размер в позиции заказа — не подпись, а ключ: по нему берутся обе цены,
 * розничная (её платит клиент) и оптовая (её платим мы). Размер «на словах»
 * означает заказ, в котором цена ни с чем не сверяется, а заработок
 * считается от числа, вписанного руками.
 */
export function isListedCanvasSize(key?: string | null): boolean {
  return Boolean(key && findCanvasProductionPrice(key));
}

/** Подпись размера для человека: «20 × 30 см». */
export function canvasSizeLabel(price: CanvasProductionPrice): string {
  return `${price.widthCm} × ${price.heightCm} см`;
}

/**
 * Розница производства по размеру и материалу. 0 — размер неизвестен.
 *
 * Она же — цена для клиента: по рознице производства мы и продаём, и
 * ровно эти числа стоят в витринном прайсе (совпадение синтетики сторожит
 * canvas-client-price.spec.ts). Поэтому «розница минус опт» и есть
 * заработок на полотне, и оба числа берутся из одной таблицы — разъехаться
 * им негде.
 */
export function canvasRetailPrice(
  key: string,
  material: CanvasMaterialKind,
): number {
  const row = findCanvasProductionPrice(key);
  if (!row) return 0;
  return material === 'COTTON' ? row.cotton : row.synthetic;
}

/** Оптовая цена по размеру и материалу. 0 — размер неизвестен. */
export function canvasWholesalePrice(
  key: string,
  material: CanvasMaterialKind,
): number {
  const row = findCanvasProductionPrice(key);
  if (!row) return 0;
  return material === 'COTTON' ? row.wholesaleCotton : row.wholesaleSynthetic;
}

/**
 * Сколько мы должны производству за один холст — оптовая цена прайса.
 *
 * Ничего не вычитаем и не округляем: опт приходит готовым числом в рублях.
 * Прежний вычет 20% из розницы отменён вместе с договорённостью, по
 * которой он считался (см. заголовок файла). 0 — размера нет в прайсе:
 * себестоимость такой позиции вводят руками.
 */
export function canvasContractorCost(
  key: string,
  material: CanvasMaterialKind,
): number {
  return canvasWholesalePrice(key, material);
}

/**
 * Что записать в позицию заказа по выбору «размер + материал».
 *
 * Размер из прайса — цену производства система ставит сама, чтобы её нельзя
 * было проставить с ошибкой и незаметно уйти в минус. Цена клиенту сюда не
 * относится: её владелец называет свободно, и трогать её расчёт не должен.
 *
 * Нестандартный размер (в прайсе такого нет) остаётся возможным: тогда
 * подпись и цену производства вводят руками, как раньше.
 */
export interface CanvasPositionPricing {
  formatCanvas: string;
  sizeKey: string | null;
  material: CanvasMaterialKind | null;
  contractorPrice: number;
}

export function resolveCanvasPosition(input: {
  sizeKey?: string;
  material?: CanvasMaterialKind;
  formatCanvas?: string;
  contractorPrice?: number;
}): CanvasPositionPricing {
  const row = input.sizeKey
    ? findCanvasProductionPrice(input.sizeKey)
    : undefined;
  if (!row) {
    // Ручной ввод: подпись и цена производства — как их задали.
    return {
      formatCanvas: (input.formatCanvas ?? '').trim() || 'Нестандартный размер',
      sizeKey: null,
      material: null,
      contractorPrice: Math.max(0, Math.round(input.contractorPrice ?? 0)),
    };
  }

  const material: CanvasMaterialKind = input.material ?? 'SYNTHETIC';
  return {
    formatCanvas: `${canvasSizeLabel(row)}, ${CANVAS_MATERIAL_KIND_LABELS[material].toLowerCase()}`,
    sizeKey: row.key,
    material,
    contractorPrice: canvasContractorCost(row.key, material),
  };
}
