import { Prisma } from 'src/generated/prisma/client';

/**
 * Правила корзины удалённых заказов.
 *
 * Здесь только чистые функции — ни базы, ни Nest. Поэтому поведение, от
 * которого зависит возврат заказа, проверяется тестами целиком: срок
 * хранения, что мешает восстановлению и какие поля переносятся из снимка.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Сколько дней удалённый заказ можно вернуть.
 *
 * Тридцать дней — это один цикл сверки: заказ, удалённый по ошибке, почти
 * всегда обнаруживается на месячном отчёте по зарплате или выручке, а не
 * раньше. Меньший срок его не покрыл бы, больший — держал бы персональные
 * данные клиента дольше, чем того требует работа.
 */
export const DEFAULT_RETENTION_DAYS = 30;

/** Потолок на случай опечатки в переменной окружения (3650 вместо 30). */
const MAX_RETENTION_DAYS = 365;

/**
 * Срок хранения из окружения.
 *
 * Непонятное значение — это ошибка настройки, и подменять её нулём нельзя:
 * ноль означал бы «чистить сразу», то есть ровно ту потерю данных, от
 * которой корзина и защищает. Поэтому берётся значение по умолчанию.
 */
export function retentionDays(raw: string | undefined): number {
  const parsed = Number((raw ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_RETENTION_DAYS;
  return Math.min(Math.floor(parsed), MAX_RETENTION_DAYS);
}

/** Момент, после которого снимок вычищается. */
export function purgeAfterFrom(deletedAt: Date, days: number): Date {
  return new Date(deletedAt.getTime() + days * DAY_MS);
}

/**
 * Сколько дней осталось на возврат. Округляем вверх: пока сам момент
 * очистки не наступил, в интерфейсе должен стоять хотя бы один день —
 * иначе запись с девятью часами в запасе выглядела бы просроченной.
 */
export function daysLeft(purgeAfter: Date | null, now: Date): number | null {
  if (!purgeAfter) return null;
  const ms = purgeAfter.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / DAY_MS);
}

/** Что мешает вернуть заказ. `null` — ничего, возврат возможен. */
export type RestoreBlock =
  'already-restored' | 'no-snapshot' | 'expired' | 'order-exists';

export interface RestorableRecord {
  restoredAt: Date | null;
  snapshot: unknown;
  purgeAfter: Date | null;
  purgedAt: Date | null;
}

/**
 * Можно ли вернуть заказ из этой записи.
 *
 * Порядок проверок — от более точного объяснения к менее точному: «уже
 * восстановлен» важнее, чем «нет снимка», а истёкший срок понятнее, чем
 * «нет снимка», хотя снимка в обоих случаях уже нет.
 */
export function restoreBlock(
  record: RestorableRecord,
  now: Date,
): RestoreBlock | null {
  if (record.restoredAt) return 'already-restored';
  if (record.purgedAt) return 'expired';
  if (record.purgeAfter && record.purgeAfter.getTime() <= now.getTime()) {
    return 'expired';
  }
  // Записи, сделанные до появления корзины, снимка не имеют: те заказы
  // удалялись физически, и возвращать из них нечего.
  if (!record.snapshot) return 'no-snapshot';
  return null;
}

/** Человеческое объяснение отказа — одно на весь проект. */
export function restoreBlockMessage(block: RestoreBlock): string {
  switch (block) {
    case 'already-restored':
      return 'Этот заказ уже восстановлен.';
    case 'expired':
      return 'Срок хранения вышел: снимок заказа вычищен, восстанавливать нечего.';
    case 'no-snapshot':
      return 'Заказ удалён до появления корзины — его снимок не сохранялся, восстановить нельзя.';
    case 'order-exists':
      return 'Заказ с таким идентификатором уже есть в системе.';
  }
}

// ── Снимок заказа ───────────────────────────────────────────────────────────

/**
 * Версия формата снимка. Пока одна; поле нужно, чтобы через год код мог
 * отличить старый снимок от нового, а не угадывать по составу полей.
 */
export const SNAPSHOT_VERSION = 1;

export interface OrderSnapshot {
  version: number;
  order: Record<string, unknown>;
  items: Record<string, unknown>[];
  tshirtItems: Record<string, unknown>[];
  canvasItems: Record<string, unknown>[];
  statusHistory: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  /**
   * Начисления зарплаты. `hadPayment` — было ли начисление хоть частично
   * выплачено: такие при возврате не воссоздаются, см. restorePayload.
   */
  accruals: (Record<string, unknown> & { hadPayment: boolean })[];
}

/**
 * Поля, которые переносятся. Списки генерирует Prisma, поэтому они не
 * расходятся со схемой: новая колонка заказа попадает в снимок сама, а
 * удалённая перестаёт мешать возврату старого снимка.
 *
 * Это и есть причина фильтровать, а не отдавать снимок целиком: снимок
 * живёт 30 дней, за это время схема успевает измениться, и `create` с
 * колонкой, которой больше нет, упал бы с «Unknown argument».
 */
/**
 * Колонки, которые считает сама база (generated columns).
 *
 * Prisma перечисляет их наравне с обычными, но записать в такую колонку
 * нельзя: Postgres отвечает «cannot insert a non-DEFAULT value» (428C9), и
 * возврат заказа падал именно здесь — снимок честно нёс в себе посчитанный
 * срок, а `create` пытался его вписать.
 *
 * Данные при этом не теряются: `deadlineEffective` выводится из полей,
 * которые в снимке есть (`deadline`, `createdAt`, `productCategory`), и
 * база пересчитает его сама, как только заказ вернётся.
 */
const GENERATED_ORDER_FIELDS: readonly string[] = ['deadlineEffective'];

const ORDER_FIELDS = Object.keys(Prisma.OrderPhotoScalarFieldEnum).filter(
  (field) => !GENERATED_ORDER_FIELDS.includes(field),
);
const ITEM_PHOTO_FIELDS = Object.keys(Prisma.ItemPhotoScalarFieldEnum);
const ITEM_TSHIRT_FIELDS = Object.keys(Prisma.ItemTshirtScalarFieldEnum);
const ITEM_CANVAS_FIELDS = Object.keys(Prisma.ItemCanvasScalarFieldEnum);
const STATUS_HISTORY_FIELDS = Object.keys(Prisma.StatusHistoryScalarFieldEnum);
const ASSIGNMENT_FIELDS = Object.keys(Prisma.OrderAssignmentScalarFieldEnum);
const ACCRUAL_FIELDS = Object.keys(Prisma.SalaryAccrualScalarFieldEnum);

/**
 * Оставляет только известные колонки модели.
 *
 * `undefined` выбрасываем, `null` оставляем: null — осмысленное значение
 * колонки («исполнителя нет»), а undefined означает «не передавать», и
 * Prisma подставила бы значение по умолчанию вместо снятого.
 */
export function pickKnownFields(
  source: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (!source || typeof source !== 'object') return {};
  const row = source as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of allowed) {
    if (row[field] !== undefined) result[field] = row[field];
  }
  return result;
}

/** Что грузить из базы, чтобы снимок получился полным. */
export const SNAPSHOT_INCLUDE = {
  items: true,
  tshirtItems: true,
  canvasItems: true,
  statusHistory: true,
  assignments: true,
  accruals: { include: { paymentLinks: { select: { id: true } } } },
} as const;

interface SnapshotSource {
  items?: unknown[];
  tshirtItems?: unknown[];
  canvasItems?: unknown[];
  statusHistory?: unknown[];
  assignments?: unknown[];
  accruals?: { paymentLinks?: unknown[] }[];
}

/** Собирает снимок из уже загруженного заказа со связями. */
export function buildOrderSnapshot(order: unknown): OrderSnapshot {
  const source = (order ?? {}) as SnapshotSource;
  const list = (rows: unknown[] | undefined, fields: readonly string[]) =>
    (rows ?? []).map((row) => pickKnownFields(row, fields));

  return {
    version: SNAPSHOT_VERSION,
    order: pickKnownFields(order, ORDER_FIELDS),
    items: list(source.items, ITEM_PHOTO_FIELDS),
    tshirtItems: list(source.tshirtItems, ITEM_TSHIRT_FIELDS),
    canvasItems: list(source.canvasItems, ITEM_CANVAS_FIELDS),
    statusHistory: list(source.statusHistory, STATUS_HISTORY_FIELDS),
    assignments: list(source.assignments, ASSIGNMENT_FIELDS),
    accruals: (source.accruals ?? []).map((accrual) => ({
      ...pickKnownFields(accrual, ACCRUAL_FIELDS),
      // Выплаченное начисление при возврате не воссоздаётся, но знать о нём
      // нужно: иначе непонятно, почему зарплата по вернувшемуся заказу
      // выглядит не так, как до удаления.
      hadPayment: (accrual?.paymentLinks ?? []).length > 0,
    })),
  };
}

// ── Возврат заказа из снимка ────────────────────────────────────────────────

export interface RestorePayload {
  order: Record<string, unknown>;
  items: Record<string, unknown>[];
  tshirtItems: Record<string, unknown>[];
  canvasItems: Record<string, unknown>[];
  statusHistory: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  accruals: Record<string, unknown>[];
  /**
   * Сколько начислений не вернулось, потому что по ним уже платили. Это
   * показывается администратору: зарплату по такому заказу нужно собрать
   * заново, молча расходиться с прежней суммой нельзя.
   */
  skippedPaidAccruals: number;
}

/**
 * Разбирает снимок в то, что можно отдать Prisma.
 *
 * Выплаченные начисления намеренно не воссоздаются: их платёжные связи
 * (PaymentAccrualLink) удалились вместе с заказом, а сами выплаты — нет.
 * Вернуть такое начисление без связи значило бы показать его
 * невыплаченным и заплатить второй раз.
 */
export function restorePayload(snapshot: unknown): RestorePayload {
  const snap = (snapshot ?? {}) as Partial<OrderSnapshot>;
  const order = pickKnownFields(snap.order, ORDER_FIELDS);
  const orderId = typeof order.id === 'string' ? order.id : undefined;

  // Связанные строки привязываем к восстановленному заказу явно: orderId
  // из снимка указывал бы в пустоту, если id пришлось сменить.
  const attach = (rows: unknown[] | undefined, fields: readonly string[]) =>
    (rows ?? []).map((row) => ({
      ...pickKnownFields(row, fields),
      ...(orderId ? { orderId } : {}),
    }));

  const accruals = snap.accruals ?? [];
  const restorable = accruals.filter((accrual) => !accrual?.hadPayment);

  return {
    order,
    items: attach(snap.items, ITEM_PHOTO_FIELDS),
    tshirtItems: attach(snap.tshirtItems, ITEM_TSHIRT_FIELDS),
    canvasItems: attach(snap.canvasItems, ITEM_CANVAS_FIELDS),
    statusHistory: attach(snap.statusHistory, STATUS_HISTORY_FIELDS),
    assignments: attach(snap.assignments, ASSIGNMENT_FIELDS),
    accruals: restorable.map((accrual) => ({
      ...pickKnownFields(accrual, ACCRUAL_FIELDS),
      ...(orderId ? { orderId } : {}),
    })),
    skippedPaidAccruals: accruals.length - restorable.length,
  };
}
