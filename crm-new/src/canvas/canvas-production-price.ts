/**
 * Прайс производства на печать по холсту — основа себестоимости.
 *
 * Это НЕ витрина. Цены для клиента живут в canvas.pricing.ts и меняются
 * отдельно: производство даёт свою розницу, от неё считается только то,
 * сколько мы должны ему, а клиенту называется любая цена.
 *
 * Цифры сняты с присланного производством прайс-листа (PDF от 20.08.2026),
 * колонка «Подрамник 2 см» — единственная, по которой мы работаем. Колонки
 * 3,5 см и прочие в расчёт не берём: их не заказываем.
 *
 * Проверка на живом примере от владельца: 20×30 синтетика, подрамник 2 см —
 * 630 ₽ розницы производства, со скидкой 20% мы должны 504 ₽.
 *
 * Скоро производство даст оптовые цены. Метод останется тем же — поменяются
 * только числа в таблице ниже, поэтому она отделена от математики.
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
}

/** Розничный прайс производства: 46 размеров, подрамник 2 см. */
export const CANVAS_PRODUCTION_PRICES: CanvasProductionPrice[] = [
  { key: '20x30', widthCm: 20, heightCm: 30, synthetic: 630, cotton: 780 },
  { key: '20x40', widthCm: 20, heightCm: 40, synthetic: 770, cotton: 950 },
  { key: '30x30', widthCm: 30, heightCm: 30, synthetic: 790, cotton: 980 },
  { key: '30x40', widthCm: 30, heightCm: 40, synthetic: 940, cotton: 1180 },
  { key: '30x50', widthCm: 30, heightCm: 50, synthetic: 1090, cotton: 1380 },
  { key: '30x60', widthCm: 30, heightCm: 60, synthetic: 1240, cotton: 1570 },
  { key: '40x40', widthCm: 40, heightCm: 40, synthetic: 1110, cotton: 1410 },
  { key: '40x50', widthCm: 40, heightCm: 50, synthetic: 1270, cotton: 1630 },
  { key: '40x60', widthCm: 40, heightCm: 60, synthetic: 1450, cotton: 1870 },
  { key: '40x70', widthCm: 40, heightCm: 70, synthetic: 1610, cotton: 2090 },
  { key: '40x80', widthCm: 40, heightCm: 80, synthetic: 1780, cotton: 2320 },
  { key: '50x50', widthCm: 50, heightCm: 50, synthetic: 1470, cotton: 1900 },
  { key: '50x60', widthCm: 50, heightCm: 60, synthetic: 1650, cotton: 2150 },
  { key: '50x70', widthCm: 50, heightCm: 70, synthetic: 1830, cotton: 2410 },
  { key: '50x80', widthCm: 50, heightCm: 80, synthetic: 2030, cotton: 2680 },
  { key: '50x90', widthCm: 50, heightCm: 90, synthetic: 2210, cotton: 2930 },
  { key: '60x60', widthCm: 60, heightCm: 60, synthetic: 1850, cotton: 2440 },
  { key: '60x70', widthCm: 60, heightCm: 70, synthetic: 2060, cotton: 2730 },
  { key: '60x80', widthCm: 60, heightCm: 80, synthetic: 2260, cotton: 3010 },
  { key: '60x90', widthCm: 60, heightCm: 90, synthetic: 2460, cotton: 3300 },
  { key: '60x100', widthCm: 60, heightCm: 100, synthetic: 2670, cotton: 3600 },
  { key: '60x120', widthCm: 60, heightCm: 120, synthetic: 3070, cotton: 4160 },
  { key: '60x150', widthCm: 60, heightCm: 150, synthetic: 3680, cotton: 5020 },
  { key: '70x70', widthCm: 70, heightCm: 70, synthetic: 2280, cotton: 3040 },
  { key: '70x80', widthCm: 70, heightCm: 80, synthetic: 2500, cotton: 3360 },
  { key: '70x90', widthCm: 70, heightCm: 90, synthetic: 2720, cotton: 3680 },
  { key: '70x100', widthCm: 70, heightCm: 100, synthetic: 2940, cotton: 4000 },
  { key: '70x120', widthCm: 70, heightCm: 120, synthetic: 3380, cotton: 4630 },
  { key: '70x150', widthCm: 70, heightCm: 150, synthetic: 4050, cotton: 5580 },
  { key: '80x80', widthCm: 80, heightCm: 80, synthetic: 2740, cotton: 3710 },
  { key: '80x90', widthCm: 80, heightCm: 90, synthetic: 2970, cotton: 4050 },
  { key: '80x100', widthCm: 80, heightCm: 100, synthetic: 3110, cotton: 4400 },
  { key: '80x120', widthCm: 80, heightCm: 120, synthetic: 3690, cotton: 5090 },
  { key: '80x150', widthCm: 80, heightCm: 150, synthetic: 4400, cotton: 6130 },
  { key: '90x90', widthCm: 90, heightCm: 90, synthetic: 3230, cotton: 4430 },
  { key: '90x100', widthCm: 90, heightCm: 100, synthetic: 3490, cotton: 4810 },
  { key: '90x120', widthCm: 90, heightCm: 120, synthetic: 3990, cotton: 5550 },
  { key: '90x150', widthCm: 90, heightCm: 150, synthetic: 4750, cotton: 6670 },
  { key: '100x100', widthCm: 100, heightCm: 100, synthetic: 3760, cotton: 5210 },
  { key: '100x120', widthCm: 100, heightCm: 120, synthetic: 4300, cotton: 6020 },
  { key: '100x140', widthCm: 100, heightCm: 140, synthetic: 4840, cotton: 6820 },
  { key: '100x150', widthCm: 100, heightCm: 150, synthetic: 5120, cotton: 7230 },
  { key: '100x170', widthCm: 100, heightCm: 170, synthetic: 5650, cotton: 8030 },
  { key: '100x180', widthCm: 100, heightCm: 180, synthetic: 5930, cotton: 8440 },
  { key: '100x190', widthCm: 100, heightCm: 190, synthetic: 6200, cotton: 8840 },
  { key: '100x200', widthCm: 100, heightCm: 200, synthetic: 6470, cotton: 9240 },
];

export function findCanvasProductionPrice(
  key: string,
): CanvasProductionPrice | undefined {
  return CANVAS_PRODUCTION_PRICES.find((p) => p.key === key);
}

/** Подпись размера для человека: «20 × 30 см». */
export function canvasSizeLabel(price: CanvasProductionPrice): string {
  return `${price.widthCm} × ${price.heightCm} см`;
}

/** Розница производства по размеру и материалу. 0 — размер неизвестен. */
export function canvasRetailPrice(
  key: string,
  material: CanvasMaterialKind,
): number {
  const row = findCanvasProductionPrice(key);
  if (!row) return 0;
  return material === 'COTTON' ? row.cotton : row.synthetic;
}

/**
 * Сколько мы должны производству за один холст.
 *
 * Скидка — в сотых процента, как ставка партнёра в остальном проекте:
 * 2000 = 20%. Округляем вниз до рубля: копейки в счёте производства не
 * фигурируют, а округление вверх означало бы переплату на каждой позиции.
 */
export function canvasContractorCost(
  key: string,
  material: CanvasMaterialKind,
  discountBasisPoints: number,
): number {
  const retail = canvasRetailPrice(key, material);
  if (!retail) return 0;
  const kept = Math.max(0, 10000 - discountBasisPoints);
  return Math.floor((retail * kept) / 10000);
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

export function resolveCanvasPosition(
  input: {
    sizeKey?: string;
    material?: CanvasMaterialKind;
    formatCanvas?: string;
    contractorPrice?: number;
  },
  discountBasisPoints: number,
): CanvasPositionPricing {
  const row = input.sizeKey ? findCanvasProductionPrice(input.sizeKey) : undefined;
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
    contractorPrice: canvasContractorCost(row.key, material, discountBasisPoints),
  };
}
