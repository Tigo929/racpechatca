import { EnumTaskStatus } from 'src/generated/prisma/enums';

/**
 * Правила ежедневного дайджеста задач. Вынесены отдельно от сервиса и не
 * трогают ни базу, ни сеть — так их можно проверить тестами целиком.
 */

/** Час по Москве, в который уходит дайджест. */
export const DIGEST_HOUR = 10;

/**
 * За сколько дней до срока задача начинает напоминать о себе.
 * Без этого порога задача с дедлайном через два месяца пинговала бы чат
 * шестьдесят дней подряд — и её перестали бы замечать вместе со всем чатом.
 */
export const REMIND_LEAD_DAYS = 3;

/** Статусы, которые считаются незакрытыми. */
export const OPEN_TASK_STATUSES: EnumTaskStatus[] = [
  EnumTaskStatus.OPEN,
  EnumTaskStatus.IN_PROGRESS,
];

// В России нет перехода на летнее время с 2014 года, поэтому фиксированный
// сдвиг корректен. Считаем его явно, а не через TZ процесса: так дайджест
// уходит в 10:00 по Москве независимо от настроек сервера и тестовой машины.
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

function toMoscow(date: Date): Date {
  return new Date(date.getTime() + MOSCOW_OFFSET_MS);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Ключ дня по Москве в формате YYYY-MM-DD — по нему защищаемся от повторов. */
export function moscowDateKey(date: Date): string {
  const m = toMoscow(date);
  return `${m.getUTCFullYear()}-${pad(m.getUTCMonth() + 1)}-${pad(m.getUTCDate())}`;
}

/** Час по Москве (0–23). */
export function moscowHour(date: Date): number {
  return toMoscow(date).getUTCHours();
}

/**
 * Разница в календарных днях по Москве: 0 — сегодня, 1 — завтра,
 * отрицательное — просрочено. Именно календарных, а не «24 часа»: задача
 * со сроком сегодня в 23:00 должна показываться как «сегодня», а не «завтра».
 */
export function daysUntilDeadline(deadline: Date, now: Date): number {
  const a = toMoscow(deadline);
  const b = toMoscow(now);
  const aMidnight = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bMidnight = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((aMidnight - bMidnight) / 86_400_000);
}

export interface RemindableTask {
  status: EnumTaskStatus;
  deadline: Date | null;
}

/** Попадает ли задача в сегодняшний дайджест. */
export function isTaskDueForReminder(task: RemindableTask, now: Date): boolean {
  if (!OPEN_TASK_STATUSES.includes(task.status)) return false;
  // Задачи без срока живут в списке, но чат не трогают.
  if (!task.deadline) return false;
  return daysUntilDeadline(task.deadline, now) <= REMIND_LEAD_DAYS;
}

/** Человеческая подпись срока: «просрочено на 2 дня», «сегодня», «до 25.07». */
export function formatDeadlineLabel(deadline: Date, now: Date): string {
  const days = daysUntilDeadline(deadline, now);
  if (days < 0) {
    const overdue = Math.abs(days);
    return `просрочено на ${overdue} ${pluralDays(overdue)}`;
  }
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  const m = toMoscow(deadline);
  return `до ${pad(m.getUTCDate())}.${pad(m.getUTCMonth() + 1)}`;
}

/** Маркер срочности перед задачей. */
export function deadlineMarker(deadline: Date, now: Date): string {
  const days = daysUntilDeadline(deadline, now);
  if (days < 0) return '🔴';
  if (days === 0) return '🟡';
  return '⚪';
}

export function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Как обратиться к ответственному в чате. Ник с @ создаёт настоящее
 * упоминание с уведомлением; без ника остаётся только имя из CRM —
 * человек в чате его увидит, но пуш не придёт.
 */
export function mentionFor(user: {
  username: string;
  telegramUsername: string | null;
}): string {
  const tg = user.telegramUsername?.trim().replace(/^@/, '');
  return tg ? `@${escapeHtml(tg)}` : escapeHtml(user.username);
}

export interface DigestTask {
  title: string;
  deadline: Date;
  orderNumber?: string | null;
}

export interface DigestGroup {
  assignee: { username: string; telegramUsername: string | null };
  tasks: DigestTask[];
}

/**
 * Собирает одно сообщение на весь день вместо письма на каждую задачу.
 * Бот уже пишет в этот чат про заказы и отзывы — отдельные сообщения по
 * задачам утопили бы всё остальное.
 */
export function buildDigestMessage(groups: DigestGroup[], now: Date): string {
  const m = toMoscow(now);
  const header = `📋 <b>Задачи на ${pad(m.getUTCDate())}.${pad(m.getUTCMonth() + 1)}</b>`;
  const blocks = groups.map((group) => {
    const lines = group.tasks
      .slice()
      .sort(
        (a, b) =>
          daysUntilDeadline(a.deadline, now) - daysUntilDeadline(b.deadline, now),
      )
      .map((task) => {
        const marker = deadlineMarker(task.deadline, now);
        const label = formatDeadlineLabel(task.deadline, now);
        const order = task.orderNumber
          ? ` (заказ ${escapeHtml(task.orderNumber)})`
          : '';
        return `  ${marker} ${escapeHtml(task.title)}${order} — ${label}`;
      });
    return [`${mentionFor(group.assignee)}`, ...lines].join('\n');
  });
  return [header, '', ...blocks].join('\n');
}
