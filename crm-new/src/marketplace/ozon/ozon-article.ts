/**
 * Что артикул Ozon говорит о футболке.
 *
 * Артикул продавца собран по схеме `<принт>-<цвет>-<размер>`:
 * `JDM-1-1-black-S`, `labrov-nadpis-white-XXL`. Её же строит buildOfferId
 * при выгрузке карточек — здесь обратный разбор.
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

export interface OzonArticle {
  /** Код принта из артикула: «JDM-1-1», «labrov-nadpis». */
  printSlug: string;
  /** Латинский код цвета: black, white. */
  colorCode: string;
  /** Подпись цвета для карточки и листа согласования. */
  colorLabel: string;
  size: EnumTshirtSize;
}

/**
 * Разобрать артикул. null — схема не та, и гадать нельзя.
 *
 * Разбираем с конца: размер последний, цвет перед ним, остальное — принт.
 * С начала было бы нельзя: в коде принта дефисов сколько угодно
 * («JDM-1-1»), и где кончается принт, знает только хвост.
 */
export function parseOzonArticle(
  offerId: string | null | undefined,
): OzonArticle | null {
  const parts = (offerId ?? '').trim().split('-').filter(Boolean);
  if (parts.length < 3) return null;

  const size = parts[parts.length - 1].toUpperCase();
  if (!SIZES.has(size)) return null;

  const colorCode = parts[parts.length - 2].toLowerCase();
  const colorLabel = COLOR_LABEL_BY_CODE[colorCode];
  // Цвет, которого нет в списке футболок CRM, — не повод угадывать: печатник
  // получит подпись, которой нет ни на одной заготовке.
  if (!colorLabel) return null;

  const printSlug = parts.slice(0, parts.length - 2).join('-');
  if (!printSlug) return null;

  return { printSlug, colorCode, colorLabel, size: size as EnumTshirtSize };
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
