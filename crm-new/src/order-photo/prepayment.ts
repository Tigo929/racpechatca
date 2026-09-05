/**
 * Расчёт предоплаты и остатка — один на весь проект.
 *
 * Клиент вносит предоплату один раз конкретной суммой. Потом заказ может
 * меняться: добавили футболку, убрали позицию, сняли доставку. Сумма
 * заказа при этом другая, но ВНЕСЁННАЯ предоплата не меняется — меняется
 * только остаток. Раньше остаток считался как 50% от текущей суммы, и после
 * любой правки он «уезжал»: клиент внёс 1500, добавил вторую футболку —
 * система показывала предоплату уже как 50% от новой суммы, а не 1500.
 *
 * Поэтому расчёт один и тот же везде: сообщения клиенту, стикер, задание
 * партнёру. Категория (фото/футболки/холсты) роли не играет.
 */

/** Доля предоплаты по умолчанию, пока клиент не внёс конкретную сумму. */
export const DEFAULT_PREPAY_RATE = 0.5;

export interface Prepayment {
  /** Сколько внести/внесено предоплатой. */
  prepaid: number;
  /** Сколько останется доплатить. Отрицательное — переплата, к возврату. */
  balanceDue: number;
  /** Предоплата зафиксирована менеджером (true) или это ориентир 50% (false). */
  recorded: boolean;
}

/**
 * @param total          полная сумма заказа
 * @param prepaidAmount  фактически внесённая предоплата (null — ещё не вносили)
 */
export function computePrepayment(
  total: number,
  prepaidAmount: number | null | undefined,
): Prepayment {
  const safeTotal = Math.max(0, Math.round(total));
  if (prepaidAmount === null || prepaidAmount === undefined) {
    // Ориентир: половина суммы, округление вверх — как было.
    const prepaid = Math.ceil(safeTotal * DEFAULT_PREPAY_RATE);
    return { prepaid, balanceDue: safeTotal - prepaid, recorded: false };
  }
  const prepaid = Math.max(0, Math.round(prepaidAmount));
  return { prepaid, balanceDue: safeTotal - prepaid, recorded: true };
}
