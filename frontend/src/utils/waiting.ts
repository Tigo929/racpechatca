import type { EnumStatus } from '../types/index';

/**
 * Сколько заявка ждёт ответа.
 *
 * Человек оставил заявку и сидит у телефона: первые минуты решают, купит
 * он у нас или у того, кто ответил быстрее. По списку заказов этого не
 * видно — там стоит дата «16 окт», одинаковая и для заявки десятиминутной
 * давности, и для вчерашней.
 *
 * Поэтому у необработанной заявки показываем не дату, а время ожидания,
 * и красим его: цвет читается раньше, чем цифра.
 *
 * Счётчик идёт только у обращения. Как только заявку приняли в работу
 * (статус перестал быть LEAD), ожидание закончилось — дальше у заказа
 * свой срок, и второй таймер рядом с ним только путал бы.
 */

export interface WaitingOrder {
  status: EnumStatus;
  createdAt: string;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Пороги ожидания. Подобраны под живой разговор, а не под рабочий день. */
export const WAITING_STEPS = {
  /** До десяти минут — нормальная скорость ответа. */
  fresh: 10 * MINUTE,
  /** До получаса — пора ответить. */
  soon: 30 * MINUTE,
  /** До двух часов — человек уже ждёт долго. */
  late: 2 * HOUR,
} as const;

export type WaitingTone = 'fresh' | 'soon' | 'late' | 'lost';

/**
 * Сколько миллисекунд заявка ждёт. null — счётчик не нужен: заявку уже
 * взяли в работу либо дата неразборчива.
 */
export function waitingMs(
  order: WaitingOrder,
  now: number = Date.now(),
): number | null {
  if (order.status !== 'LEAD') return null;
  const created = new Date(order.createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  // Часы клиента и сервера расходятся: отрицательное ожидание показываем
  // как нулевое, а не как «-3 мин».
  return Math.max(0, now - created);
}

/** Цветовая ступень ожидания. */
export function waitingTone(ms: number): WaitingTone {
  if (ms < WAITING_STEPS.fresh) return 'fresh';
  if (ms < WAITING_STEPS.soon) return 'soon';
  if (ms < WAITING_STEPS.late) return 'late';
  return 'lost';
}

/**
 * Подпись ожидания: «только что», «7 мин», «2 ч 15 мин», «1 д 3 ч».
 *
 * Секунды не показываем: бегущие цифры заставляют смотреть на них, а не
 * на заявку. Минуты обновляются сами — этого достаточно.
 */
export function formatWaiting(ms: number): string {
  if (ms < MINUTE) return 'только что';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} мин`;
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  }
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  return hours > 0 ? `${days} д ${hours} ч` : `${days} д`;
}

/** Классы бейджа под ступень — те же цвета, что у остальных отметок списка. */
export function waitingClass(tone: WaitingTone): string {
  if (tone === 'fresh') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (tone === 'soon') return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (tone === 'late') return 'bg-orange-50 text-orange-700 border border-orange-200';
  return 'bg-red-50 text-red-700 border border-red-200';
}

/** Пояснение при наведении: что именно означает счётчик. */
export function waitingTitle(ms: number): string {
  return `Заявка пришла ${formatWaiting(ms)} назад и ещё не принята в работу`;
}
