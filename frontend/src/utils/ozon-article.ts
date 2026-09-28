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

export interface OzonArticle {
  printSlug: string;
  colorCode: string;
  colorLabel: string;
  size: string;
}

/** Разбор с конца: размер последний, цвет перед ним, остальное — принт. */
export function parseOzonArticle(offerId: string | null | undefined): OzonArticle | null {
  const parts = (offerId ?? '').trim().split('-').filter(Boolean);
  if (parts.length < 3) return null;

  const size = parts[parts.length - 1].toUpperCase();
  if (!SIZES.includes(size)) return null;

  const colorCode = parts[parts.length - 2].toLowerCase();
  const colorLabel = COLOR_LABEL_BY_CODE[colorCode];
  if (!colorLabel) return null;

  const printSlug = parts.slice(0, parts.length - 2).join('-');
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
