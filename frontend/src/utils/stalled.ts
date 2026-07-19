import type { EnumStatus } from '../types/index';

/** Столько дней заказ может стоять в одном статусе, прежде чем считается зависшим. */
export const STALLED_AFTER_DAYS = 3;

/**
 * Статусы, в которых заказ реально висит на исполнителе.
 * Должны совпадать с IN_WORK_STATUSES на бэкенде (users.service.ts).
 */
const IN_WORK_STATUSES: EnumStatus[] = [
  'NEW',
  'FOLDER_STRUCTURE_CREATED',
  'IN_PROGRESS',
  'PRINTED',
];

/**
 * Сколько дней заказ стоит без движения, если он завис. Возвращает null, когда
 * заказ не в работе (готовый «висеть» не может — работа уже сдана) или порог
 * ещё не превышен.
 */
export function getStalledDays(order: {
  status: EnumStatus;
  statusChangedAt?: string | null;
  createdAt: string;
}): number | null {
  if (!IN_WORK_STATUSES.includes(order.status)) return null;
  // У заказов, созданных до появления statusChangedAt, отсчёт идёт от создания.
  const since = order.statusChangedAt ?? order.createdAt;
  if (!since) return null;
  const days = Math.floor(
    (Date.now() - new Date(since).getTime()) / (24 * 60 * 60 * 1000),
  );
  return days >= STALLED_AFTER_DAYS ? days : null;
}
