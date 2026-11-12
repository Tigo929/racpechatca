import {
  OrderPositionsSource,
  settlementPositions,
} from 'src/partner/settlement-positions';
import { settleOrder } from 'src/partner/partner-settlement';

export type PayoutResult = {
  quantity: number;
  totalPayoutKopecks: number;
  unitPayoutKopecks: number | null;
  mode: 'per_unit' | 'order_total';
};

/**
 * Выплата партнёру в его CRM.
 *
 * Формулу здесь когда-то переписали руками — вторая копия того же расчёта.
 * Копия и разошлась с оригиналом: она знала только позиции-футболки, поэтому
 * заказ на печать термотрансферов (футболок в нём нет вовсе) падал с «Нет
 * производственных позиций», тихо гасился в логе, и у исполнителя заказ не
 * появлялся вообще. Теперь считаем тем же модулем, что сообщение в Telegram,
 * авто-расход и отчёты, — цифра у всех одна по построению.
 */
export function calcGulianPayout(
  order: OrderPositionsSource,
  rateBasisPoints: number,
): PayoutResult {
  const positions = settlementPositions(order);
  const quantity = positions.reduce((s, p) => s + p.quantity, 0);
  if (quantity === 0) throw new Error('Нет производственных позиций');

  // Платим чистый заработок: возврат материалов проходит отдельно и в
  // выплату его CRM не входит — так было и в прежней формуле.
  const totalPayoutKopecks =
    settleOrder(positions, rateBasisPoints).partnerProfit * 100;

  if (totalPayoutKopecks % quantity === 0) {
    return {
      quantity,
      totalPayoutKopecks,
      unitPayoutKopecks: totalPayoutKopecks / quantity,
      mode: 'per_unit',
    };
  }
  return {
    quantity,
    totalPayoutKopecks,
    unitPayoutKopecks: null,
    mode: 'order_total',
  };
}
