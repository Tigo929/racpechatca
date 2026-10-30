/**
 * Какой макет печатаем — и на каком алфавите он назван.
 *
 * В каталоге два разных принта с почти одинаковыми кодами: «ПАПА»
 * кириллицей и «papa» латиницей. Это разные макеты, разного вида, и
 * перепутать их — значит напечатать не то, что купили: заготовка
 * списана, посылка уехала с чужим принтом.
 *
 * Глазами они не различаются: буквы П/P, А/A, пишутся одинаково почти в
 * любом шрифте. Поэтому мало показать код — надо назвать алфавит
 * словом. «ПАПА · кириллица» и «papa · латиница» спутать уже нельзя,
 * и читать для этого нечего: достаточно взглянуть.
 *
 * Смешанный алфавит внутри одного кода — отдельный случай: так выглядит
 * опечатка в карточке маркетплейса («papa» с кириллической «а»). Такой
 * артикул называем прямо, потому что по нему макет не найдётся.
 */

export type PrintScript = 'cyrillic' | 'latin' | 'mixed' | 'none';

const CYRILLIC = /[\u0400-\u04FF]/;
const LATIN = /[A-Za-z]/;

export const SCRIPT_LABEL: Record<PrintScript, string> = {
  cyrillic: 'кириллица',
  latin: 'латиница',
  mixed: 'буквы вперемешку',
  none: '',
};

export function printScript(slug: string): PrintScript {
  const cyr = CYRILLIC.test(slug);
  const lat = LATIN.test(slug);
  if (cyr && lat) return 'mixed';
  if (cyr) return 'cyrillic';
  if (lat) return 'latin';
  return 'none';
}

export interface MarketplacePrint {
  /** Код принта как он есть в артикуле: «ПАПА», «papa», «JDM-1-1». */
  slug: string;
  script: PrintScript;
  /** Подпись алфавита. Пусто — в коде нет букв, различать нечего. */
  scriptLabel: string;
}

/**
 * Код принта из артикула Ozon.
 *
 * Схема та же, что на сервере (crm-new/src/marketplace/ozon/ozon-article.ts):
 * `<принт>-<цвет>-<размер>`, разбираем с конца — в коде принта дефисов
 * сколько угодно. Не разобрался — возвращаем null: гадать здесь нельзя,
 * подпись «ПАПА» под чужим макетом хуже, чем её отсутствие.
 */
export function marketplacePrint(
  article: string | null | undefined,
): MarketplacePrint | null {
  const parts = (article ?? '').trim().split('-').filter(Boolean);
  if (parts.length < 3) return null;
  const slug = parts.slice(0, parts.length - 2).join('-');
  if (!slug) return null;
  const script = printScript(slug);
  return { slug, script, scriptLabel: SCRIPT_LABEL[script] };
}

/**
 * Цвет чипа — по алфавиту, а не по коду.
 *
 * Различать надо именно алфавит: это единственное, чем «ПАПА» и «papa»
 * отличаются друг от друга. Один взгляд на цвет отвечает на вопрос
 * раньше, чем человек начнёт читать буквы.
 */
export function printScriptTone(script: PrintScript): string {
  if (script === 'cyrillic') return 'bg-violet-100 text-violet-900 border-violet-300';
  if (script === 'latin') return 'bg-sky-100 text-sky-900 border-sky-300';
  if (script === 'mixed') return 'bg-red-100 text-red-900 border-red-400';
  return 'bg-gray-100 text-gray-800 border-gray-300';
}

/**
 * Одно и то же слово, написанное двумя алфавитами.
 *
 * «ПАПА» и «papa» — не похожие коды, а один и тот же код в кириллице и
 * латинице. Поймать это сравнением строк нельзя: для машины они разные
 * целиком, ни одна буква не совпадает. Поэтому кириллицу приводим
 * к латинице по звучанию и сравниваем уже приведённое.
 *
 * Таблица короткая намеренно: сюда входят буквы, которыми пишут коды
 * принтов. Полная транслитерация здесь не нужна и только добавила бы
 * случаев, где два разных принта считаются одним.
 */
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

/** Код принта «по звучанию»: им и сравниваются ПАПА с papa. */
export function printKey(slug: string): string {
  return slug
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('');
}

/**
 * Есть ли в заказе два макета, которые различаются только алфавитом.
 *
 * Это худший из возможных случаев: в одной посылке два принта, по виду
 * названные одинаково. Напечатать две одинаковые футболки здесь проще,
 * чем правильные, и заметит это уже покупатель.
 */
export function hasConfusablePrints(slugs: string[]): boolean {
  const byKey = new Map<string, Set<string>>();
  for (const slug of slugs) {
    const key = printKey(slug);
    const set = byKey.get(key) ?? new Set<string>();
    set.add(slug);
    byKey.set(key, set);
  }
  return [...byKey.values()].some((set) => set.size > 1);
}

/** Склонение: «2 футболки», «5 футболок». */
export function pluralShirts(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'футболок';
  if (mod10 === 1) return 'футболка';
  if (mod10 >= 2 && mod10 <= 4) return 'футболки';
  return 'футболок';
}
