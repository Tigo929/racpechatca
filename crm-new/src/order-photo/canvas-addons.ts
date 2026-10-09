/**
 * Допы к холсту: лак и багет.
 *
 * Холст заказывают по-разному: только полотно, полотно с лаком, полотно
 * в багете, или всё сразу. Раньше допы вписывали в цену холста одной
 * суммой — и тогда в заказе не видно, за что клиент заплатил, а в отчёте
 * себестоимость допа смешивалась с себестоимостью полотна.
 *
 * У каждого допа две цены: сколько берёт поставщик и сколько назвали
 * клиенту. Разница — такой же заработок, как на самом холсте, и считать
 * его нужно отдельно, иначе маржа по заказу врёт.
 *
 * Флаг хранится отдельно от цены: доп бывает и бесплатным — подарок или
 * компенсация за задержку. «Ноль» в цене не значит «допа нет», он значит
 * «денег не взяли», а печатать лак всё равно надо.
 */

export interface CanvasAddons {
  varnish: boolean;
  varnishClientPrice: number;
  varnishContractorPrice: number;
  frame: boolean;
  frameClientPrice: number;
  frameContractorPrice: number;
}

export const NO_ADDONS: CanvasAddons = {
  varnish: false,
  varnishClientPrice: 0,
  varnishContractorPrice: 0,
  frame: false,
  frameClientPrice: 0,
  frameContractorPrice: 0,
};

const nonNegative = (value: number | null | undefined): number =>
  Math.max(0, Math.round(Number(value) || 0));

/**
 * Привести допы к хранимому виду.
 *
 * Выключенный доп обнуляет свои цены. Иначе снятая галочка оставляла бы
 * в строке сумму, которая не видна в интерфейсе, но продолжала бы считаться
 * в выручке и себестоимости.
 */
export function normalizeAddons(input: Partial<CanvasAddons>): CanvasAddons {
  const varnish = Boolean(input.varnish);
  const frame = Boolean(input.frame);
  return {
    varnish,
    varnishClientPrice: varnish ? nonNegative(input.varnishClientPrice) : 0,
    varnishContractorPrice: varnish
      ? nonNegative(input.varnishContractorPrice)
      : 0,
    frame,
    frameClientPrice: frame ? nonNegative(input.frameClientPrice) : 0,
    frameContractorPrice: frame ? nonNegative(input.frameContractorPrice) : 0,
  };
}

/** Надбавка к цене клиенту за одну штуку. */
export function addonsClientPrice(addons: CanvasAddons): number {
  return addons.varnishClientPrice + addons.frameClientPrice;
}

/** Надбавка к себестоимости за одну штуку. */
export function addonsContractorPrice(addons: CanvasAddons): number {
  return addons.varnishContractorPrice + addons.frameContractorPrice;
}

/**
 * Деньги по строке холста с учётом допов.
 *
 * Допы считаются за штуку, как и сам холст: заказали два холста в багете —
 * багетов тоже два.
 */
export function canvasPositionMoney(args: {
  quantity: number;
  clientPrice: number;
  contractorPrice: number;
  addons: CanvasAddons;
}): {
  pricePosition: number;
  contractorCostPosition: number;
  profitPosition: number;
} {
  const quantity = Math.max(1, Math.round(args.quantity) || 1);
  const pricePosition =
    (args.clientPrice + addonsClientPrice(args.addons)) * quantity;
  const contractorCostPosition =
    (args.contractorPrice + addonsContractorPrice(args.addons)) * quantity;
  return {
    pricePosition,
    contractorCostPosition,
    profitPosition: pricePosition - contractorCostPosition,
  };
}

/** Названия допов — для подписей в заказе и в задании производству. */
export const ADDON_LABELS = { varnish: 'лак', frame: 'багет' } as const;

/** «лак, багет» — чем дополнен холст. Пусто, если допов нет. */
export function addonsSummary(addons: CanvasAddons): string {
  const parts: string[] = [];
  if (addons.varnish) parts.push(ADDON_LABELS.varnish);
  if (addons.frame) parts.push(ADDON_LABELS.frame);
  return parts.join(', ');
}
