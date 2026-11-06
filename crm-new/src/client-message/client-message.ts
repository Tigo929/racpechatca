/**
 * Сообщения клиенту: подтверждение заказа и готовность.
 *
 * Один конвейер на оба сообщения. Состав заказа, суммы, реквизиты и подпись
 * собираются из одних и тех же блоков; отличается только то, что обязано
 * отличаться: заголовок, блок оплаты, условия выдачи и финальная просьба.
 *
 * ПОЧЕМУ НА СЕРВЕРЕ. Раньше текст собирался в браузере и уходил клиенту
 * руками менеджера. Счёт после ответа «да» отправляется сам, без открытой
 * карточки, — значит собирать текст должен сервер. Фронт теперь спрашивает
 * готовый текст у него же (`GET /order-photo/:id/client-message`), поэтому
 * сообщение, отправленное автоматом, и сообщение, скопированное из карточки,
 * совпадают дословно.
 *
 * ЧТО СЮДА НЕЛЬЗЯ КЛАСТЬ. Это текст, который уходит покупателю в Telegram,
 * Авито и MAX. Значит — никакой разметки, кроме той, что работает
 * в конкретном канале (обратные кавычки только в Telegram), и ни одного
 * служебного слова из CRM. Внутренние предупреждения место имеют
 * в интерфейсе менеджера, а не в сообщении клиенту.
 */

import { computePrepayment } from 'src/order-photo/prepayment';
import {
  businessConfig,
  formatOrderNumberForClient,
  formatPaymentPhoneForClient,
  resolvePickupAddress,
} from './business';

/** Какое из двух сообщений собираем. */
export type ClientMessageKind = 'CONFIRMATION' | 'READY';

/**
 * Что нужно знать о заказе, чтобы собрать сообщение.
 *
 * Структурный тип, а не модель Prisma: так видно, какие поля действительно
 * нужны, и запрос к базе можно сузить до них.
 */
export interface ClientMessageOrder {
  numberOrder: string;
  marketplaceOrderNumber?: string | null;
  communicationPlatform?: string | null;
  productCategory?: string | null;
  status?: string | null;
  deliveryMethod: string;
  deliveryCost?: number | null;
  discountAmount?: number | null;
  designDevelopmentCost?: number | null;
  urgencyFee?: number | null;
  totalOrder?: number | null;
  prepaidAmount?: number | null;
  isUrgent?: boolean | null;
  isFreePrice?: boolean | null;
  createdAt?: Date | string | null;
  executor?: { username: string } | null;
  items?: {
    formatPaper: string;
    typePaper?: string | null;
    quantity?: number | null;
    price?: number | null;
    pricePosition?: number | null;
    isFreePrice?: boolean | null;
  }[];
  tshirtItems?: {
    color: string;
    size: string;
    quantity?: number | null;
    pricePosition?: number | null;
  }[];
  canvasItems?: {
    formatCanvas: string;
    quantity?: number | null;
    pricePosition?: number | null;
  }[];
}

type PhotoItem = NonNullable<ClientMessageOrder['items']>[number];

const SEPARATOR = '─────────────────';

/** Месяцы в родительном падеже — для «11–12 сентября». */
const RU_MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/** Подписи способов доставки — те же, что видит менеджер в панели. */
const DELIVERY_LABELS: Record<string, string> = {
  YANDEX_PVZ: 'Яндекс ПВЗ',
  OZON_PVZ: 'Ozon ПВЗ',
  PICKUP: 'Самовывоз',
  PRODUCTION_MSK: 'Доставка в пределах МКАД',
  OZON_SELLER: 'Ozon Продавец',
  WB_SELLER: 'WB Продавец',
};

/** Размеры футболок так, как их называют покупателю. */
const TSHIRT_SIZE_LABELS: Record<string, string> = {
  XS: 'XS(44)',
  S: 'S(46)',
  M: 'M(48)',
  L: 'L(50)',
  XL: 'XL(52)',
  XXL: 'XXL(54)',
  XXXL: 'XXXL(56)',
};

/**
 * Неразрывный пробел — тот же, что ставит toLocaleString между разрядами.
 * Им же привязан знак валюты: иначе «1 500 ₽» переносится в чате посреди
 * числа. Задаём кодом, а не символом: в редакторе он неотличим от обычного
 * пробела, и потерять его при правке — вопрос времени.
 */
const NBSP = String.fromCharCode(0xa0);

/** Рубли для сообщения клиенту. */
function money(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')}${NBSP}₽`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function isFreeFormPhotoItem(
  order: ClientMessageOrder,
  item: PhotoItem,
): boolean {
  if (order.isFreePrice || item.isFreePrice) return true;
  return (item.pricePosition ?? 0) !== (item.price ?? 0) * (item.quantity ?? 0);
}

function photoItemLine(order: ClientMessageOrder, item: PhotoItem): string {
  if (isFreeFormPhotoItem(order, item)) {
    return `• ${item.formatPaper} × ${item.quantity} шт — ${money(item.pricePosition ?? 0)}`;
  }
  const type = item.typePaper === 'GLOSS' ? 'Глянец' : 'Матт';
  return `• ${item.formatPaper} (${type}) × ${item.quantity} шт — ${money(item.pricePosition ?? 0)}`;
}

/**
 * Состав заказа — одинаково в обоих сообщениях.
 *
 * Дизайн и срочность идут такими же строками состава: клиент за них платит,
 * и без них «сумма по позициям» не сходится с «итого к оплате».
 */
function compositionLines(order: ClientMessageOrder): string[] {
  const lines: string[] = [];
  for (const item of order.items ?? []) {
    lines.push(photoItemLine(order, item));
  }
  for (const item of order.tshirtItems ?? []) {
    lines.push(
      `• Футболка ${item.color}, р-р ${TSHIRT_SIZE_LABELS[item.size] ?? item.size} × ${item.quantity} шт — ${money(item.pricePosition ?? 0)}`,
    );
  }
  for (const item of order.canvasItems ?? []) {
    lines.push(
      `• Холст ${item.formatCanvas} × ${item.quantity} шт — ${money(item.pricePosition ?? 0)}`,
    );
  }
  const designCost = order.designDevelopmentCost ?? 0;
  if (designCost > 0) {
    lines.push(`• Разработка дизайна — ${money(designCost)}`);
  }
  const urgencyFee = order.urgencyFee ?? 0;
  if (urgencyFee > 0) {
    lines.push(`• Срочное изготовление — ${money(urgencyFee)}`);
  }
  return lines;
}

/** Сумма всего, что перечислено в составе. */
function compositionTotal(order: ClientMessageOrder): number {
  const positions = [
    ...(order.items ?? []),
    ...(order.tshirtItems ?? []),
    ...(order.canvasItems ?? []),
  ].reduce((sum, item) => sum + (item.pricePosition ?? 0), 0);
  return (
    positions + (order.designDevelopmentCost ?? 0) + (order.urgencyFee ?? 0)
  );
}

/** Блок денег: позиции, скидка, доставка, итог. Одинаков в обоих сообщениях. */
function totalsLines(order: ClientMessageOrder): string[] {
  const delivery = order.deliveryCost ?? 0;
  const discount = order.discountAmount ?? 0;
  const deliveryLabel =
    DELIVERY_LABELS[order.deliveryMethod] ?? order.deliveryMethod;
  return [
    `💰 Сумма по позициям: ${money(compositionTotal(order))}`,
    // Скидку называем отдельной строкой: иначе клиент видит «итого» меньше
    // суммы позиций и не понимает, откуда разница.
    ...(discount > 0 ? [`🎁 Скидка: −${money(discount)}`] : []),
    ...(delivery > 0
      ? [`🚚 Доставка (${deliveryLabel}): ${money(delivery)}`]
      : []),
    `📦 Итого к оплате: ${money(order.totalOrder ?? 0)}`,
  ];
}

/**
 * Предоплата, которую называем клиенту, и остаток от неё.
 *
 * Ключевое правило: клиенту мы называем ровно то, что пообещали ему
 * в подтверждении заказа. Если менеджер записал фактически внесённую сумму —
 * считаем от неё. Если не записал, остаётся ориентир 50%, названный при
 * оформлении, и сообщение о готовности повторяет тот же расчёт.
 */
export function clientPrepayment(order: ClientMessageOrder): {
  prepaid: number;
  balanceDue: number;
  recorded: boolean;
} {
  return computePrepayment(order.totalOrder ?? 0, order.prepaidAmount);
}

/**
 * Показать менеджеру, что фактическая предоплата не записана.
 *
 * Сообщение клиенту при этом остаётся правильным — в нём стоит ориентир 50%,
 * обещанный при оформлении. Но проверить поступление перед выдачей нужно,
 * и место этой проверки — карточка заказа.
 */
export function prepaymentNeedsAttention(order: ClientMessageOrder): boolean {
  if (order.status === 'PAID' || order.status === 'COMPLETED') return false;
  return order.prepaidAmount === null || order.prepaidAmount === undefined;
}

/** Блок оплаты. Единственное место, где сообщения расходятся по смыслу. */
function paymentLines(
  order: ClientMessageOrder,
  kind: ClientMessageKind,
): string[] {
  const { prepaid, balanceDue, recorded } = clientPrepayment(order);
  const isPickup = order.deliveryMethod === 'PICKUP';

  // Как называем первый платёж: записанную сумму — как внесённую, ориентир —
  // как долю. В сообщении о готовности он в любом случае уже внесён.
  const prepaidLine =
    kind === 'READY'
      ? `👉 Предоплата: ${money(prepaid)} — внесена`
      : recorded
        ? `👉 Внесена предоплата: ${money(prepaid)}`
        : `👉 Сейчас — предоплата 50%: ${money(prepaid)}`;

  // Остаток. Ноль — заказ закрыт; минус — клиент переплатил (например, убрали
  // позицию после предоплаты), и это возврат, а не «доплата с минусом».
  const restLine =
    balanceDue < 0
      ? `↩️ Переплата к возврату: ${money(Math.abs(balanceDue))}`
      : balanceDue === 0
        ? '✅ Заказ оплачен полностью'
        : kind === 'READY'
          ? `👉 Осталось доплатить: ${money(balanceDue)}`
          : isPickup
            ? `👉 При получении — остаток: ${money(balanceDue)}`
            : `👉 Когда пришлём фото доставки — остаток: ${money(balanceDue)}`;

  return ['💳 Оплата:', prepaidLine, restLine];
}

/** Реквизиты перевода — одинаково в обоих сообщениях. */
function requisiteLines(order: ClientMessageOrder): string[] {
  return [
    `📲 Реквизиты для перевода (${businessConfig.payment.label}):`,
    // Телефон отдельной строкой без отступа: пробелы в начале мешают
    // Telegram распознать номер.
    formatPaymentPhoneForClient(order),
    businessConfig.payment.recipient,
  ];
}

/**
 * Напоминание про ПВЗ.
 *
 * Без пункта выдачи и телефона заявку на доставку не оформить, и в длинном
 * сообщении эта строка терялась. Слово «Важно» и пустая строка выделяют её
 * одинаково во всех каналах — в отличие от разметки, которая в Авито и MAX
 * показалась бы звёздочками.
 */
function pvzLines(deliveryMethod: string): string[] {
  const point =
    deliveryMethod === 'YANDEX_PVZ'
      ? 'Яндекс ПВЗ'
      : deliveryMethod === 'OZON_PVZ'
        ? 'Ozon ПВЗ'
        : null;
  if (!point) return [];
  return [
    '',
    `📦 Важно: после оплаты пришлите чек и сообщите удобный ${point} и номер телефона — оформим заявку на доставку.`,
  ];
}

/**
 * Срок изготовления — только в подтверждении и только у фото и холстов.
 *
 * День оформления не считается: отсчёт со следующего дня, клиенту называем
 * диапазон в один день запаса. У футболок срока нет — печатает партнёр,
 * и жёсткую дату здесь не обещаем. Срочный заказ тоже без формулы: его срок
 * держит на контроле менеджер.
 */
function productionTermLines(order: ClientMessageOrder): string[] {
  if (order.productCategory === 'TSHIRT') return [];
  if (order.isUrgent) {
    return [
      '',
      '⏱ Срочный заказ — точную дату готовности подтвердит менеджер.',
    ];
  }
  const base = order.createdAt ? new Date(order.createdAt) : new Date();
  if (Number.isNaN(base.getTime())) return [];
  const days = businessConfig.production.days;
  const start = addDays(base, days);
  const end = addDays(base, days + 1);
  const term =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${RU_MONTHS_GENITIVE[start.getMonth()]}`
      : `${start.getDate()} ${RU_MONTHS_GENITIVE[start.getMonth()]} – ${end.getDate()} ${RU_MONTHS_GENITIVE[end.getMonth()]}`;
  return [
    '',
    `⏳ Срок изготовления: ${term} (день оформления не в счёт, отсчёт со следующего дня).`,
  ];
}

/**
 * Условия выдачи.
 *
 * В подтверждении это обещание на будущее: адрес, график, «заберёте после
 * фото готовой работы». В сообщении о готовности половина этих условий уже
 * исполнена, и повторять их — противоречить самому сообщению: остаются адрес
 * и часы работы.
 */
function pickupLines(
  order: ClientMessageOrder,
  kind: ClientMessageKind,
): string[] {
  if (order.deliveryMethod !== 'PICKUP') return [];
  const address = resolvePickupAddress(order);
  if (!address) {
    return ['', '📍 Самовывоз: адрес пришлём, когда заказ возьмут в работу'];
  }
  const lines = ['', `📍 Самовывоз: ${address}`];
  // Холсты забирают у подрядчика: свой график и своё условие выдачи.
  if (order.productCategory === 'CANVAS') {
    lines.push(`🕘 Часы работы: ${businessConfig.canvasPickup.hours}`);
    if (kind === 'CONFIRMATION') {
      lines.push(
        `⏱ Готовность в среднем ${businessConfig.canvasPickup.leadTime}`,
        '📸 Забрать можно после того, как пришлём фото готовой работы',
      );
    }
  }
  return lines;
}

/** Последняя просьба: что клиенту сделать после прочтения. */
function callToActionLines(
  order: ClientMessageOrder,
  kind: ClientMessageKind,
): string[] {
  if (kind === 'CONFIRMATION') {
    return ['👉 Как только внесёте предоплату, пришлите, пожалуйста, чек.'];
  }
  // При самовывозе платить переводом необязательно — в подтверждении заказа
  // клиенту так и обещали «остаток при получении». Требовать здесь перевод
  // значит противоречить самим себе.
  return [
    order.deliveryMethod === 'PICKUP'
      ? '👉 Остаток можно внести при получении или переводом заранее — тогда пришлите, пожалуйста, чек.'
      : '👉 Пожалуйста, доплатите остаток и пришлите чек — реквизиты выше.',
  ];
}

/**
 * Собрать сообщение клиенту.
 *
 * Порядок блоков один для обоих сообщений — этим и держится цепочка:
 * заголовок → номер → состав → деньги → оплата → выдача → срок → реквизиты
 * → просьба → подпись.
 */
export function buildClientMessage(
  order: ClientMessageOrder,
  kind: ClientMessageKind,
): string {
  const lines = [
    kind === 'CONFIRMATION'
      ? '✅ Отлично, ваш заказ подтверждён!'
      : '🎉 Ваш заказ готов!',
    `📌 Номер заказа: ${formatOrderNumberForClient(order)}`,
    '',
    '📋 Состав заказа:',
    ...compositionLines(order),
    '',
    SEPARATOR,
    ...totalsLines(order),
    SEPARATOR,
    ...paymentLines(order, kind),
    ...pickupLines(order, kind),
    ...(kind === 'CONFIRMATION' ? productionTermLines(order) : []),
    '',
    ...requisiteLines(order),
    '',
    ...callToActionLines(order, kind),
    ...pvzLines(order.deliveryMethod),
    '',
    kind === 'CONFIRMATION'
      ? 'Спасибо за доверие! Приступаем к работе 🙌'
      : 'Спасибо! Ждём вас 🙌',
  ];
  return lines.join('\n');
}
