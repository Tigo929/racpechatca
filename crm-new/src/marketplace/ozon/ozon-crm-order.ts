/**
 * Заказ CRM из отправления Ozon.
 *
 * Оператор видел отправление в кабинете и заводил заказ руками: переписывал
 * артикул, выбирал цвет и размер из списков, вспоминал номер. Каждый из этих
 * шагов — возможность ошибиться, а ошибка в цвете стоит заготовки.
 *
 * Здесь всё берётся из самого отправления, и выбора у человека нет:
 * цвет, размер и принт — из артикула (parseOzonArticle), номер заказа и
 * номер отправления — как их назвал Ozon. Не разобрался артикул — заказ
 * не заводится, и оператор видит почему: подставленные наугад «Чёрный, M»
 * дороже отказа.
 *
 * Деньги сюда не переносятся сознательно: их считает площадка. Цена позиции
 * нулевая, доставки нет — CRM ведёт производство и макет
 * (см. order-photo/marketplace-tshirt.ts).
 */

import {
  parseOzonArticle,
  stickerCode,
  type OzonArticle,
} from './ozon-article';
import type { OzonOrderView } from './ozon-orders.service';

export interface MarketplaceOrderDraftItem {
  color: string;
  size: OzonArticle['size'];
  printLocation: 'FRONT';
  quantity: number;
  /** Деньги считает площадка: в CRM позиция без цены. */
  price: 0;
  /** Код принта из артикула — по нему печатник находит макет. */
  printSlug: string;
  /** Артикул целиком: в примечании он служит доказательством разбора. */
  offerId: string;
}

export interface MarketplaceOrderDraft {
  marketplaceOrderNumber: string;
  marketplacePostingNumber: string;
  /** Последние цифры стикера — ими подписана посылка. */
  sticker: string | null;
  items: MarketplaceOrderDraftItem[];
  note: string;
}

export class OzonArticleError extends Error {
  constructor(readonly offerIds: string[]) {
    super(
      `Артикул не по схеме «принт-цвет-размер»: ${offerIds.join(', ')}. ` +
        'Цвет и размер взять неоткуда — заведите заказ вручную.',
    );
  }
}

/**
 * Собрать черновик заказа. Бросает OzonArticleError, если хотя бы один
 * артикул не разобрался: половина заказа хуже, чем отказ, — вторую половину
 * оператор бы не заметил.
 */
export function buildMarketplaceOrderDraft(
  posting: OzonOrderView,
): MarketplaceOrderDraft {
  const items: MarketplaceOrderDraftItem[] = [];
  const unparsed: string[] = [];

  for (const item of posting.items) {
    const article = parseOzonArticle(item.offerId);
    if (!article) {
      unparsed.push(item.offerId || '(пусто)');
      continue;
    }
    items.push({
      color: article.colorLabel,
      size: article.size,
      // Сторона печати из артикула не следует. Перед — то, что печатают
      // почти всегда; если принт на спине, это видно на макете, и сторону
      // правят в согласовании.
      printLocation: 'FRONT',
      quantity: Math.max(1, item.quantity),
      price: 0,
      printSlug: article.printSlug,
      offerId: item.offerId,
    });
  }

  if (unparsed.length > 0) throw new OzonArticleError(unparsed);
  if (items.length === 0) throw new OzonArticleError(['позиций нет']);

  const sticker = stickerCode(posting.postingNumber);

  return {
    marketplaceOrderNumber: posting.orderNumber || posting.postingNumber,
    marketplacePostingNumber: posting.postingNumber,
    sticker,
    items,
    note: buildNote(posting, items, sticker),
  };
}

/**
 * Примечание заказа: то, что человек должен увидеть без похода в кабинет.
 *
 * Артикулы оставлены целиком не для красоты — по ним видно, из чего выведены
 * цвет и размер, и спор «почему белая» решается на месте.
 */
function buildNote(
  posting: OzonOrderView,
  items: MarketplaceOrderDraftItem[],
  sticker: string | null,
): string {
  const lines = [
    `Заказ Ozon: ${posting.orderNumber || '—'}`,
    `Отправление: ${posting.postingNumber}`,
    ...(sticker ? [`Стикер: …${sticker}`] : []),
    ...(posting.shipmentDate
      ? [
          `Отгрузить до: ${new Date(posting.shipmentDate).toLocaleString('ru-RU')}`,
        ]
      : []),
    'Позиции по артикулу:',
    ...items.map(
      (i) =>
        `• ${i.offerId} → ${i.color}, ${i.size}, принт ${i.printSlug} × ${i.quantity}`,
    ),
  ];
  return lines.join('\n');
}
