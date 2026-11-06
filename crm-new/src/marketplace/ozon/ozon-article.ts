/**
 * Что артикул Ozon говорит о футболке.
 *
 * Артикул продавца собран из трёх частей: код принта, код цвета и размер —
 * `papa-black-S`, `JDM-1-1-white-XXL`, `customer-black-1-XS`. Размер всегда
 * последний, цвет — отдельным куском, остальное код принта. Её же строит
 * buildOfferId при выгрузке карточек — здесь обратный разбор.
 *
 * Зачем разбирать. Заказ с площадки приходит без «цвета» и «размера»
 * отдельными полями: у Ozon это один артикул. Оператор переписывал его
 * в карточку заказа руками — и ошибался: «black» на белой футболке
 * замечают уже после печати, а заготовка при этом списана.
 *
 * Поэтому цвет, размер и принт берутся ТОЛЬКО отсюда, и выбора у человека
 * нет. Если артикул собран не по схеме, лучше отказаться и сказать об этом,
 * чем подставить «Чёрный, M» наугад.
 */

import { EnumTshirtSize } from 'src/generated/prisma/enums';

/** Подписи цветов ровно те, что в карточке заказа (TSHIRT_COLORS). */
const COLOR_LABEL_BY_CODE: Record<string, string> = {
  black: 'Чёрный',
  white: 'Белый',
};

const SIZES = new Set<string>(Object.values(EnumTshirtSize));

/**
 * Как ещё пишут размер в артикуле.
 *
 * В карточке размерный ряд называют и буквами, и цифрой с буквой: «XXL»
 * и «2XL» — один и тот же размер, и какой из двух написан в артикуле,
 * решает тот, кто заводил карточку. Для нас это должен быть один размер:
 * непонятый размер означает незаведённый заказ и ненапечатанную футболку.
 */
const SIZE_ALIASES: Record<string, EnumTshirtSize> = {
  '2XL': EnumTshirtSize.XXL,
  '3XL': EnumTshirtSize.XXXL,
};

export interface OzonArticle {
  /** Код принта из артикула: «JDM-1-1», «labrov-nadpis», «customer-1». */
  printSlug: string;
  /** Латинский код цвета: black, white. */
  colorCode: string;
  /** Подпись цвета для карточки и листа согласования. */
  colorLabel: string;
  size: EnumTshirtSize;
}

/** Размер из куска артикула. null — это не размер. */
export function parseArticleSize(part: string): EnumTshirtSize | null {
  const value = part.trim().toUpperCase();
  if (SIZES.has(value)) return value as EnumTshirtSize;
  return SIZE_ALIASES[value] ?? null;
}

/**
 * Где в артикуле код цвета — ищем с конца. −1: цвета нет.
 *
 * У «papa-black-S» цвет предпоследний, у «customer-black-1-XS» — раньше:
 * в названии новой линейки цвет стоит в середине, а номер принта после
 * него. Привязываться к месту нельзя: не узнали цвет — заказ не заведён.
 * Ищем с конца, потому что ближе к размеру цвет и стоит, а в коде принта
 * слово «black» может быть частью названия.
 */
export function colorIndexIn(parts: readonly string[]): number {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (COLOR_LABEL_BY_CODE[parts[i].trim().toLowerCase()]) return i;
  }
  return -1;
}

/**
 * Разобрать артикул. null — схема не та, и гадать нельзя.
 *
 * Размер берём последним куском, цвет — последним куском, который им
 * выглядит, остальное по порядку — код принта. Цвет из кода принта
 * убираем: «customer-black-1» и «customer-white-1» это один принт в двух
 * цветах, а не два разных, и цвет едет своим полем.
 */
export function parseOzonArticle(
  offerId: string | null | undefined,
): OzonArticle | null {
  const parts = (offerId ?? '').trim().split('-').filter(Boolean);
  if (parts.length < 3) return null;

  const size = parseArticleSize(parts[parts.length - 1]);
  if (!size) return null;

  const head = parts.slice(0, parts.length - 1);
  const colorAt = colorIndexIn(head);
  // Цвета, которого нет в списке футболок CRM, — не повод угадывать: печатник
  // получит подпись, которой нет ни на одной заготовке.
  if (colorAt < 0) return null;
  const colorCode = head[colorAt].toLowerCase();
  const colorLabel = COLOR_LABEL_BY_CODE[colorCode];

  const printSlug = head.filter((_, index) => index !== colorAt).join('-');
  if (!printSlug) return null;

  return { printSlug, colorCode, colorLabel, size };
}

/** Сколько цифр стикера различают посылки на столе упаковки. */
export const STICKER_DIGITS = 4;

/**
 * Хвост номера отправления — им и подписан стикер на посылке.
 *
 * Полный номер («0189070451-0031-1») на столе упаковки не читают: сверяют
 * последние цифры, их видно с расстояния вытянутой руки. Печатнику в лист
 * согласования уходит тот же хвост — по нему он кладёт футболку к нужной
 * посылке.
 *
 * Берём цифры, а не символы: разделители в номере у разных схем свои,
 * и «31-1» ничего не различает.
 */
export function stickerCode(
  postingNumber: string | null | undefined,
): string | null {
  const digits = (postingNumber ?? '').replace(/\D/g, '');
  if (digits.length < STICKER_DIGITS) return null;
  return digits.slice(-STICKER_DIGITS);
}

/**
 * На каком алфавите написан код принта.
 *
 * В каталоге два разных принта с одинаково выглядящими кодами: «ПАПА»
 * кириллицей и «papa» латиницей. Буквы П/P и А/A не различаются глазом
 * почти ни в одном шрифте, поэтому алфавит приходится называть словом —
 * иначе напечатают не тот макет, а узнают об этом по возврату.
 *
 * Буквы двух алфавитов в одном коде — отдельный случай: так выглядит
 * опечатка в карточке маркетплейса, и по такому коду макет не найдётся.
 */
export type PrintScript = 'cyrillic' | 'latin' | 'mixed' | 'none';

export function printScript(slug: string): PrintScript {
  const cyrillic = /[\u0400-\u04FF]/.test(slug);
  const latin = /[A-Za-z]/.test(slug);
  if (cyrillic && latin) return 'mixed';
  if (cyrillic) return 'cyrillic';
  if (latin) return 'latin';
  return 'none';
}

/** Подпись алфавита для примечания. Пусто — в коде нет букв. */
export function printScriptLabel(slug: string): string {
  const script = printScript(slug);
  if (script === 'cyrillic') return 'кириллица';
  if (script === 'latin') return 'латиница';
  if (script === 'mixed') return '⚠ буквы двух алфавитов';
  return '';
}
