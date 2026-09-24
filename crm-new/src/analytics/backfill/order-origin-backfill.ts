import {
  classifyHistoricalOrigin,
  ORDER_ORIGINS,
  originOf,
  type OrderOrigin,
} from '../../order-photo/order-origin';

/**
 * Историческая классификация происхождения заказов (этап 17).
 *
 * Чистая функция плана и отдельное применение: план можно показать человеку,
 * сверить и повторить, ничего не записав. Правило одно — писать только там,
 * где происхождение доказано; всё остальное честно остаётся UNKNOWN, а
 * противоречия уходят в конфликты и не перетираются молча.
 */

export interface OriginBackfillRow {
  id: string;
  numberOrder: string;
  sourceOrder: string | null;
  externalRequestId: string | null;
}

export interface OriginChange {
  id: string;
  numberOrder: string;
  from: string | null;
  to: OrderOrigin;
  reason: string;
}

export interface OriginConflict {
  id: string;
  numberOrder: string;
  stored: string | null;
  reason: string;
}

export interface OriginBackfillPlan {
  total: number;
  /** Что сохранено в базе сейчас. */
  current: Record<string, number>;
  /** Что будет после применения плана. */
  proposed: Record<string, number>;
  changes: OriginChange[];
  conflicts: OriginConflict[];
  /** Сколько заказов остаются UNKNOWN: происхождение не доказано. */
  ambiguous: number;
}

const emptyCounts = (): Record<string, number> =>
  Object.fromEntries(ORDER_ORIGINS.map((o) => [o, 0]));

export function planOriginBackfill(
  rows: OriginBackfillRow[],
): OriginBackfillPlan {
  const current = emptyCounts();
  const proposed = emptyCounts();
  const changes: OriginChange[] = [];
  const conflicts: OriginConflict[] = [];
  let ambiguous = 0;

  for (const row of rows) {
    current[originOf(row.sourceOrder)] += 1;
    const verdict = classifyHistoricalOrigin(row);
    proposed[verdict.origin] += 1;
    if (verdict.proof === 'CONFLICT') {
      conflicts.push({
        id: row.id,
        numberOrder: row.numberOrder,
        stored: row.sourceOrder,
        reason: verdict.reason,
      });
      continue;
    }
    if (verdict.origin === 'UNKNOWN') ambiguous += 1;
    if (verdict.changed) {
      changes.push({
        id: row.id,
        numberOrder: row.numberOrder,
        from: row.sourceOrder,
        to: verdict.origin,
        reason: verdict.reason,
      });
    }
  }

  return {
    total: rows.length,
    current,
    proposed,
    changes,
    conflicts,
    ambiguous,
  };
}

/** Снимок «что было» — из него откатывается ровно этап 17 и ничего больше. */
export function snapshotOf(
  plan: OriginBackfillPlan,
): { id: string; numberOrder: string; sourceOrder: string | null }[] {
  return plan.changes.map((c) => ({
    id: c.id,
    numberOrder: c.numberOrder,
    sourceOrder: c.from,
  }));
}

/** Короткая сводка для человека: она же печатается в dry-run и после apply. */
export function summaryOf(plan: OriginBackfillPlan): Record<string, unknown> {
  return {
    total: plan.total,
    current: plan.current,
    proposed: plan.proposed,
    proposedChanges: plan.changes.length,
    conflicts: plan.conflicts.length,
    ambiguousUnknown: plan.ambiguous,
    byTransition: plan.changes.reduce<Record<string, number>>((acc, c) => {
      const key = `${String(c.from)} -> ${c.to}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
