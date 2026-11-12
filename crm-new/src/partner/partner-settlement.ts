/**
 * Расчёт вознаграждения партнёра-исполнителя и прибыли владельца по заказу
 * на футболки. Чистые функции без базы и сети — так их полностью
 * покрывают тесты, а «в подсчётах не ошибиться» становится проверяемым.
 *
 * Режим MARGIN_SHARE — делим маржу (на позицию):
 *   выручка_печати = pricePosition − designCost        (дизайн — работа владельца)
 *   материалы      = (термо + (давальческая ? 0 : футболка)) × количество
 *   маржа          = выручка_печати − материалы
 *   вознаграждение = маржа × ставка + материалы         (партнёру возвращаем материалы)
 *   заработок      = маржа × ставка                      (его чистый доход с нас)
 *   прибыль        = pricePosition − вознаграждение      (у владельца: дизайн + 70% маржи)
 *
 * Дизайн вычитается до дележа и в маржу не входит — партнёр не получает
 * процент с работы владельца. Для давальческой футболки (clientItem) заготовку
 * покупает клиент, поэтому её стоимость не в материалах и не возвращается.
 *
 * Режим REVENUE_SHARE — процент от суммы:
 *   материалы      = 0                                  (с нашей стороны их нет)
 *   заработок      = pricePosition × ставка
 *   вознаграждение = заработок                           (возвращать нечего)
 *
 * Так оплачивается печать термотрансферов: изделия нет, плёнку печатает сам
 * исполнитель, и вычитать из его доли нечего. Отдельным режимом, а не нулевой
 * себестоимостью в прежней формуле: нулевые материалы означали бы «материалы
 * есть, но бесплатные», и любой правкой умолчаний в настройках такая позиция
 * внезапно начала бы считаться по-другому.
 */

export const DEFAULT_PARTNER_RATE_BASIS_POINTS = 3000; // 30%

/** Как считается доля партнёра за позицию. */
export type SettlementMode = 'MARGIN_SHARE' | 'REVENUE_SHARE';

export interface SettlementPosition {
  pricePosition: number;
  designCost: number;
  quantity: number;
  thermalCost: number;
  blankCost: number;
  clientItem: boolean;
  /** По умолчанию доля от маржи — так считались все позиции до появления режимов. */
  mode?: SettlementMode;
  /** Ставка позиции в сотых процента; null/undefined — взять общую. */
  rateBasisPoints?: number | null;
}

export interface PositionSettlement {
  /** Себестоимость материалов, которую возвращаем партнёру. */
  materials: number;
  /** Делимая маржа (после дизайна и материалов). */
  margin: number;
  /** Что владелец платит партнёру: маржа×ставка + материалы. */
  reward: number;
  /** Чистый заработок партнёра с владельца: маржа×ставка. */
  partnerProfit: number;
  /** Прибыль владельца по позиции: pricePosition − reward. */
  ownerProfit: number;
}

export interface OrderSettlement extends PositionSettlement {
  /** Полная сумма футболочных позиций (для сверки). */
  tshirtRevenue: number;
  rateBasisPoints: number;
}

/**
 * Материалы позиции. Термоперенос платим всегда (это работа печати);
 * стоимость футболки — только если заготовку покупаем мы.
 */
export function positionMaterials(p: SettlementPosition): number {
  const blank = p.clientItem ? 0 : p.blankCost;
  return (p.thermalCost + blank) * p.quantity;
}

/** Расчёт по одной позиции. Все суммы — целые рубли (округление банковское вниз). */
export function settlePosition(
  p: SettlementPosition,
  rateBasisPoints: number,
): PositionSettlement {
  // Ставка позиции важнее общей: в позиции лежит снимок на момент
  // оформления, и правка настроек не должна двигать уже оформленный заказ.
  const rate = p.rateBasisPoints ?? rateBasisPoints;

  if (p.mode === 'REVENUE_SHARE') {
    const partnerProfit = Math.floor((p.pricePosition * rate) / 10000);
    return {
      materials: 0,
      margin: p.pricePosition,
      reward: partnerProfit,
      partnerProfit,
      ownerProfit: p.pricePosition - partnerProfit,
    };
  }

  const printRevenue = p.pricePosition - p.designCost;
  const materials = positionMaterials(p);
  // Маржа не может быть отрицательной для расчёта доли: если печать в минус,
  // партнёр получает только возврат материалов, а не «минусовой» процент.
  const margin = Math.max(0, printRevenue - materials);
  // Доля партнёра округляется до рубля вниз — так владелец не переплачивает
  // из-за копеек, а сумма остаётся детерминированной.
  const partnerProfit = Math.floor((margin * rate) / 10000);
  const reward = partnerProfit + materials;
  const ownerProfit = p.pricePosition - reward;
  return { materials, margin, reward, partnerProfit, ownerProfit };
}

/** Расчёт по всему заказу — сумма по всем футболочным позициям. */
export function settleOrder(
  positions: SettlementPosition[],
  rateBasisPoints: number,
): OrderSettlement {
  const acc = positions.reduce(
    (s, p) => {
      const r = settlePosition(p, rateBasisPoints);
      s.materials += r.materials;
      s.margin += r.margin;
      s.reward += r.reward;
      s.partnerProfit += r.partnerProfit;
      s.ownerProfit += r.ownerProfit;
      s.tshirtRevenue += p.pricePosition;
      return s;
    },
    {
      materials: 0,
      margin: 0,
      reward: 0,
      partnerProfit: 0,
      ownerProfit: 0,
      tshirtRevenue: 0,
    },
  );
  return { ...acc, rateBasisPoints };
}
