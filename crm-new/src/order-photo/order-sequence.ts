import type { Prisma } from 'src/generated/prisma/client';
import fullDate from 'src/utils/full-date';

/**
 * Выдача внутреннего номера заказа.
 *
 * Номер выглядит как YYYYMMDD-NNN, где NNN — сквозной счётчик за месяц, а не
 * за день: день в номере нужен человеку, а считают заказы месяцем — так их
 * и сверяют в отчётах.
 *
 * Счётчик берётся как MAX по номерам месяца, а не из последовательности
 * Postgres: номера правятся и переносятся руками, и последовательность с
 * ними разъехалась бы.
 *
 * Не путать с `order-number.ts` — тот отвечает за то, каким номером заказ
 * НАЗЫВАЮТ людям (внутренний или номер площадки). Здесь — выдача нового.
 */

/**
 * Идентификатор advisory-блокировки выдачи номеров. Одно число на весь
 * проект: любые два места, выдающие номер, обязаны ждать друг друга, иначе
 * оба прочитают одинаковый MAX и получат один номер — а он уникален.
 */
export const ORDER_NUMBER_LOCK = 1001;

/**
 * Следующий свободный номер заказа в текущем месяце.
 *
 * ВАЖНО: вызывать только внутри транзакции, которая уже держит
 * `pg_advisory_xact_lock(ORDER_NUMBER_LOCK)`.
 *
 * Без параметра «сейчас» намеренно: день в номере печатает `fullDate` по
 * текущему времени, и отдельный параметр разъехался бы с ним — префикс
 * месяца от одной даты, день от другой.
 */
export async function nextOrderNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const seqResult = await tx.$queryRaw<{ max: number }[]>`
    SELECT COALESCE(MAX(CAST(SPLIT_PART("numberOrder", '-', 2) AS INTEGER)), 0) AS max
    FROM "OrderPhoto"
    WHERE "numberOrder" LIKE ${monthPrefix + '%'}
  `;
  const lastSeq = Number(seqResult[0]?.max ?? 0);
  return fullDate(String(lastSeq + 1).padStart(3, '0'));
}
