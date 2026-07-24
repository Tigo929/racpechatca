import { EnumStatus } from 'src/generated/prisma/enums';
import {
  daysUntilDeadline,
  escapeHtml,
  formatDeadlineLabel,
  mentionFor,
  moscowDateKey,
  moscowHour,
} from 'src/tasks/task-reminder-rules';

/**
 * Правила ежедневного «плана дня» по заказам. Чистые функции без БД и сети —
 * их можно проверить тестами целиком. Планировщик (daily-plan.service) только
 * тянет данные и зовёт эти функции.
 */

/** Час по Москве, в который уходит план дня. */
export const PLAN_HOUR = 10;
/** После этого часа план за сегодня уже не отправляем (догоняем пропуск днём). */
export const PLAN_LAST_HOUR = 21;

/** Статусы «в работе у исполнителя» — что реально предстоит сделать сегодня. */
export const PLAN_IN_WORK_STATUSES: EnumStatus[] = [
  EnumStatus.NEW,
  EnumStatus.FOLDER_STRUCTURE_CREATED,
  EnumStatus.IN_PROGRESS,
  EnumStatus.PRINTED,
];

/** Рабочее окно рассылки плана: 10:00–21:59 по Москве. */
export function isWithinPlanWindow(date: Date): boolean {
  const hour = moscowHour(date);
  return hour >= PLAN_HOUR && hour <= PLAN_LAST_HOUR;
}

export interface PlanOrder {
  numberOrder: string;
  deadline: Date | null;
  createdAt: Date;
  isUrgent: boolean;
  items: { formatPaper: string; quantity: number }[];
}

export interface PlanGroup {
  executor: { username: string; telegramUsername: string | null };
  orders: PlanOrder[];
}

/**
 * Дедлайн заказа для плана: у фото он задаётся при создании, но на всякий
 * случай падаем на «создан + 3 дня», как это делает список заказов.
 */
function effectiveDeadline(order: PlanOrder): Date {
  if (order.deadline) return order.deadline;
  return new Date(order.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
}

/**
 * Ключ приоритета: чем меньше — тем выше в списке. Срочные всплывают над всем
 * (−1000), дальше просроченные (отрицательные дни), потом сегодня (0), потом
 * будущее. Так «горит» оказывается сверху, а «спокойное» — ниже.
 */
export function priorityKey(order: PlanOrder, now: Date): number {
  const days = daysUntilDeadline(effectiveDeadline(order), now);
  return order.isUrgent ? days - 1000 : days;
}

/** Эмодзи-маркер строки заказа по «накалу». */
export function orderMarker(order: PlanOrder, now: Date): string {
  if (order.isUrgent) return '🔥';
  const days = daysUntilDeadline(effectiveDeadline(order), now);
  if (days < 0) return '🔴';
  if (days === 0) return '🟠';
  if (days === 1) return '🟡';
  return '🟢';
}

/** «10×15 ×20, Polaroid ×5» — краткий состав, максимум 3 формата. */
export function summarizeItems(
  items: { formatPaper: string; quantity: number }[],
): string {
  if (items.length === 0) return '(без позиций)';
  const byFormat = new Map<string, number>();
  for (const it of items) {
    const key = it.formatPaper?.trim() || 'позиция';
    byFormat.set(key, (byFormat.get(key) ?? 0) + (it.quantity ?? 0));
  }
  const parts = [...byFormat].map(
    ([f, q]) => `${escapeHtml(f)} ×${q}`,
  );
  const shown = parts.slice(0, 3).join(', ');
  return parts.length > 3 ? `${shown}, …` : shown;
}

/** Хвост строки: срочность + человекочитаемый срок. */
function orderTail(order: PlanOrder, now: Date): string {
  const label = formatDeadlineLabel(effectiveDeadline(order), now);
  return order.isUrgent ? `<b>СРОЧНО</b>, ${label}` : label;
}

function dayMonth(now: Date): string {
  // moscowDateKey → «2026-07-24»; берём день и месяц.
  const [, mm, dd] = moscowDateKey(now).split('-');
  return `${dd}.${mm}`;
}

/**
 * Собирает одно сообщение-план на весь день. Исполнители идут по «накалу»:
 * у кого самая горящая задача — тот выше. Внутри исполнителя — тоже сначала
 * срочное/просроченное, ниже спокойное.
 */
export function buildDailyPlanMessage(
  groups: PlanGroup[],
  now: Date,
  unassignedCount = 0,
): string {
  const sortedGroups = groups
    .map((g) => ({
      ...g,
      orders: g.orders.slice().sort((a, b) => priorityKey(a, now) - priorityKey(b, now)),
    }))
    // Исполнитель с самой горящей задачей — первым.
    .sort((a, b) => priorityKey(a.orders[0], now) - priorityKey(b.orders[0], now));

  const blocks = sortedGroups.map((group) => {
    const head = `<b>${mentionFor(group.executor)}</b> — ${group.orders.length} ${orderWord(group.orders.length)} в работе`;
    const lines = group.orders.map((order) => {
      const marker = orderMarker(order, now);
      return `${marker} <b>#${escapeHtml(order.numberOrder)}</b> · ${summarizeItems(order.items)} — ${orderTail(order, now)}`;
    });
    return [head, ...lines].join('\n');
  });

  const header = `🌅 <b>План на ${dayMonth(now)}</b> — доброе утро!`;
  const footer =
    unassignedCount > 0
      ? `\n⚠️ Без исполнителя в работе: <b>${unassignedCount}</b> ${orderWord(unassignedCount)} — назначьте исполнителя.`
      : '';

  return [header, '', blocks.join('\n\n'), footer].filter(Boolean).join('\n');
}

function orderWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заказ';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заказа';
  return 'заказов';
}
