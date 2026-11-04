import {
  canvasPositionMoney,
  normalizeAddons,
  type CanvasAddons,
} from './canvas-addons';
import { FRAME_PRICE } from '../scenarios/products/canvas.pricing';
import { resolveCanvasPosition } from 'src/canvas/canvas-production-price';

/**
 * Позиция холста из заявки с сайта — с ценой производства, а не с нулём.
 *
 * Раньше себестоимость бралась из витринного прайса, где поля `contractorCost`
 * стояли нулями: заявка с сайта заводилась с долгом производству 0 ₽ и
 * прибылью 100%. В карточке заказа «должен производству» показывало ноль,
 * расход на подрядчика не создавался вовсе (его создают только при
 * себестоимости больше нуля), и в финансовом отчёте холст выглядел
 * товаром без себестоимости. Понять по такому заказу, заработали мы на нём
 * или отдали больше, чем взяли, было нельзя.
 *
 * Теперь долг считается по прайсу производства — тому же, по которому
 * считается позиция, заведённая в CRM руками: один размер, одна цена,
 * один источник. Размер и материал пишутся в позицию ключами, поэтому
 * менеджер правит размер выбором из списка, и цена едет следом.
 *
 * Материал всегда синтетика: хлопок сайт не продаёт. Матовая или глянцевая
 * основа на наш долг не влияет (прайс производства — одна колонка на
 * материал), а клиенту глянец дороже на свою надбавку, и она уже сидит
 * в цене, которую сайт назвал человеку.
 */

/** Что сайт сообщил о холсте и сколько назвал клиенту. */
export interface LeadCanvasInput {
  sizeKey?: string | null;
  /** Подпись размера с сайта — пригодится, если размера нет в прайсе. */
  sizeLabel?: string | null;
  /** Название товара — последний запас на подпись позиции. */
  productName?: string | null;
  /** Багет из конструктора: 'NONE' или код багета. */
  frame?: string | null;
  quantity: number;
  /** Цена за штуку, которую сайт назвал клиенту, ₽. */
  unitPrice: number;
}

export interface LeadCanvasItem extends CanvasAddons {
  formatCanvas: string;
  sizeKey: string | null;
  material: 'SYNTHETIC' | 'COTTON' | null;
  quantity: number;
  clientPrice: number;
  contractorPrice: number;
  pricePosition: number;
  contractorCostPosition: number;
  profitPosition: number;
}

export function leadCanvasPosition(input: LeadCanvasInput): LeadCanvasItem {
  const priced = resolveCanvasPosition({
    sizeKey: input.sizeKey?.trim() || undefined,
    material: 'SYNTHETIC',
    // Размера нет в прайсе — подпись берём с сайта: «Холст с сайта»
    // в карточке не говорит менеджеру ничего.
    formatCanvas:
      input.sizeLabel?.trim() ||
      input.sizeKey?.trim() ||
      input.productName?.trim() ||
      'Холст с сайта',
  });

  /*
   * Багет вынимаем из цены холста в свой доп.
   *
   * Сайт складывает полотно и багет в одну цену. Если оставить её как
   * есть, в заказе будет холст 20×30 за 2130 ₽ при прайсе 630 — цифра,
   * которую не с чем сверить, и расхождение с прайсом выглядит как
   * ошибка. Разложенная позиция показывает и полотно, и багет отдельно,
   * а себестоимость багета владелец вписывает руками: производство
   * прислало прайс на холсты, цены багета в нём нет.
   *
   * Итог клиенту при этом не меняется: сумма допа и цены полотна — та же
   * цена, которую человеку назвали на сайте.
   */
  const withFrame = Boolean(input.frame && input.frame !== 'NONE');
  const splitFrame = withFrame && input.unitPrice > FRAME_PRICE;
  const frameClientPrice = splitFrame ? FRAME_PRICE : 0;
  const addons = normalizeAddons({
    frame: withFrame,
    frameClientPrice,
    frameContractorPrice: 0,
  });

  const quantity = Math.max(1, Math.round(input.quantity) || 1);
  const clientPrice = Math.max(
    0,
    Math.round(input.unitPrice) - frameClientPrice,
  );

  return {
    formatCanvas: priced.formatCanvas,
    sizeKey: priced.sizeKey,
    material: priced.material,
    quantity,
    clientPrice,
    contractorPrice: priced.contractorPrice,
    ...addons,
    ...canvasPositionMoney({
      quantity,
      clientPrice,
      contractorPrice: priced.contractorPrice,
      addons,
    }),
  };
}
