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
  printScriptLabel,
  stickerCode,
  type OzonArticle,
} from './ozon-article';
import type { OzonOrderView } from './ozon-orders.service';
import { tshirtSizeLabel } from 'src/order-photo/tshirt-size';

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
    note: buildNote(items),
  };
}

/**
 * Примечание заказа — только макет, и ничего больше.
 *
 * Раньше здесь лежали номер заказа, номер отправления, стикер и строка
 * на каждый артикул. Всё это повторяло известное: номера стоят в шапке
 * карточки и в своих колонках, стикер считается из номера отправления
 * и печатается на листе согласования, состав выведен из артикула и
 * показан полосой макета в карточке.
 *
 * Оставшийся вопрос один, и ради него примечание и открывали: какой
 * печатаем макет — «ПАПА» или «papa». Это разные принты с одинаково
 * выглядящими кодами, и перепутать их значит напечатать не то, что
 * купили. Поэтому алфавит назван словом: сами буквы глазом
 * не различаются.
 *
 * Срока отгрузки здесь нет и не было: он живёт в кабинете и меняется
 * там, а замороженная копия через день врёт.
 */
function buildNote(items: MarketplaceOrderDraftItem[]): string {
  return items
    .map((i) => {
      const script = printScriptLabel(i.printSlug);
      const name = script ? `${i.printSlug} (${script})` : i.printSlug;
      return `Макет: ${name} — ${i.color}, ${tshirtSizeLabel(i.size)} × ${i.quantity}`;
    })
    .join('\n');
}
