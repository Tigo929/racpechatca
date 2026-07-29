import { randomUUID } from 'node:crypto';
import { EnumStatus } from 'src/generated/prisma/enums';
import {
  settleOrder,
  settlePosition,
  type SettlementPosition,
} from 'src/partner/partner-settlement';
import type {
  GulianProductionStatus,
  GulianUpsertEvent,
} from './gulian.types';

export class GulianPayloadValidationError extends Error {
  constructor(
    public readonly code: 'quantity_ambiguous' | 'unsupported_status',
    message: string,
  ) {
    super(message);
    this.name = 'GulianPayloadValidationError';
  }
}

export interface GulianTshirtItem extends SettlementPosition {}

export interface GulianOrderSource {
  id: string;
  numberOrder: string;
  sourceRevision: number;
  telegramChatId: string | null;
  telegramMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  tshirtItems: GulianTshirtItem[];
}

export interface GulianPayoutSnapshot {
  quantity: number;
  payoutCalculationMode: 'per_unit' | 'order_total';
  unitPayoutAmountKopecks: number | null;
  totalPayoutAmountKopecks: number;
}

function rublesToKopecks(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error('Сумма выплаты выходит за безопасный целочисленный диапазон.');
  }
  const kopecks = value * 100;
  if (!Number.isSafeInteger(kopecks)) {
    throw new Error('Сумма выплаты в копейках выходит за безопасный диапазон.');
  }
  return kopecks;
}

export function productionStatusFromOrderStatus(
  status: EnumStatus | string,
): GulianProductionStatus | null {
  switch (status) {
    case EnumStatus.SENT:
      return 'sent';
    case EnumStatus.IN_PROGRESS:
      return 'in_progress';
    case EnumStatus.READY:
      return 'ready';
    case EnumStatus.PROBLEM:
      return 'problem';
    case EnumStatus.CANCELLED:
      return 'cancelled';
    default:
      return null;
  }
}

/**
 * Использует существующую формулу settlePosition/settleOrder без изменений.
 * per_unit выбирается только если каждая производственная позиция действительно
 * имеет одну и ту же точную выплату на изделие. Иначе передаётся order_total.
 */
export function calculateGulianPayout(
  items: GulianTshirtItem[],
  partnerRateBasisPoints: number,
): GulianPayoutSnapshot {
  if (items.length === 0) {
    throw new GulianPayloadValidationError(
      'quantity_ambiguous',
      'Не удалось определить количество изделий',
    );
  }

  let quantity = 0;
  let commonUnitRubles: number | null = null;
  let perUnitIsExact = true;

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new GulianPayloadValidationError(
        'quantity_ambiguous',
        'Не удалось определить количество изделий',
      );
    }
    quantity += item.quantity;
    const line = settlePosition(item, partnerRateBasisPoints);
    if (line.reward % item.quantity !== 0) {
      perUnitIsExact = false;
      continue;
    }
    const lineUnit = line.reward / item.quantity;
    if (commonUnitRubles === null) commonUnitRubles = lineUnit;
    else if (commonUnitRubles !== lineUnit) perUnitIsExact = false;
  }

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new GulianPayloadValidationError(
      'quantity_ambiguous',
      'Не удалось определить количество изделий',
    );
  }

  const totalRubles = settleOrder(items, partnerRateBasisPoints).reward;
  const totalPayoutAmountKopecks = rublesToKopecks(totalRubles);
  const canUsePerUnit = perUnitIsExact && commonUnitRubles !== null;
  const unitPayoutAmountKopecks = canUsePerUnit
    ? rublesToKopecks(commonUnitRubles!)
    : null;

  if (
    unitPayoutAmountKopecks !== null &&
    quantity * unitPayoutAmountKopecks !== totalPayoutAmountKopecks
  ) {
    throw new Error('Внутренняя ошибка точного расчёта выплаты per_unit.');
  }

  return {
    quantity,
    payoutCalculationMode: canUsePerUnit ? 'per_unit' : 'order_total',
    unitPayoutAmountKopecks,
    totalPayoutAmountKopecks,
  };
}

export function buildGulianEvent(params: {
  order: GulianOrderSource;
  partnerRateBasisPoints: number;
  productionStatus: GulianProductionStatus;
  occurredAt?: Date;
  eventId?: string;
}): GulianUpsertEvent {
  const occurredAt = params.occurredAt ?? new Date();
  const payout = calculateGulianPayout(
    params.order.tshirtItems,
    params.partnerRateBasisPoints,
  );

  return {
    event_id: params.eventId ?? randomUUID(),
    event_type: 'order.upsert',
    source: 'raspechatka',
    occurred_at: occurredAt.toISOString(),
    order: {
      external_order_id: params.order.numberOrder,
      external_internal_id: params.order.id,
      source_revision: params.order.sourceRevision,
      quantity: payout.quantity,
      payout_calculation_mode: payout.payoutCalculationMode,
      unit_payout_amount_kopecks: payout.unitPayoutAmountKopecks,
      total_payout_amount_kopecks: payout.totalPayoutAmountKopecks,
      currency: 'RUB',
      production_status: params.productionStatus,
      telegram_chat_id: params.order.telegramChatId,
      telegram_message_id: params.order.telegramMessageId,
      source_url: `/crm/tshirt?order=${encodeURIComponent(params.order.id)}`,
      created_at: params.order.createdAt.toISOString(),
      updated_at: params.order.updatedAt.toISOString(),
    },
  };
}
