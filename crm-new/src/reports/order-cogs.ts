import {
  photoMaterialCostKopecks,
  sheetCostKopecks,
} from 'src/order-photo/photo-material';
import { settleOrder } from 'src/partner/partner-settlement';
import { settlementPositions } from 'src/partner/settlement-positions';

/**
 * Себестоимость одного заказа — та же математика, что в P&L-отчёте.
 *
 * Вынесена из `addOrder` отчёта (reports.service.ts), потому что теперь
 * себестоимость нужна ещё и Метрике: в заказ из CRM уходит `cost`, и число
 * там обязано совпадать с отчётом владельца — иначе прибыль в Метрике и
 * прибыль в CRM разойдутся, а какую из них считать правдой, никто не скажет.
 * Отчёт вызывает эту же функцию, так что второй формулы не существует;
 * равенство держат тесты (order-cogs.spec.ts).
 *
 * Правила — из шапки reports.service.ts: бумага по формату (photo-material),
 * футболки — вознаграждение партнёру (материалы + его доля маржи), холсты —
 * цена подрядчика. Зарплата и доставка сюда не входят: в отчёте они тоже не
 * в себестоимости, а отдельными строками.
 */

/** Цены, по которым считается себестоимость. Живут в настройках партнёра. */
export interface CostSettings {
  sheetCostKopecks: number;
  deliveryCostYandexPvz: number;
  deliveryCostOzonPvz: number;
  /** Своя доставка производства холстов по Москве: сколько платим мы. */
  canvasDeliveryCost: number;
  partnerRateBasisPoints: number;
}

/** Строка PartnerSettings — только то, что нужно для цен. */
export interface CostSettingsSource {
  photoBoxCost?: number | null;
  photoSheetsPerBox?: number | null;
  deliveryCostYandexPvz?: number | null;
  deliveryCostOzonPvz?: number | null;
  canvasDeliveryCost?: number | null;
  partnerRateBasisPoints?: number | null;
}

/** Настройки себестоимости; строки нет — значения по умолчанию, как в отчёте. */
export function costSettingsFrom(s: CostSettingsSource | null): CostSettings {
  return {
    sheetCostKopecks: sheetCostKopecks(
      s?.photoBoxCost ?? 800,
      s?.photoSheetsPerBox ?? 500,
    ),
    deliveryCostYandexPvz: s?.deliveryCostYandexPvz ?? 99,
    canvasDeliveryCost: s?.canvasDeliveryCost ?? 700,
    deliveryCostOzonPvz: s?.deliveryCostOzonPvz ?? 140,
    partnerRateBasisPoints: s?.partnerRateBasisPoints ?? 3000,
  };
}

/** Позиции заказа, из которых складывается себестоимость. */
export interface OrderCogsSource {
  productCategory: string;
  items: {
    formatPaper: string;
    quantity: number;
    pricePosition: number;
    printOnClientItem: boolean;
    thermalCost: number;
  }[];
  tshirtItems: {
    pricePosition: number;
    quantity: number;
    designCost: number;
    thermalCost: number;
    blankCost: number;
    clientItem: boolean;
  }[];
  canvasItems: { contractorCostPosition: number }[];
}

export interface OrderCogs {
  /** Себестоимость в рублях — ровно то, что отчёт вычитает из выручки заказа. */
  rub: number;
  /**
   * Бумага в копейках до округления. Отчёт копит именно копейки и округляет
   * итог периода один раз; по заказу округление вверх — как в прибыли по фото.
   */
  photoMaterialKopecks: number;
  /** Вознаграждение партнёру по футболкам (материалы + доля маржи). */
  tshirtContractorCost: number;
  /** Цена подрядчика по холстам. */
  canvasContractorCost: number;
  /**
   * Можно ли на это число полагаться. Нет — если категория не из трёх
   * известных или в заказе нет ни одной позиции: тогда «0» — не себестоимость,
   * а отсутствие данных, и наружу (в Метрику) его отдавать нельзя.
   */
  reliable: boolean;
}

export function orderCostOfGoods(
  order: OrderCogsSource,
  s: CostSettings,
): OrderCogs {
  const base: OrderCogs = {
    rub: 0,
    photoMaterialKopecks: 0,
    tshirtContractorCost: 0,
    canvasContractorCost: 0,
    reliable: false,
  };

  if (order.productCategory === 'PHOTO') {
    const kopecks = photoMaterialCostKopecks(order.items, s.sheetCostKopecks);
    return {
      ...base,
      rub: Math.ceil(kopecks / 100),
      photoMaterialKopecks: kopecks,
      reliable: order.items.length > 0,
    };
  }
  if (order.productCategory === 'TSHIRT') {
    // Партнёру уходит стоимость материалов плюс его доля от маржи.
    const positions = settlementPositions(order);
    const reward = settleOrder(positions, s.partnerRateBasisPoints).reward;
    return {
      ...base,
      rub: reward,
      tshirtContractorCost: reward,
      reliable: positions.length > 0,
    };
  }
  if (order.productCategory === 'CANVAS') {
    const contractor = order.canvasItems.reduce(
      (sum, i) => sum + i.contractorCostPosition,
      0,
    );
    return {
      ...base,
      rub: contractor,
      canvasContractorCost: contractor,
      reliable: order.canvasItems.length > 0,
    };
  }
  return base;
}
