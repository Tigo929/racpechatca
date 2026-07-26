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

/** Статусы «готов» — работа сдана, заказ ждёт отгрузки или выдачи. */
export const PLAN_READY_STATUSES: EnumStatus[] = [
  EnumStatus.READY,
  EnumStatus.DONE,
];

/** Способы доставки, требующие отгрузки (всё, кроме самовывоза). */
const DELIVERY_LABEL: Record<string, string> = {
  YANDEX_PVZ: 'Яндекс ПВЗ',
  OZON_PVZ: 'Ozon ПВЗ',
  OZON_SELLER: 'Ozon Продавец',
  WB_SELLER: 'WB Продавец',
  PICKUP: 'Самовывоз',
};

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

export interface ReadyOrder {
  numberOrder: string;
  deliveryMethod: string;
  items: { formatPaper: string; quantity: number }[];
}

export interface PlanGroup {
  executor: { username: string; telegramUsername: string | null };
  inWork: PlanOrder[];
  ready: ReadyOrder[];
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

/** Нужна ли отгрузка (не самовывоз). */
export function needsShipping(deliveryMethod: string): boolean {
  return deliveryMethod !== 'PICKUP';
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
  const parts = [...byFormat].map(([f, q]) => `${escapeHtml(f)} ×${q}`);
  const shown = parts.slice(0, 3).join(', ');
  return parts.length > 3 ? `${shown}, …` : shown;
}

/** Хвост строки задачи в работе: срочность + человекочитаемый срок. */
function inWorkTail(order: PlanOrder, now: Date): string {
  const label = formatDeadlineLabel(effectiveDeadline(order), now);
  return order.isUrgent ? `<b>СРОЧНО</b>, ${label}` : label;
}

/** Строка готового заказа: 🚚 отгрузить · <способ> либо 📦 самовывоз. */
function readyLine(order: ReadyOrder): string {
  const ship = needsShipping(order.deliveryMethod);
  const marker = ship ? '🚚' : '📦';
  const label = DELIVERY_LABEL[order.deliveryMethod] ?? order.deliveryMethod;
  const action = ship ? `отгрузить · ${escapeHtml(label)}` : 'самовывоз';
  return `${marker} <b>#${escapeHtml(order.numberOrder)}</b> · ${summarizeItems(order.items)} — ${action}`;
}

function dayMonth(now: Date): string {
  // moscowDateKey → «2026-07-24»; берём день и месяц.
  const [, mm, dd] = moscowDateKey(now).split('-');
  return `${dd}.${mm}`;
}

/** Ключ сортировки исполнителя: самая горящая задача в работе; без работы — в конец. */
function executorKey(group: PlanGroup, now: Date): number {
  if (group.inWork.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...group.inWork.map((o) => priorityKey(o, now)));
}

/** Упоминание диспетчера: «gts224» / «@gts224» → «@gts224» (экранируем). */
function mentionHandle(raw: string): string {
  return `@${escapeHtml(raw.trim().replace(/^@/, ''))}`;
}

/**
 * Собирает одно сообщение-план на весь день. Исполнители идут по «накалу»:
 * у кого самая горящая задача в работе — тот выше. У каждого две подсекции:
 * «в работе» (что делать, срочное сверху) и «готовы» (что отгрузить/выдать).
 * Внизу — блок нераспределённых заказов с тегом диспетчера (mention).
 */
export function buildDailyPlanMessage(
  groups: PlanGroup[],
  now: Date,
  unassigned: PlanOrder[] = [],
  mention?: string,
): string {
  const blocks = groups
    .slice()
    .sort((a, b) => executorKey(a, now) - executorKey(b, now))
    .map((group) => {
      const lines: string[] = [`👤 <b>${mentionFor(group.executor)}</b>`];

      if (group.inWork.length > 0) {
        lines.push(`🔧 В работе (${group.inWork.length}):`);
        for (const order of group.inWork
          .slice()
          .sort((a, b) => priorityKey(a, now) - priorityKey(b, now))) {
          lines.push(
            `${orderMarker(order, now)} <b>#${escapeHtml(order.numberOrder)}</b> · ${summarizeItems(order.items)} — ${inWorkTail(order, now)}`,
          );
        }
      }

      if (group.ready.length > 0) {
        lines.push(`✅ Готовы (${group.ready.length}):`);
        // Сначала то, что надо отгружать, — там больше действий; самовывоз ниже.
        for (const order of group.ready
          .slice()
          .sort(
            (a, b) =>
              (needsShipping(a.deliveryMethod) ? 0 : 1) -
              (needsShipping(b.deliveryMethod) ? 0 : 1),
          )) {
          lines.push(readyLine(order));
        }
      }

      return lines.join('\n');
    });

  // Нераспределённые — отдельным блоком снизу, с тегом диспетчера и списком
  // (срочное/просроченное сверху), чтобы их было видно и кому-то назначить.
  let unassignedBlock = '';
  if (unassigned.length > 0) {
    const tag = mention ? ` — ${mentionHandle(mention)}, назначьте` : '';
    const head = `🆓 <b>Без исполнителя (${unassigned.length})</b>${tag}:`;
    const lines = unassigned
      .slice()
      .sort((a, b) => priorityKey(a, now) - priorityKey(b, now))
      .map(
        (order) =>
          `${orderMarker(order, now)} <b>#${escapeHtml(order.numberOrder)}</b> · ${summarizeItems(order.items)} — ${inWorkTail(order, now)}`,
      );
    unassignedBlock = [head, ...lines].join('\n');
  }

  const header = `🌅 <b>План на ${dayMonth(now)}</b> — доброе утро!`;

  return [header, '', blocks.join('\n\n'), unassignedBlock]
    .filter(Boolean)
    .join('\n\n');
}
