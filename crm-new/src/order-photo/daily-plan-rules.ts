import { EnumStatus } from 'src/generated/prisma/enums';
import {
  daysUntilDeadline,
  deadlineMarker,
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
  EnumStatus.SHIPMENT_CREATED,
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

/** Незакрытая задача сотрудника — попадает в его блок плана дня. */
export interface PlanTask {
  title: string;
  deadline: Date | null;
  rewardAmount: number;
}

export interface PlanGroup {
  executor: { username: string; telegramUsername: string | null };
  inWork: PlanOrder[];
  ready: ReadyOrder[];
  /** Незакрытые задачи сотрудника. Необязательно — старые вызовы без задач. */
  tasks?: PlanTask[];
}

/** «Старший дня» по отгрузкам — кого тегаем в блоке отгрузок. */
export interface ShipmentLead {
  username: string;
  telegramUsername: string | null;
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

/** Разделитель между блоками — чтобы сообщение не читалось сплошным текстом. */
const DIVIDER = '━━━━━━━━━━━━━━━━━━';

/**
 * Расшифровка значков. Внизу сообщения: читающему не нужно держать в голове,
 * что означает каждый кружок.
 */
export const LEGEND = [
  'ℹ️ <b>Что означают значки</b>',
  '🔥 срочный · 🔴 просрочен · 🟠 сегодня · 🟡 завтра · 🟢 есть время',
  '📦 самовывоз — клиент заберёт сам · 🚚 отгрузить в ПВЗ',
  '📋 задача · ⚪ задача без срока · сумма рядом — оплата за выполнение',
].join('\n');

/**
 * Готовый к выдаче заказ (самовывоз). Способ доставки не пишем — значок 📦
 * и заголовок блока уже говорят это, а лишний текст ломает читаемость.
 */
function readyLine(order: ReadyOrder): string {
  return `📦 <code>${escapeHtml(order.numberOrder)}</code> · ${summarizeItems(order.items)}`;
}

/**
 * Строка задачи: срок и цена, если задача оплачиваемая. Цену показываем —
 * это мотивирует закрыть задачу и объясняет, откуда возьмутся деньги.
 */
function taskLine(task: PlanTask, now: Date): string {
  const marker = task.deadline ? deadlineMarker(task.deadline, now) : '⚪';
  const due = task.deadline
    ? ` — ${formatDeadlineLabel(task.deadline, now)}`
    : '';
  const reward = task.rewardAmount > 0 ? ` · ${task.rewardAmount} ₽` : '';
  return `${marker} ${escapeHtml(task.title)}${due}${reward}`;
}

/** Строка заказа в блоке отгрузок: 🚚 номер · состав — куда везти. */
function shipmentLine(order: ReadyOrder): string {
  const label = DELIVERY_LABEL[order.deliveryMethod] ?? order.deliveryMethod;
  return `🚚 <code>${escapeHtml(order.numberOrder)}</code> · ${summarizeItems(order.items)} — ${escapeHtml(label)}`;
}

/**
 * Блок «Отгрузки» для старшего дня: собирает готовые заказы, требующие поставки
 * (всё, кроме самовывоза), тегает ответственного и напоминает оформить поставки
 * и проконтролировать отгрузку. Пусто (нет таких заказов) — блока нет.
 */
export function buildShipmentBlock(
  groups: PlanGroup[],
  lead: ShipmentLead | null,
): string | null {
  const orders = groups
    .flatMap((g) => g.ready)
    .filter((o) => needsShipping(o.deliveryMethod))
    .sort((a, b) => a.numberOrder.localeCompare(b.numberOrder));
  if (orders.length === 0) return null;

  const head = lead
    ? `🚚 <b>ОТГРУЗКИ (${orders.length})</b> · старший дня: ${mentionFor(lead)}`
    : `🚚 <b>ОТГРУЗКИ (${orders.length})</b>\n⚠️ Старший дня не назначен — назначьте в Настройках.`;

  return [
    head,
    '',
    ...orders.map(shipmentLine),
    '',
    '👉 Оформи поставки и проконтролируй отгрузку.',
    'После отправки переведи заказ в «Отправлен».',
  ].join('\n');
}

function dayMonth(now: Date): string {
  // moscowDateKey → «2026-07-24»; берём день и месяц.
  const [, mm, dd] = moscowDateKey(now).split('-');
  return `${dd}.${mm}`;
}

/** «21:40» по Москве — для ручной проверки важно, на какой момент снимок. */
function moscowHm(now: Date): string {
  const m = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(m.getUTCHours())}:${pad(m.getUTCMinutes())}`;
}

/** Ключ сортировки исполнителя: самая горящая задача в работе; без работы — в конец. */
function executorKey(group: PlanGroup, now: Date): number {
  if (group.inWork.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...group.inWork.map((o) => priorityKey(o, now)));
}

function orderWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заказ';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заказа';
  return 'заказов';
}

/**
 * Собирает одно сообщение-план на весь день. Исполнители идут по «накалу»:
 * у кого самая горящая задача в работе — тот выше. У каждого две подсекции:
 * «в работе» (что делать) и «готовы к выдаче» (самовывоз — клиент заберёт сам).
 *
 * Заказы, требующие отгрузки, в блок исполнителя НЕ попадают: они целиком
 * уходят в общий блок «Отгрузки» к старшему дня — иначе один и тот же заказ
 * дублировался в сообщении дважды.
 *
 * `manual` — сообщение вызвано кнопкой, а не расписанием: тогда вместо
 * «доброе утро» ставим нейтральный заголовок проверки со временем снимка.
 */
export function buildDailyPlanMessage(
  groups: PlanGroup[],
  now: Date,
  unassignedCount = 0,
  shipmentLead: ShipmentLead | null = null,
  options: { manual?: boolean } = {},
): string {
  const blocks = groups
    .slice()
    .sort((a, b) => executorKey(a, now) - executorKey(b, now))
    .map((group) => {
      // Готовые к выдаче = только самовывоз; отгрузки ведёт старший дня.
      const readyForPickup = group.ready.filter(
        (o) => !needsShipping(o.deliveryMethod),
      );
      const tasks = group.tasks ?? [];
      // Показывать нечего — исполнителя в плане не упоминаем.
      if (
        group.inWork.length === 0 &&
        readyForPickup.length === 0 &&
        tasks.length === 0
      )
        return '';

      // Пустая строка после имени и между подсекциями — иначе блок исполнителя
      // читается сплошной простынёй.
      const lines: string[] = [`👤 <b>${mentionFor(group.executor)}</b>`];

      if (group.inWork.length > 0) {
        lines.push('', `🔧 <b>В работе (${group.inWork.length})</b>`);
        for (const order of group.inWork
          .slice()
          .sort((a, b) => priorityKey(a, now) - priorityKey(b, now))) {
          lines.push(
            `${orderMarker(order, now)} <code>${escapeHtml(order.numberOrder)}</code> · ${summarizeItems(order.items)} — ${inWorkTail(order, now)}`,
          );
        }
      }

      if (readyForPickup.length > 0) {
        lines.push('', `✅ <b>Готовы к выдаче (${readyForPickup.length})</b>`);
        for (const order of readyForPickup) {
          lines.push(readyLine(order));
        }
      }

      // Задачи висят на сотруднике, пока он их не закроет, — напоминаем.
      if (tasks.length > 0) {
        lines.push('', `📋 <b>Задачи (${tasks.length})</b>`);
        for (const task of tasks) {
          lines.push(taskLine(task, now));
        }
      }

      return lines.join('\n');
    })
    .filter(Boolean);

  const header = options.manual
    ? `🔎 <b>ПРОВЕРКА ПО ЗАКАЗАМ</b>\n${dayMonth(now)}, ${moscowHm(now)}`
    : `🌅 <b>ПЛАН НА ${dayMonth(now)}</b>\nДоброе утро!`;
  const shipmentBlock = buildShipmentBlock(groups, shipmentLead);
  const unassigned =
    unassignedCount > 0
      ? `⚠️ <b>Без исполнителя: ${unassignedCount} ${orderWord(unassignedCount)}</b>\nНазначьте исполнителя, иначе заказ не попадёт ни к кому в план.`
      : '';

  // Каждый смысловой блок отделён линией и пустыми строками — так сообщение
  // читается по частям, а не одним потоком.
  const sections = [
    ...blocks,
    ...(shipmentBlock ? [shipmentBlock] : []),
    ...(unassigned ? [unassigned] : []),
    LEGEND,
  ];

  return [header, ...sections.flatMap((s) => [DIVIDER, s])].join('\n\n');
}
