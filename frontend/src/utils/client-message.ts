/**
 * Сообщения клиенту: подтверждение заказа и готовность.
 *
 * Раньше это были две почти одинаковые функции по сто строк каждая внутри
 * карточки заказа. Состав заказа, суммы, реквизиты и подпись собирались
 * дважды, и правка одной копии не доходила до второй: у подтверждения
 * и готовности разъехались пустые строки, формулировки про оплату и даже
 * порядок блоков. Клиент получал два письма из разных систем.
 *
 * Теперь цепочка одна. Оба сообщения собираются одним конвейером из одних
 * и тех же блоков; отличается только то, что обязано отличаться: заголовок,
 * блок оплаты, условия выдачи и финальная просьба.
 *
 * ЧТО СЮДА НЕЛЬЗЯ КЛАСТЬ. Это текст, который уходит покупателю в Telegram,
 * Авито, Ozon и MAX. Значит — никакой разметки, кроме той, что работает
 * в конкретном канале (обратные кавычки только в Telegram), и ни одного
 * служебного слова из CRM. Внутренние предупреждения место имеют
 * в интерфейсе менеджера, а не в сообщении клиенту.
 */

import {
  businessConfig,
  formatOrderNumberForClient,
  formatPaymentPhoneForClient,
  resolvePickupAddress,
} from '../config/business';
import { DELIVERY_LABELS } from '../constants';
import { computePrepayment } from './prepayment';
import type { OrderPhoto } from '../types/index';

/** Какое из двух сообщений собираем. */
export type ClientMessageKind = 'CONFIRMATION' | 'READY';

type PhotoOrderItem = OrderPhoto['items'][number];

const SEPARATOR = '─────────────────';

/** Месяцы в родительном падеже — для «11–12 сентября». */
const RU_MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

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

function isFreeFormPhotoItem(order: OrderPhoto, item: PhotoOrderItem): boolean {
  if (order.isFreePrice || item.isFreePrice) return true;
  return (item.pricePosition ?? 0) !== (item.price ?? 0) * (item.quantity ?? 0);
}

function photoItemLine(order: OrderPhoto, item: PhotoOrderItem): string {
  if (isFreeFormPhotoItem(order, item)) {
    return `• ${item.formatPaper} × ${item.quantity} шт — ${money(item.pricePosition)}`;
  }
  const type = item.typePaper === 'GLOSS' ? 'Глянец' : 'Матт';
  return `• ${item.formatPaper} (${type}) × ${item.quantity} шт — ${money(item.pricePosition)}`;
}

/**
 * Состав заказа — одинаково в обоих сообщениях.
 *
 * Дизайн и срочность идут такими же строками состава: клиент за них платит,
 * и без них «сумма по позициям» не сходится с «итого к оплате».
 */
function compositionLines(order: OrderPhoto): string[] {
  const lines: string[] = [];
  for (const item of order.items ?? []) {
    lines.push(photoItemLine(order, item));
  }
  for (const item of order.tshirtItems ?? []) {
    lines.push(
      `• Футболка ${item.color}, р-р ${item.size} × ${item.quantity} шт — ${money(item.pricePosition)}`,
    );
  }
  for (const item of order.canvasItems ?? []) {
    lines.push(
      `• Холст ${item.formatCanvas} × ${item.quantity} шт — ${money(item.pricePosition)}`,
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
function compositionTotal(order: OrderPhoto): number {
  const positions = [
    ...(order.items ?? []),
    ...(order.tshirtItems ?? []),
    ...(order.canvasItems ?? []),
  ].reduce((sum, item) => sum + (item.pricePosition ?? 0), 0);
  return positions + (order.designDevelopmentCost ?? 0) + (order.urgencyFee ?? 0);
}

/** Блок денег: позиции, скидка, доставка, итог. Одинаков в обоих сообщениях. */
function totalsLines(order: OrderPhoto): string[] {
  const delivery = order.deliveryCost ?? 0;
  const discount = order.discountAmount ?? 0;
  const deliveryLabel =
    DELIVERY_LABELS[order.deliveryMethod as keyof typeof DELIVERY_LABELS] ??
    order.deliveryMethod;
  return [
    `💰 Сумма по позициям: ${money(compositionTotal(order))}`,
    // Скидку называем отдельной строкой: иначе клиент видит «итого» меньше
    // суммы позиций и не понимает, откуда разница.
    ...(discount > 0 ? [`🎁 Скидка: −${money(discount)}`] : []),
    ...(delivery > 0 ? [`🚚 Доставка (${deliveryLabel}): ${money(delivery)}`] : []),
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
 *
 * Раньше сообщение о готовности в этом случае печатало клиенту
 * «Предоплата не отмечена в CRM — проверьте поступление перед выдачей»
 * и требовало полную сумму заказа. Это внутренняя реплика для менеджера,
 * а не текст покупателю: человек уже внёс предоплату (иначе заказ не дошёл
 * бы до готовности) и получал счёт на всю сумму со словами про чужую
 * систему. Предупреждение осталось, но в карточке заказа — см.
 * prepaymentNeedsAttention.
 */
export function clientPrepayment(order: OrderPhoto): {
  prepaid: number;
  balanceDue: number;
  recorded: boolean;
} {
  const { prepaid, balanceDue, recorded } = computePrepayment(
    order.totalOrder ?? 0,
    order.prepaidAmount,
  );
  return { prepaid, balanceDue, recorded };
}

/**
 * Показать менеджеру, что фактическая предоплата не записана.
 *
 * Сообщение клиенту при этом остаётся правильным — в нём стоит ориентир 50%,
 * обещанный при оформлении. Но проверить поступление перед выдачей нужно,
 * и место этой проверки — карточка заказа.
 */
export function prepaymentNeedsAttention(order: OrderPhoto): boolean {
  if (order.status === 'PAID' || order.status === 'COMPLETED') return false;
  return order.prepaidAmount === null || order.prepaidAmount === undefined;
}

/** Блок оплаты. Единственное место, где сообщения расходятся по смыслу. */
function paymentLines(order: OrderPhoto, kind: ClientMessageKind): string[] {
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
function requisiteLines(order: OrderPhoto): string[] {
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
 * сообщении эта строка терялась. Раньше её выделяли разметкой: `**` по краям
 * и юникодная линия под каждым знаком. В Telegram это иногда срабатывало,
 * а в Авито, Ozon и MAX клиент получал строку со звёздочками и рассыпанными
 * подчёркиваниями — то самое «криво скопировалось». Слово «Важно» и пустая
 * строка выделяют не хуже и выглядят одинаково во всех каналах.
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
function productionTermLines(order: OrderPhoto): string[] {
  if (order.productCategory === 'TSHIRT') return [];
  if (order.isUrgent) {
    return ['', '⏱ Срочный заказ — точную дату готовности подтвердит менеджер.'];
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
function pickupLines(order: OrderPhoto, kind: ClientMessageKind): string[] {
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
function callToActionLines(order: OrderPhoto, kind: ClientMessageKind): string[] {
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
  order: OrderPhoto,
  kind: ClientMessageKind,
): string {
  const lines = [
    kind === 'CONFIRMATION' ? '✅ Отлично, ваш заказ подтверждён!' : '🎉 Ваш заказ готов!',
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
