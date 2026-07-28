import { moscowHour } from 'src/tasks/task-reminder-rules';

/**
 * Ручная «сводка по заказам» в рабочий чат — те же цифры, что раньше стояли
 * карточками на странице заказов (их убрали из интерфейса, но не из бизнеса:
 * админ утром проверяет, что творится, вечером — что сделано за день).
 * Чистая функция без БД и сети — берёт уже посчитанный OrderPhotoService.getOrderStats.
 */

export interface StatusSummaryInput {
  activeCount: number;
  matchingTotal: number;
  leadCount: number;
  newCount: number;
  inProgressCount: number;
  readyCount: number;
  sentUnpaidCount: number;
  sentUnpaidAmount: number | null;
  paidCount: number;
  reviewPendingCount: number | null;
  reviewRemindedCount: number | null;
  overdueCount: number;
  urgentCount: number;
  alertCount: number;
  byProduct: { PHOTO: number; TSHIRT: number };
}

/** Приветствие по часу — так видно, утренняя сводка это или вечерняя. */
export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

/** «28.07 14:35» по Москве — независимо от TZ сервера/тестовой машины. */
function moscowDateTimeLabel(date: Date): string {
  const m = new Date(date.getTime() + MOSCOW_OFFSET_MS);
  return `${pad(m.getUTCDate())}.${pad(m.getUTCMonth() + 1)} ${pad(m.getUTCHours())}:${pad(m.getUTCMinutes())}`;
}

function money(n: number): string {
  return `${n.toLocaleString('ru-RU')} ₽`;
}

export function buildStatusSummaryMessage(
  stats: StatusSummaryInput,
  now: Date,
): string {
  const greeting = greetingForHour(moscowHour(now));
  const header = `📊 <b>Сводка по заказам</b> — ${greeting}, ${moscowDateTimeLabel(now)}`;

  const lines: string[] = [
    header,
    '',
    `📷 Фото: <b>${stats.byProduct.PHOTO}</b> · 👕 Футболки: <b>${stats.byProduct.TSHIRT}</b>`,
    '',
    `🔔 Обращения: <b>${stats.leadCount}</b>`,
    `🆕 Новых: <b>${stats.newCount}</b>`,
    `🔧 В работе: <b>${stats.inProgressCount}</b>`,
    `✅ Готовы к отгрузке/выдаче: <b>${stats.readyCount}</b>`,
    stats.sentUnpaidAmount !== null && stats.sentUnpaidAmount > 0
      ? `🚚 Отправлено, не оплачено: <b>${stats.sentUnpaidCount}</b> · ${money(stats.sentUnpaidAmount)}`
      : `🚚 Отправлено, не оплачено: <b>${stats.sentUnpaidCount}</b>`,
    `💰 Оплачено: <b>${stats.paidCount}</b>`,
  ];

  if (stats.alertCount > 0) {
    lines.push(
      '',
      `⚠️ Требуют внимания: <b>${stats.alertCount}</b> (${stats.overdueCount} просроч. · ${stats.urgentCount} сроч.)`,
    );
  }

  if (stats.reviewPendingCount !== null && stats.reviewPendingCount > 0) {
    lines.push(
      '',
      `⭐ Без отзыва: <b>${stats.reviewPendingCount}</b> (${stats.reviewRemindedCount ?? 0} уже напомнили)`,
    );
  }

  lines.push(
    '',
    `Активных всего: <b>${stats.activeCount}</b> из ${stats.matchingTotal} в списке`,
  );

  return lines.join('\n');
}
