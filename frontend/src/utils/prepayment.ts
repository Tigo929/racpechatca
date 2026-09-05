/**
 * Предоплата и остаток — общий расчёт для всех категорий (фото/футболки/холсты).
 *
 * Клиент вносит предоплату один раз конкретной суммой. Дальше заказ может
 * меняться (добавили позицию, сняли доставку), но внесённая сумма не меняется —
 * меняется только остаток. Поэтому остаток считается как «сумма − предоплата»,
 * а не как 50% от текущей суммы. Копия логики бэкенда (crm-new/.../prepayment.ts),
 * чтобы сообщения клиенту и стикер/задание партнёру совпадали до рубля.
 */

/** Доля предоплаты по умолчанию, пока клиент не внёс конкретную сумму. */
export const DEFAULT_PREPAY_RATE = 0.5;

export interface Prepayment {
  /** Сколько внести/внесено предоплатой. */
  prepaid: number;
  /** Сколько останется доплатить. Отрицательное — переплата, к возврату. */
  balanceDue: number;
  /** Предоплата зафиксирована реальной суммой (true) или это ориентир 50% (false). */
  recorded: boolean;
}

export function computePrepayment(
  total: number,
  prepaidAmount: number | null | undefined,
): Prepayment {
  const safeTotal = Math.max(0, Math.round(total));
  if (prepaidAmount === null || prepaidAmount === undefined) {
    const prepaid = Math.ceil(safeTotal * DEFAULT_PREPAY_RATE);
    return { prepaid, balanceDue: safeTotal - prepaid, recorded: false };
  }
  const prepaid = Math.max(0, Math.round(prepaidAmount));
  return { prepaid, balanceDue: safeTotal - prepaid, recorded: true };
}
