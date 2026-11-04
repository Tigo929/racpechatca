import {
  EnumDeliveryMethod,
  EnumProductCategory,
  EnumStatus,
} from 'src/generated/prisma/enums';

/** Доставка (ПВЗ и т.п.): просим отзыв через 3,5 дня после отправки. */
export const REVIEW_REMINDER_DELAY_MS = 84 * 60 * 60 * 1000; // 3.5 days

/** Самовывоз: клиент получил заказ сразу — просим отзыв уже на следующий день. */
export const REVIEW_REMINDER_PICKUP_DELAY_MS = 24 * 60 * 60 * 1000; // 1 day


export const REVIEW_REMINDER_CATEGORIES: EnumProductCategory[] = [
  EnumProductCategory.PHOTO,
  EnumProductCategory.TSHIRT,
  EnumProductCategory.CANVAS,
];

export const REVIEW_REMINDER_STATUSES: EnumStatus[] = [
  EnumStatus.SENT,
  EnumStatus.PAID,
];

/**
 * Сколько ждём автоматическую отправку, прежде чем позвать человека.
 *
 * Просьбу об отзыве отправляет живой аккаунт (воркер), и обычно это
 * занимает секунды. Но воркер может стоять: перевыпускают сессию, упал
 * контейнер, Telegram ограничил частоту. Если молча ждать его вечно,
 * просьба не уйдёт вообще, и мы даже не узнаем — поэтому через этот срок
 * заказ попадает в обычное напоминание владельцу, и тот пишет руками.
 */
export const REVIEW_AUTOSEND_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * С какого момента уместно просить отзыв.
 *
 * У заказа с площадки это выкуп, у своего — наша отправка. Одна функция
 * на оба пути: по этой же дате считается и ожидание автоматики, и
 * «пора звать человека».
 */
export function reviewDueAt(order: {
  isMarketplacePrint?: boolean | null;
  marketplaceDeliveredAt?: Date | null;
  sentAt: Date | null;
}): Date | null {
  return order.isMarketplacePrint
    ? (order.marketplaceDeliveredAt ?? null)
    : (order.sentAt ?? null);
}

/**
 * Ждём ли мы ещё, что просьба уйдёт клиенту сама.
 *
 * Пока ждём, владельца не трогаем: иначе он отправит просьбу руками, а
 * через минуту её же отправит автоматика — и клиент получит одно и то же
 * сообщение дважды.
 */
export function waitsForAutoReview(
  order: {
    clientTelegram?: string | null;
    reviewRequestStatus?: string | null;
    isMarketplacePrint?: boolean | null;
    marketplaceDeliveredAt?: Date | null;
    sentAt: Date | null;
  },
  now = new Date(),
): boolean {
  if (!order.clientTelegram) return false;
  // Попытка уже была: удачная закрывает вопрос, неудачная — повод позвать
  // человека, а не ждать дальше.
  if (order.reviewRequestStatus) return false;
  const due = reviewDueAt(order);
  if (!due) return false;
  return due.getTime() > now.getTime() - REVIEW_AUTOSEND_GRACE_MS;
}

export function reviewReminderDelayMs(
  deliveryMethod: EnumDeliveryMethod,
): number {
  return deliveryMethod === EnumDeliveryMethod.PICKUP
    ? REVIEW_REMINDER_PICKUP_DELAY_MS
    : REVIEW_REMINDER_DELAY_MS;
}

export function isReviewReminderEligible(
  order: {
    productCategory: EnumProductCategory;
    status: EnumStatus;
    deliveryMethod: EnumDeliveryMethod;
    clientReviewLeft: boolean;
    reviewReminderNotifiedAt: Date | null;
    sentAt: Date | null;
    /** Заказ с площадки: отсчёт не от нашей отправки, а от выкупа. */
    isMarketplacePrint?: boolean | null;
    /** Когда площадка сообщила, что покупатель забрал посылку. */
    marketplaceDeliveredAt?: Date | null;
  },
  now = new Date(),
): boolean {
  if (!REVIEW_REMINDER_CATEGORIES.includes(order.productCategory)) return false;
  if (order.clientReviewLeft) return false;
  if (order.reviewReminderNotifiedAt) return false;

  /*
   * Заказ с площадки идёт своим путём, и общее правило к нему не подходит.
   *
   * У него SENT означает «передан в производство», а не «отдан клиенту»:
   * по общему правилу просьба об отзыве уходила бы через 3,5 дня после
   * передачи в печать — человеку, который ещё ничего не получил.
   *
   * До 03.11.2026 здесь стоял таймер: пять дней от «Отгружен». Он промахивался
   * в обе стороны. Заказ закрывается, как только площадка взяла посылку, —
   * дальше её могут везти два дня, а могут десять, и ещё столько же она лежит
   * в пункте выдачи. Кого-то спрашивали «как вам футболка» до того, как он её
   * забрал; кому-то писали через неделю после.
   *
   * Теперь ждём события, а не срока: площадка сама говорит «Доставлен» —
   * покупатель забрал заказ. Эту дату ставит сверка с Ozon
   * (OzonShippedCloseService), и спрашивать есть о чём ровно с неё.
   *
   * Цена решения: о выкупе мы узнаём только от площадки. Отозвали ключи
   * кабинета — отметки не будет, и просьба не уйдёт вовсе. Это сознательный
   * выбор: не спросить хуже, чем спросить не вовремя, но ненамного — а вот
   * «как вам товар» человеку без товара стоит доверия.
   */
  if (order.isMarketplacePrint) {
    return Boolean(order.marketplaceDeliveredAt);
  }

  if (!REVIEW_REMINDER_STATUSES.includes(order.status)) return false;
  // У холстов SENT = передали подрядчику, а не клиенту. Просим отзыв только
  // после закрытия заказа.
  if (
    order.productCategory === EnumProductCategory.CANVAS &&
    order.status === EnumStatus.SENT
  ) {
    return false;
  }
  if (!order.sentAt) return false;

  const delay = reviewReminderDelayMs(order.deliveryMethod);
  return order.sentAt <= new Date(now.getTime() - delay);
}
