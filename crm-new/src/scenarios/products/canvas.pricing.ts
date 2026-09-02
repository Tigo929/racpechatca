/**
 * Прайс на печать по холсту — единственный источник цены.
 *
 * Правило из ТЗ (блок 11): цена не дублируется. Отсюда её берут и сценарий
 * оформления в CRM, и — позже — калькулятор на сайте. Если понадобится
 * поменять цену, меняется только этот файл.
 *
 * Холст продаётся поштучно: тиражной сетки, как у фотопечати, здесь нет.
 *
 * Цены — розничный прайс-лист РАСПЕЧАТКИ (синтетика, подрамник 2 см),
 * получен от заказчика 02.09.2026. Прежние цифры были заглушками по
 * рыночному коридору и оказались втрое выше реальных.
 *
 * `contractorCost` = 0: прайс подрядчика не согласован. Пока он нулевой,
 * отчёт по марже показывает прибыль 100% — это неверно, заполнить.
 */

export interface CanvasSize {
  /** Ключ размера: значение в сценарии и в ItemCanvas.format. Не менять после запуска. */
  key: string;
  label: string;
  widthCm: number;
  heightCm: number;
  /** Цена за холст: матовая основа, без багета, ₽. */
  price: number;
  /** Себестоимость одного холста у подрядчика, ₽. */
  contractorCost: number;
  /**
   * Минимальное разрешение файла для этого размера, пикселей.
   * Считано под 150 dpi — рабочая плотность для холста: его смотрят с
   * расстояния, и требовать 300 dpi значит отсечь половину телефонных снимков.
   */
  minPixels: { width: number; height: number };
}

/**
 * Размеры и цены — розничный прайс РАСПЕЧАТКИ.
 *
 * Материал один: синтетический холст (сатин) на подрамнике 2 см.
 * Хлопок и подрамник 3,5 см в прайсе есть, но на сайт не выводятся:
 * два материала и две толщины дают четыре цены на один размер, и
 * человек начинает выбирать вместо того, чтобы заказывать.
 * Понадобятся — добавляются сюда же, вторым полем цены.
 *
 * Размер записан как в прайсе: меньшая сторона первой. Цена от
 * поворота не зависит — ориентацию задаёт фотография, а не заказ.
 */
export const CANVAS_SIZES: CanvasSize[] = [
  {
    key: '20x30',
    label: '20×30 см',
    widthCm: 20,
    heightCm: 30,
    price: 630,
    contractorCost: 0,
    minPixels: { width: 1181, height: 1772 },
  },
  {
    key: '20x40',
    label: '20×40 см',
    widthCm: 20,
    heightCm: 40,
    price: 770,
    contractorCost: 0,
    minPixels: { width: 1181, height: 2362 },
  },
  {
    key: '30x30',
    label: '30×30 см',
    widthCm: 30,
    heightCm: 30,
    price: 790,
    contractorCost: 0,
    minPixels: { width: 1772, height: 1772 },
  },
  {
    key: '30x40',
    label: '30×40 см',
    widthCm: 30,
    heightCm: 40,
    price: 940,
    contractorCost: 0,
    minPixels: { width: 1772, height: 2362 },
  },
  {
    key: '30x50',
    label: '30×50 см',
    widthCm: 30,
    heightCm: 50,
    price: 1090,
    contractorCost: 0,
    minPixels: { width: 1772, height: 2953 },
  },
  {
    key: '30x60',
    label: '30×60 см',
    widthCm: 30,
    heightCm: 60,
    price: 1240,
    contractorCost: 0,
    minPixels: { width: 1772, height: 3543 },
  },
  {
    key: '40x40',
    label: '40×40 см',
    widthCm: 40,
    heightCm: 40,
    price: 1110,
    contractorCost: 0,
    minPixels: { width: 2362, height: 2362 },
  },
  {
    key: '40x50',
    label: '40×50 см',
    widthCm: 40,
    heightCm: 50,
    price: 1270,
    contractorCost: 0,
    minPixels: { width: 2362, height: 2953 },
  },
  {
    key: '40x60',
    label: '40×60 см',
    widthCm: 40,
    heightCm: 60,
    price: 1450,
    contractorCost: 0,
    minPixels: { width: 2362, height: 3543 },
  },
  {
    key: '40x70',
    label: '40×70 см',
    widthCm: 40,
    heightCm: 70,
    price: 1610,
    contractorCost: 0,
    minPixels: { width: 2362, height: 4134 },
  },
  {
    key: '40x80',
    label: '40×80 см',
    widthCm: 40,
    heightCm: 80,
    price: 1780,
    contractorCost: 0,
    minPixels: { width: 2362, height: 4724 },
  },
  {
    key: '50x50',
    label: '50×50 см',
    widthCm: 50,
    heightCm: 50,
    price: 1470,
    contractorCost: 0,
    minPixels: { width: 2953, height: 2953 },
  },
  {
    key: '50x60',
    label: '50×60 см',
    widthCm: 50,
    heightCm: 60,
    price: 1650,
    contractorCost: 0,
    minPixels: { width: 2953, height: 3543 },
  },
  {
    key: '50x70',
    label: '50×70 см',
    widthCm: 50,
    heightCm: 70,
    price: 1830,
    contractorCost: 0,
    minPixels: { width: 2953, height: 4134 },
  },
  {
    key: '50x80',
    label: '50×80 см',
    widthCm: 50,
    heightCm: 80,
    price: 2030,
    contractorCost: 0,
    minPixels: { width: 2953, height: 4724 },
  },
  {
    key: '50x90',
    label: '50×90 см',
    widthCm: 50,
    heightCm: 90,
    price: 2210,
    contractorCost: 0,
    minPixels: { width: 2953, height: 5315 },
  },
  {
    key: '60x60',
    label: '60×60 см',
    widthCm: 60,
    heightCm: 60,
    price: 1850,
    contractorCost: 0,
    minPixels: { width: 3543, height: 3543 },
  },
  {
    key: '60x70',
    label: '60×70 см',
    widthCm: 60,
    heightCm: 70,
    price: 2060,
    contractorCost: 0,
    minPixels: { width: 3543, height: 4134 },
  },
  {
    key: '60x80',
    label: '60×80 см',
    widthCm: 60,
    heightCm: 80,
    price: 2260,
    contractorCost: 0,
    minPixels: { width: 3543, height: 4724 },
  },
  {
    key: '60x90',
    label: '60×90 см',
    widthCm: 60,
    heightCm: 90,
    price: 2460,
    contractorCost: 0,
    minPixels: { width: 3543, height: 5315 },
  },
  {
    key: '60x100',
    label: '60×100 см',
    widthCm: 60,
    heightCm: 100,
    price: 2670,
    contractorCost: 0,
    minPixels: { width: 3543, height: 5906 },
  },
  {
    key: '60x120',
    label: '60×120 см',
    widthCm: 60,
    heightCm: 120,
    price: 3070,
    contractorCost: 0,
    minPixels: { width: 3543, height: 7087 },
  },
  {
    key: '60x150',
    label: '60×150 см',
    widthCm: 60,
    heightCm: 150,
    price: 3680,
    contractorCost: 0,
    minPixels: { width: 3543, height: 8858 },
  },
  {
    key: '70x70',
    label: '70×70 см',
    widthCm: 70,
    heightCm: 70,
    price: 2280,
    contractorCost: 0,
    minPixels: { width: 4134, height: 4134 },
  },
  {
    key: '70x80',
    label: '70×80 см',
    widthCm: 70,
    heightCm: 80,
    price: 2500,
    contractorCost: 0,
    minPixels: { width: 4134, height: 4724 },
  },
  {
    key: '70x90',
    label: '70×90 см',
    widthCm: 70,
    heightCm: 90,
    price: 2720,
    contractorCost: 0,
    minPixels: { width: 4134, height: 5315 },
  },
  {
    key: '70x100',
    label: '70×100 см',
    widthCm: 70,
    heightCm: 100,
    price: 2940,
    contractorCost: 0,
    minPixels: { width: 4134, height: 5906 },
  },
  {
    key: '70x120',
    label: '70×120 см',
    widthCm: 70,
    heightCm: 120,
    price: 3380,
    contractorCost: 0,
    minPixels: { width: 4134, height: 7087 },
  },
  {
    key: '70x150',
    label: '70×150 см',
    widthCm: 70,
    heightCm: 150,
    price: 4050,
    contractorCost: 0,
    minPixels: { width: 4134, height: 8858 },
  },
  {
    key: '80x80',
    label: '80×80 см',
    widthCm: 80,
    heightCm: 80,
    price: 2740,
    contractorCost: 0,
    minPixels: { width: 4724, height: 4724 },
  },
  {
    key: '80x90',
    label: '80×90 см',
    widthCm: 80,
    heightCm: 90,
    price: 2970,
    contractorCost: 0,
    minPixels: { width: 4724, height: 5315 },
  },
  {
    key: '80x100',
    label: '80×100 см',
    widthCm: 80,
    heightCm: 100,
    price: 3110,
    contractorCost: 0,
    minPixels: { width: 4724, height: 5906 },
  },
  {
    key: '80x120',
    label: '80×120 см',
    widthCm: 80,
    heightCm: 120,
    price: 3690,
    contractorCost: 0,
    minPixels: { width: 4724, height: 7087 },
  },
  {
    key: '80x150',
    label: '80×150 см',
    widthCm: 80,
    heightCm: 150,
    price: 4400,
    contractorCost: 0,
    minPixels: { width: 4724, height: 8858 },
  },
  {
    key: '90x90',
    label: '90×90 см',
    widthCm: 90,
    heightCm: 90,
    price: 3230,
    contractorCost: 0,
    minPixels: { width: 5315, height: 5315 },
  },
  {
    key: '90x100',
    label: '90×100 см',
    widthCm: 90,
    heightCm: 100,
    price: 3490,
    contractorCost: 0,
    minPixels: { width: 5315, height: 5906 },
  },
  {
    key: '90x120',
    label: '90×120 см',
    widthCm: 90,
    heightCm: 120,
    price: 3990,
    contractorCost: 0,
    minPixels: { width: 5315, height: 7087 },
  },
  {
    key: '90x150',
    label: '90×150 см',
    widthCm: 90,
    heightCm: 150,
    price: 4750,
    contractorCost: 0,
    minPixels: { width: 5315, height: 8858 },
  },
  {
    key: '100x100',
    label: '100×100 см',
    widthCm: 100,
    heightCm: 100,
    price: 3760,
    contractorCost: 0,
    minPixels: { width: 5906, height: 5906 },
  },
  {
    key: '100x120',
    label: '100×120 см',
    widthCm: 100,
    heightCm: 120,
    price: 4300,
    contractorCost: 0,
    minPixels: { width: 5906, height: 7087 },
  },
  {
    key: '100x140',
    label: '100×140 см',
    widthCm: 100,
    heightCm: 140,
    price: 4840,
    contractorCost: 0,
    minPixels: { width: 5906, height: 8268 },
  },
  {
    key: '100x150',
    label: '100×150 см',
    widthCm: 100,
    heightCm: 150,
    price: 5120,
    contractorCost: 0,
    minPixels: { width: 5906, height: 8858 },
  },
  {
    key: '100x170',
    label: '100×170 см',
    widthCm: 100,
    heightCm: 170,
    price: 5650,
    contractorCost: 0,
    minPixels: { width: 5906, height: 10039 },
  },
  {
    key: '100x180',
    label: '100×180 см',
    widthCm: 100,
    heightCm: 180,
    price: 5930,
    contractorCost: 0,
    minPixels: { width: 5906, height: 10630 },
  },
  {
    key: '100x190',
    label: '100×190 см',
    widthCm: 100,
    heightCm: 190,
    price: 6200,
    contractorCost: 0,
    minPixels: { width: 5906, height: 11220 },
  },
  {
    key: '100x200',
    label: '100×200 см',
    widthCm: 100,
    heightCm: 200,
    price: 6470,
    contractorCost: 0,
    minPixels: { width: 5906, height: 11811 },
  },
];

/** Глянцевая основа дороже матовой (приём MDMprint, +15%). */
export const GLOSS_SURCHARGE_RATE = 0.15;

/** Багет — фиксированная надбавка независимо от цвета (приём Netprint). */
export const FRAME_PRICE = 1500;

/** Срочное изготовление удваивает стоимость работы (приём Копирки, +100%). */
export const URGENT_SURCHARGE_RATE = 1;

export type CanvasMaterial = 'MATTE' | 'GLOSS';
export type CanvasFrame = 'NONE' | 'BLACK' | 'WHITE' | 'WOOD' | 'GOLD';

export const CANVAS_FRAME_LABELS: Record<CanvasFrame, string> = {
  NONE: 'без багета',
  BLACK: 'чёрный багет',
  WHITE: 'белый багет',
  WOOD: 'багет под дерево',
  GOLD: 'золотой багет',
};

export const CANVAS_MATERIAL_LABELS: Record<CanvasMaterial, string> = {
  MATTE: 'матовый',
  GLOSS: 'глянцевый',
};

export function findCanvasSize(key: string): CanvasSize | undefined {
  return CANVAS_SIZES.find((size) => size.key === key);
}

/** Цены округляем до десятков: в чеке не должно быть «3438,5 ₽». */
function roundPrice(value: number): number {
  return Math.round(value / 10) * 10;
}

/**
 * Цена одного холста со всеми опциями.
 * Неизвестный размер даёт 0 — вызывающий код обязан это заметить, а не
 * продать холст по случайной цене.
 */
export function calcCanvasUnitPrice(params: {
  sizeKey: string;
  material: CanvasMaterial;
  frame: CanvasFrame;
}): number {
  const size = findCanvasSize(params.sizeKey);
  if (!size) return 0;

  const base =
    params.material === 'GLOSS'
      ? size.price * (1 + GLOSS_SURCHARGE_RATE)
      : size.price;

  return roundPrice(base) + (params.frame === 'NONE' ? 0 : FRAME_PRICE);
}

/**
 * Надбавка за срочность — считается от стоимости позиции целиком и живёт
 * на заказе (поле urgencyFee), а не внутри цены холста: так в чеке видно,
 * за что именно доплата, и её можно снять, не пересчитывая позицию.
 */
export function calcCanvasUrgencyFee(positionTotal: number): number {
  return roundPrice(positionTotal * URGENT_SURCHARGE_RATE);
}
