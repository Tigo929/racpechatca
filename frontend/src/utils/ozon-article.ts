/**
 * Что артикул Ozon говорит о футболке — зеркало серверного разбора
 * (crm-new/src/marketplace/ozon/ozon-article.ts), и ответы обязаны совпадать.
 *
 * Здесь он нужен, чтобы показать разбор ДО заведения заказа: оператор видит
 * «Чёрный · S · принт JDM-1-1» прямо на отправлении и замечает чужой артикул
 * до того, как заказ создан. Решение всё равно принимает сервер — он же
 * и откажет, если схема не та.
 */

const COLOR_LABEL_BY_CODE: Record<string, string> = {
  black: 'Чёрный',
  white: 'Белый',
};

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/** «2XL» и «XXL» — один размер: как написать, решает автор карточки. */
const SIZE_ALIASES: Record<string, string> = { '2XL': 'XXL', '3XL': 'XXXL' };

export interface OzonArticle {
  printSlug: string;
  colorCode: string;
  colorLabel: string;
  size: string;
}

/** Размер из куска артикула. null — это не размер. */
export function parseArticleSize(part: string): string | null {
  const value = part.trim().toUpperCase();
  if (SIZES.includes(value)) return value;
  return SIZE_ALIASES[value] ?? null;
}

/**
 * Где в артикуле код цвета — ищем с конца. −1: цвета нет.
 *
 * У «papa-black-S» цвет предпоследний, у «customer-black-1-XS» — раньше.
 * Привязываться к месту нельзя: разбор обязан совпадать с серверным.
 */
export function colorIndexIn(parts: readonly string[]): number {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (COLOR_LABEL_BY_CODE[parts[i].trim().toLowerCase()]) return i;
  }
  return -1;
}

/** Размер последний, цвет — последний похожий кусок, остальное — принт. */
export function parseOzonArticle(offerId: string | null | undefined): OzonArticle | null {
  const parts = (offerId ?? '').trim().split('-').filter(Boolean);
  if (parts.length < 3) return null;

  const size = parseArticleSize(parts[parts.length - 1]);
  if (!size) return null;

  const head = parts.slice(0, parts.length - 1);
  const colorAt = colorIndexIn(head);
  if (colorAt < 0) return null;
  const colorCode = head[colorAt].toLowerCase();
  const colorLabel = COLOR_LABEL_BY_CODE[colorCode];

  const printSlug = head.filter((_, index) => index !== colorAt).join('-');
  if (!printSlug) return null;

  return { printSlug, colorCode, colorLabel, size };
}

export const STICKER_DIGITS = 4;

/** Хвост номера отправления — им подписан стикер на посылке. */
export function stickerCode(postingNumber: string | null | undefined): string | null {
  const digits = (postingNumber ?? '').replace(/\D/g, '');
  if (digits.length < STICKER_DIGITS) return null;
  return digits.slice(-STICKER_DIGITS);
}
