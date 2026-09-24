/**
 * Происхождение заказа (этап 17).
 *
 * Один вопрос: откуда заказ ВЗЯЛСЯ. Сайт сам создал заявку — `WEBSITE`;
 * сотрудник завёл заказ руками в CRM — канал, который он выбрал (по умолчанию
 * `AVITO`); про старый заказ доказательств нет — `UNKNOWN`.
 *
 * Это НЕ источник рекламы. Откуда человек пришёл на сайт (Яндекс.Директ,
 * поиск, переход, прямой заход, UTM, yclid, ClientID) — отдельное измерение,
 * оно живёт своими полями заказа и своими разделами аналитики. Смешивать их
 * нельзя: «выручка Avito» ничего не говорит о работе сайта, а конверсия сайта,
 * посчитанная по всем заказам CRM, завышена ровно на ручные заказы.
 */

/** Канонический набор значений происхождения — порядок для отчётов и таблиц. */
export const ORDER_ORIGINS = [
  'WEBSITE',
  'AVITO',
  'OZON',
  'WB',
  'LOCAL',
  'UNKNOWN',
] as const;

export type OrderOrigin = (typeof ORDER_ORIGINS)[number];

/**
 * Что ставится ручному заказу, если источник не выбран.
 *
 * Сегодня почти весь ручной поток — Avito, поэтому спрашивать каждый раз
 * бессмысленно. Значение именно поэтому отдельная константа, а не `'AVITO'`
 * в трёх местах кода: когда ручной поток станет смешанным, меняется одна
 * строка, а не смысл всей модели.
 */
export const MANUAL_DEFAULT_ORIGIN: OrderOrigin = 'AVITO';

/**
 * Префикс `externalRequestId` у заявок сайта.
 *
 * Идентификатор строит сервер сайта (`buildLeadId`), CRM не выдаёт его
 * никому другому: ни одна ручная форма CRM его не заполняет. Поэтому это
 * техническое доказательство происхождения, а не догадка.
 */
export const SITE_LEAD_ID_PREFIX = 'web-photo-';

export function isSiteLeadId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(SITE_LEAD_ID_PREFIX);
}

/** Известен ли такой источник модели. */
export function isOrderOrigin(value: unknown): value is OrderOrigin {
  return (
    typeof value === 'string' &&
    (ORDER_ORIGINS as readonly string[]).includes(value)
  );
}

/**
 * Значение из базы → происхождение для аналитики. Неизвестное значение не
 * выбрасывается и не приписывается к каналу — оно честно становится UNKNOWN.
 */
export function originOf(sourceOrder: string | null | undefined): OrderOrigin {
  return isOrderOrigin(sourceOrder) ? sourceOrder : 'UNKNOWN';
}

/** Чем доказано происхождение исторического заказа. */
export type OriginProof =
  /** Заявку создал сайт: его идентификатор в externalRequestId. */
  | 'SITE_LEAD_ID'
  /** Источник уже сохранён явно (выбран сотрудником или поставлен сервером). */
  | 'STORED_ORIGIN'
  /** Доказательств нет: значение неоднозначно по истории. */
  | 'NOT_PROVEN'
  /** Сохранённый источник противоречит техническому признаку. */
  | 'CONFLICT';

export interface HistoricalOriginInput {
  sourceOrder: string | null;
  externalRequestId: string | null;
}

export interface HistoricalOriginVerdict {
  origin: OrderOrigin;
  proof: OriginProof;
  /** Нужна ли запись в базу (значение отличается от сохранённого). */
  changed: boolean;
  /** Человеческое объяснение — идёт в вывод CLI и в отчёт Reviewer. */
  reason: string;
}

/**
 * Классификация СТАРОГО заказа. Правило одно: без доказательства — UNKNOWN.
 *
 * Отсутствие ClientID, UTM или yclid ничего не доказывает: их нет и у заявок
 * сайта, пришедших без рекламы. Поэтому «нет атрибуции → Avito» здесь
 * невозможно: так можно приписать сайту чужие заказы и наоборот.
 *
 * `LOCAL` до этапа 17 имел двойной смысл: его писал сайт всем своим заявкам,
 * и его же мог выбрать сотрудник для «местного» заказа. Поэтому сохранённый
 * `LOCAL` сам по себе не доказывает ничего — доказывает только идентификатор
 * заявки сайта.
 */
export function classifyHistoricalOrigin(
  row: HistoricalOriginInput,
): HistoricalOriginVerdict {
  const stored = row.sourceOrder;
  const site = isSiteLeadId(row.externalRequestId);
  const verdict = (
    origin: OrderOrigin,
    proof: OriginProof,
    reason: string,
  ): HistoricalOriginVerdict => ({
    origin,
    proof,
    changed: origin !== stored,
    reason,
  });

  if (site) {
    // Технический признак сильнее сохранённого значения, но чужой явный
    // канал молча не затирается: такой заказ уходит в конфликты на разбор.
    if (stored === 'AVITO' || stored === 'OZON' || stored === 'WB') {
      return {
        origin: originOf(stored),
        proof: 'CONFLICT',
        changed: false,
        reason: `сохранён канал ${String(stored)}, но есть идентификатор заявки сайта — требуется ручной разбор`,
      };
    }
    return verdict(
      'WEBSITE',
      'SITE_LEAD_ID',
      'заявку создал сайт: идентификатор web-photo в externalRequestId',
    );
  }

  if (stored === 'WEBSITE')
    return verdict(
      'WEBSITE',
      'STORED_ORIGIN',
      'происхождение уже сохранено сервером',
    );
  if (stored === 'AVITO' || stored === 'OZON' || stored === 'WB')
    return verdict(
      originOf(stored),
      'STORED_ORIGIN',
      'канал выбран при создании заказа в CRM',
    );
  if (stored === 'LOCAL')
    return verdict(
      'UNKNOWN',
      'NOT_PROVEN',
      'LOCAL до этапа 17 означал и заявку сайта, и ручной «местный» заказ — доказательства нет',
    );
  return verdict(
    'UNKNOWN',
    'NOT_PROVEN',
    'источник не сохранён и техническими признаками не доказан',
  );
}
