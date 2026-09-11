import { parseDesignNoteUtm } from './designnote-utm';
import { parseNoteAttribution } from './note-attribution';
import { resolveFirstPaidAt, type StatusTransition } from './paid-at-resolver';

/**
 * План backfill для одного заказа — чистая функция без базы.
 *
 * Собирает, что можно восстановить из трёх исторических источников,
 * и сверяет с тем, что уже лежит в колонках. Правило одно: колонка
 * важнее истории. Заполненное поле не трогаем; если история говорит
 * другое — это конфликт, он считается и попадает в отчёт, но в базу
 * не пишется. Пустое поле заполняем только подтверждённым значением.
 *
 * Отсюда идемпотентность даром: после первого прогона все поля, которые
 * было чем заполнить, заполнены, и второй прогон видит только «уже есть,
 * совпадает» — то есть нуль изменений.
 */

export const BACKFILL_FIELDS = [
  'yandexClientId',
  'yclid',
  'conversionPageUrl',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'clientPaidAt',
] as const;

export type BackfillField = (typeof BACKFILL_FIELDS)[number];

export interface OrderSnapshot {
  id: string;
  numberOrder: string;
  note: string | null;
  yandexClientId: string | null;
  yclid: string | null;
  conversionPageUrl: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  clientPaidAt: Date | null;
  tshirtItems: { designNote: string | null }[];
  statusHistory: StatusTransition[];
}

export type Patch = Partial<{
  yandexClientId: string;
  yclid: string;
  conversionPageUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  clientPaidAt: Date;
}>;

export interface Conflict {
  orderId: string;
  numberOrder: string;
  field: BackfillField;
}

export interface FieldStats {
  /** В истории нашлось значение (независимо от того, что в колонке). */
  found: number;
  /** Будет записано: колонка пуста, история есть. */
  fill: number;
  /** Колонка уже заполнена и совпадает с историей — ничего не делаем. */
  alreadyStructured: number;
  /** Маркер был, значение не прошло проверку. */
  parseFailures: number;
  /** Колонка заполнена и НЕ совпадает с историей. */
  conflicts: number;
}

export interface OrderPlan {
  patch: Patch;
  stats: Record<BackfillField, FieldStats>;
  conflicts: Conflict[];
  /** Метки футболки были, но однозначно разложить нельзя. */
  utmAmbiguous: boolean;
}

export function emptyStats(): Record<BackfillField, FieldStats> {
  const one = (): FieldStats => ({
    found: 0,
    fill: 0,
    alreadyStructured: 0,
    parseFailures: 0,
    conflicts: 0,
  });
  return Object.fromEntries(BACKFILL_FIELDS.map((f) => [f, one()])) as Record<
    BackfillField,
    FieldStats
  >;
}

export function planOrder(order: OrderSnapshot): OrderPlan {
  const stats = emptyStats();
  const conflicts: Conflict[] = [];
  const patch: Patch = {};

  const consider = <F extends BackfillField>(
    field: F,
    historical: string | Date | null,
    current: string | Date | null,
  ): void => {
    if (historical === null) return;
    stats[field].found += 1;
    if (current === null) {
      stats[field].fill += 1;
      (patch as Record<string, unknown>)[field] = historical;
      return;
    }
    const same =
      current instanceof Date && historical instanceof Date
        ? current.getTime() === historical.getTime()
        : current === historical;
    if (same) {
      stats[field].alreadyStructured += 1;
    } else {
      stats[field].conflicts += 1;
      conflicts.push({ orderId: order.id, numberOrder: order.numberOrder, field });
    }
  };

  // 1. note → ClientID, yclid, страница заявки
  const note = parseNoteAttribution(order.note);
  for (const f of note.failures) stats[f].parseFailures += 1;
  consider('yandexClientId', note.yandexClientId, order.yandexClientId);
  consider('yclid', note.yclid, order.yclid);
  consider('conversionPageUrl', note.conversionPageUrl, order.conversionPageUrl);

  // 2. designNote футболок → UTM. Берём первую позицию, где метки есть:
  //    все позиции одного заказа писались из одной заявки.
  let utmAmbiguous = false;
  for (const item of order.tshirtItems) {
    const utm = parseDesignNoteUtm(item.designNote);
    if (!utm.utmSource) continue;
    utmAmbiguous = utm.ambiguous;
    consider('utmSource', utm.utmSource, order.utmSource);
    consider('utmMedium', utm.utmMedium, order.utmMedium);
    consider('utmCampaign', utm.utmCampaign, order.utmCampaign);
    break;
  }
  // utmContent / utmTerm исторически не сохранялись — источника нет.

  // 3. StatusHistory → первая оплата
  consider('clientPaidAt', resolveFirstPaidAt(order.statusHistory), order.clientPaidAt);

  return { patch, stats, conflicts, utmAmbiguous };
}

/** Сумма статистик по всем заказам — для отчёта. */
export function addStats(
  into: Record<BackfillField, FieldStats>,
  from: Record<BackfillField, FieldStats>,
): void {
  for (const f of BACKFILL_FIELDS) {
    for (const k of Object.keys(into[f]) as (keyof FieldStats)[]) {
      into[f][k] += from[f][k];
    }
  }
}
