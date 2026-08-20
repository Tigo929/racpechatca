/**
 * Прайс на печать по холсту — единственный источник цены.
 *
 * Правило из ТЗ (блок 11): цена не дублируется. Отсюда её берут и сценарий
 * оформления в CRM, и — позже — калькулятор на сайте. Если понадобится
 * поменять цену, меняется только этот файл.
 *
 * Холст продаётся поштучно: тиражной сетки, как у фотопечати, здесь нет.
 *
 * ⚠️ ЦИФРЫ НИЖЕ ТРЕБУЮТ ПОДТВЕРЖДЕНИЯ.
 * `price` расставлены по рыночному коридору из ТЗ (блок 6): середина между
 * демпингом Нетпринта и верхом Копирки. `contractorCost` = 0, потому что
 * прайс подрядчика не согласован — пока он нулевой, отчёт по марже покажет
 * прибыль 100%, что неверно. Заполнить до первых продаж.
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

/** Стартовый набор размеров (ТЗ, блок 11: начать с 4–6 ходовых). */
export const CANVAS_SIZES: CanvasSize[] = [
  {
    key: '30x30',
    label: '30×30 см',
    widthCm: 30,
    heightCm: 30,
    price: 2490,
    contractorCost: 0,
    minPixels: { width: 1772, height: 1772 },
  },
  {
    key: '30x40',
    label: '30×40 см',
    widthCm: 30,
    heightCm: 40,
    price: 2990,
    contractorCost: 0,
    minPixels: { width: 1772, height: 2362 },
  },
  {
    key: '40x60',
    label: '40×60 см',
    widthCm: 40,
    heightCm: 60,
    price: 4490,
    contractorCost: 0,
    minPixels: { width: 2362, height: 3543 },
  },
  {
    key: '50x50',
    label: '50×50 см',
    widthCm: 50,
    heightCm: 50,
    price: 4990,
    contractorCost: 0,
    minPixels: { width: 2953, height: 2953 },
  },
  {
    key: '50x70',
    label: '50×70 см',
    widthCm: 50,
    heightCm: 70,
    price: 5990,
    contractorCost: 0,
    minPixels: { width: 2953, height: 4134 },
  },
  {
    key: '60x90',
    label: '60×90 см',
    widthCm: 60,
    heightCm: 90,
    price: 7490,
    contractorCost: 0,
    minPixels: { width: 3543, height: 5315 },
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
