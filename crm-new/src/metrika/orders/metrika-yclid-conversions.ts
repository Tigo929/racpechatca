/**
 * Офлайн-конверсии по метке клика Директа (yclid).
 *
 * Зачем второй канал. Судьбу заказа мы возвращаем в Метрику загрузкой
 * заказов CDP, и она опирается на ClientID. Но ClientID есть не всегда:
 * счётчик грузится только после согласия на cookie, и у части заявок его
 * нет вовсе. При этом у заявки из Директа есть yclid — метка клика, которая
 * приходит прямо в адресе страницы и от согласия не зависит.
 *
 * Такой заказ сегодня пропускается с причиной `no_client_id`: Директ не
 * узнаёт, что его клик закончился оплаченным заказом, и продолжает
 * оптимизироваться вслепую. Этот канал закрывает дыру: конверсия
 * загружается по yclid отдельным запросом
 * (POST /management/v1/counter/{id}/offline_conversions/upload?client_id_type=YCLID).
 *
 * Почему отдельная цель, а не те же «CRM: Заказ оплачен».
 * Цели CDP достигаются самой загрузкой заказов. Если по тому же событию
 * загрузить ещё и офлайн-конверсию на ту же цель, Метрика засчитает её
 * дважды: у заказов с ClientID появится двойная конверсия, а Директ будет
 * обучаться на завышенном числе. Поэтому канал требует ОТДЕЛЬНЫХ целей,
 * заведённых владельцем в кабинете, и без них не включается.
 *
 * Выключен по умолчанию: пока в настройках нет идентификаторов целей,
 * ни одного запроса наружу не уходит.
 */

import type { MetrikaOrderStatus } from './metrika-order-status';

/** Метка клика Директа: набор цифр/букв, приходит в адресе страницы. */
const YCLID_RE = /^[0-9A-Za-z_-]{6,64}$/;

export function isValidYclid(value: string | null | undefined): boolean {
  return typeof value === 'string' && YCLID_RE.test(value.trim());
}

/**
 * Идентификаторы целей для офлайн-конверсий.
 *
 * Ключи — те же переходы заказа, что и у загрузки CDP. Пустая строка
 * означает «цели для этого перехода нет» — такой переход по yclid не
 * отправляется вовсе, а не подставляет чужую цель.
 */
export interface YclidConversionTargets {
  CREATED: string;
  PAID: string;
  CANCELLED: string;
}

export const NO_YCLID_TARGETS: YclidConversionTargets = {
  CREATED: '',
  PAID: '',
  CANCELLED: '',
};

/** Настройки канала из окружения; пусто — канал выключен. */
export function yclidTargetsFromEnv(
  env: Record<string, string | undefined>,
): YclidConversionTargets {
  return {
    CREATED: (env.YANDEX_METRIKA_YCLID_TARGET_CREATED ?? '').trim(),
    PAID: (env.YANDEX_METRIKA_YCLID_TARGET_PAID ?? '').trim(),
    CANCELLED: (env.YANDEX_METRIKA_YCLID_TARGET_CANCELLED ?? '').trim(),
  };
}

export function yclidChannelEnabled(targets: YclidConversionTargets): boolean {
  return Boolean(targets.CREATED || targets.PAID || targets.CANCELLED);
}

/** Цель перехода; пусто — этот переход по yclid не отправляем. */
export function targetFor(
  status: MetrikaOrderStatus,
  targets: YclidConversionTargets,
): string {
  if (status === 'PAID') return targets.PAID;
  if (status === 'CANCELLED') return targets.CANCELLED;
  // Остальные переходы (создание и работа над заказом) — «заказ создан».
  return targets.CREATED;
}

export interface YclidConversionRow {
  yclid: string;
  target: string;
  /** Момент конверсии — unix-секунды, как требует API. */
  dateTime: number;
  /** Ценность конверсии, ₽; 0 — без суммы. */
  price: number;
}

export const YCLID_CONVERSION_HEADER = [
  'Yclid',
  'Target',
  'DateTime',
  'Price',
  'Currency',
] as const;

export const CONVERSION_CURRENCY = 'RUB';

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildYclidConversionsCsv(rows: YclidConversionRow[]): string {
  const lines = rows.map((r) =>
    [
      csvEscape(r.yclid),
      csvEscape(r.target),
      String(r.dateTime),
      String(Math.max(0, Math.round(r.price))),
      CONVERSION_CURRENCY,
    ].join(','),
  );
  return [YCLID_CONVERSION_HEADER.join(','), ...lines].join('\n') + '\n';
}
