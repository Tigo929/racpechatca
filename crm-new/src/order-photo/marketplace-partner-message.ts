/**
 * Задание исполнителю по заказу с маркетплейса.
 *
 * От обычного задания отличается тем, чего в нём НЕТ: расчёта. Деньги по
 * такому заказу считает площадка, доля исполнителя идёт по договорённости,
 * и любая сумма здесь была бы выдумкой — а исполнитель читает её как факт
 * и ждёт именно столько.
 *
 * Зато есть то, чего нет в обычном задании: номер заказа площадки, хвост
 * стикера и артикул позиции. По ним готовая футболка находит свою коробку:
 * печатник сверяет артикул с карточкой Ozon, а по стикеру кладёт посылку
 * в нужное место на столе упаковки.
 */

import { stickerCode } from '../marketplace/ozon/ozon-article';

const PRINT_LOCATION_LABELS: Record<string, string> = {
  FRONT: 'Грудь',
  BACK: 'Спина',
  FRONT_BACK: 'Грудь + спина',
  SLEEVE_LEFT: 'Левый рукав',
  SLEEVE_RIGHT: 'Правый рукав',
  FULL: 'Полная запечатка',
  BY_TZ: 'По ТЗ',
};

const PRINT_TYPE_LABELS: Record<string, string> = {
  DTF: 'DTF',
  DTG: 'DTG',
  SILK: 'Шелкография',
  SUBLIMATION: 'Сублимация',
};

export interface MarketplacePartnerItem {
  color: string;
  size: string;
  quantity: number;
  printLocation: string;
  printType: string;
  marketplaceArticle?: string | null;
}

export interface MarketplacePartnerOrder {
  numberOrder: string;
  marketplaceOrderNumber?: string | null;
  marketplacePostingNumber?: string | null;
  tshirtModel?: string | null;
  tshirtItems: MarketplacePartnerItem[];
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildMarketplacePartnerMessage(
  order: MarketplacePartnerOrder,
  attachmentCount = 1,
): string {
  const sticker = stickerCode(order.marketplacePostingNumber);
  // Номер площадки — тот, которым заказ назван в кабинете; внутренний номер
  // рядом, чтобы по нему можно было найти заказ в CRM.
  const marketNumber = (order.marketplaceOrderNumber ?? '').trim();

  const items = order.tshirtItems.flatMap((item, index) => {
    const lines = [
      `${index + 1}) <b>${esc(item.color)} / ${esc(item.size)}</b> ×${item.quantity}` +
        ` — ${esc(PRINT_LOCATION_LABELS[item.printLocation] ?? item.printLocation)}` +
        ` · ${esc(PRINT_TYPE_LABELS[item.printType] ?? item.printType)}`,
    ];
    if (item.marketplaceArticle) {
      lines.push(`   Артикул: <code>${esc(item.marketplaceArticle)}</code>`);
    }
    return lines;
  });

  return [
    '🛒 <b>Заказ с маркетплейса</b>',
    ...(marketNumber ? [`Заказ Ozon: <code>${esc(marketNumber)}</code>`] : []),
    ...(sticker ? [`Стикер: <code>…${esc(sticker)}</code>`] : []),
    `Заказ в CRM: <code>${esc(order.numberOrder)}</code>`,
    ...(order.tshirtModel ? [`Модель: <i>${esc(order.tshirtModel)}</i>`] : []),
    ...(attachmentCount > 1
      ? [`ТЗ: <b>${attachmentCount} файлов в одном PDF</b>`]
      : []),
    '',
    ...items,
    '',
    '<i>Деньги по заказу считает площадка — расчёта здесь нет.</i>',
  ].join('\n');
}
