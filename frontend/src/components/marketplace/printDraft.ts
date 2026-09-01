import type { EnumTshirtGender, OzonColorGroupInput, CreateOzonPrintDto } from '../../api/ozonCatalog';
import type { EnumTshirtSize } from '../../types/index';

/**
 * Данные одного черновика принта и чистые функции над ним — вынесены из
 * PrintEditor.tsx отдельно от компонентов: файл со смешанными экспортами
 * компонентов и констант ломает Fast Refresh (react-refresh/only-export-components).
 */

export const ALL_SIZES: EnumTshirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
/** Стандартный набор — как в реальных карточках продавца: «у футболки 5 размеров». */
export const DEFAULT_SIZES: EnumTshirtSize[] = ['S', 'M', 'L', 'XL', 'XXL'];

export const GENDER_LABELS: Record<EnumTshirtGender, string> = {
  UNISEX: 'Унисекс', MALE: 'Мужской', FEMALE: 'Женский', KIDS: 'Детский',
};

export interface ColorGroupDraft {
  colorLabel: string;
  colorDictionaryValueId: number;
  /** Латинский код цвета в артикуле: JDM-1-1-**black**-S. */
  colorCode: string;
  /**
   * Главное фото этого цвета.
   *
   * Принт один, а футболки разные: белый вариант с фотографией чёрного
   * покупатель видит как чужой товар. Пусто — уйдёт главное фото принта.
   */
  mainPhotoUrl: string;
  sizes: EnumTshirtSize[];
}

/** Новая цветовая партия: размеры по умолчанию, фото и цвет — пустые. */
/**
 * Новая цветовая группа начинается с чёрного размера M.
 *
 * Так продавец заводит принты чаще всего, и три клика на каждой карточке
 * складываются в сотни на партии. Значения правятся: цвет — кнопкой рядом,
 * размеры — тумблерами. Идентификатор словаря Ozon для чёрного не зашит
 * (у кабинетов он разный) — его подставляет кнопка «Чёрная» при открытии
 * строки, см. ColorPresetButtons.
 */
export function emptyColorGroup(): ColorGroupDraft {
  return {
    colorLabel: 'Чёрный',
    colorDictionaryValueId: 0,
    colorCode: 'black',
    mainPhotoUrl: '',
    sizes: ['M'],
  };
}

/**
 * Русская подпись цвета из словаря Ozon → латинский код для артикула.
 * Тот же справочник, что и на бэкенде (ozon-attributes.ts): здесь он нужен,
 * чтобы поле заполнялось сразу при выборе цвета, а не после сохранения.
 */
const COLOR_CODE_BY_LABEL: Record<string, string> = {
  'черный': 'black', 'чёрный': 'black', 'белый': 'white', 'серый': 'gray',
  'синий': 'blue', 'голубой': 'lightblue', 'красный': 'red',
  'зеленый': 'green', 'зелёный': 'green', 'желтый': 'yellow', 'жёлтый': 'yellow',
  'оранжевый': 'orange', 'розовый': 'pink', 'фиолетовый': 'purple',
  'коричневый': 'brown', 'бежевый': 'beige', 'бордовый': 'burgundy', 'хаки': 'khaki',
};

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function colorCodeFor(colorLabel: string): string {
  const key = colorLabel.trim().toLowerCase();
  const known = COLOR_CODE_BY_LABEL[key];
  if (known) return known;
  return [...key]
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Предпросмотр артикула — то же правило, что применит бэкенд. */
export function previewOfferId(slug: string, name: string, colorCode: string, size: string): string {
  const base = (slug.trim() || name.trim().toLowerCase().replace(/\s+/g, '-')).replace(/[^a-zA-Zа-яёА-ЯЁ0-9-]+/g, '');
  return `${base || '…'}-${colorCode || '…'}-${size}`;
}

export interface PrintDraft {
  /**
   * Ключ строки в массовом режиме. Только для React: раньше строки
   * различались по индексу, и после «дублировать» или «удалить» подсказка
   * цвета оставалась у номера строки, а не у самого принта — на экране цвет
   * оказывался не у того товара.
   */
  key: string;
  name: string;
  slug: string;
  description: string;
  hashtags: string;
  extraPhotoUrls: string; // по одной ссылке на строку — парсится при отправке
  gender: EnumTshirtGender;
  /**
   * Тематика рисунка — списком, а не строкой через запятую.
   *
   * Строкой было нельзя: в словаре Ozon есть значения с запятой внутри
   * («Надписи, цитаты»), и при разборе одно выбранное значение распадалось на
   * два выдуманных. Ozon такие не принимает и отбивает карточку целиком.
   */
  patternTags: string[];
  /** «Объединить на одной карточке» в Ozon. Пусто — берётся код принта. */
  unionKey: string;
  colorGroups: ColorGroupDraft[];
}

/**
 * Ключ строки — случайный, а не по счётчику.
 *
 * Черновики переживают перезагрузку страницы (см. usePersistentState), а
 * счётчик после неё начинается заново — и новая строка получала бы ключ уже
 * восстановленной. React считал бы их одной, и правка уезжала не в ту строку.
 */
function nextKey(): string {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Пустой черновик. Цена приходит из шаблона кабинета: продавец заводит
 * карточки сессиями по одной цене, и вбивать её в каждую из полусотни —
 * лишняя работа. Значение остаётся правимым в любой строке.
 */
export interface PrintDefaults {
  /** Цена из шаблона кабинета. В форме принта её поля больше нет. */
  price: number;
  /** «Цена до скидки» из шаблона. Уходит в Ozon, только если выше цены. */
  oldPrice: number;
}

export function emptyPrintDraft(): PrintDraft {
  return {
    key: nextKey(),
    name: '', slug: '', description: '', hashtags: '',
    extraPhotoUrls: '',
    gender: 'UNISEX', patternTags: [], unionKey: '',
    colorGroups: [emptyColorGroup()],
  };
}

/** Копия строки под новый принт: общее остаётся, своё у карточки — чистое. */
export function duplicateDraft(d: PrintDraft): PrintDraft {
  return {
    ...d,
    key: nextKey(),
    // Свой массив, а не ссылка на соседний: иначе правка тематики в одной
    // строке меняла бы её и во всех скопированных.
    patternTags: [...d.patternTags],
    // Фото цветов не копируем: это снимки другого принта, и подставить их
    // новому — тот же промах, что одно фото на все цвета.
    colorGroups: d.colorGroups.map((g) => ({ ...g, mainPhotoUrl: '', sizes: [...g.sizes] })),
    name: '', slug: '', extraPhotoUrls: '',
  };
}

/** Цветовые партии, заполненные достаточно, чтобы уйти в Ozon. */
function filledColorGroups(d: PrintDraft) {
  return d.colorGroups.filter(
    (g) => g.colorLabel && g.colorDictionaryValueId && g.sizes.length,
  );
}

/** Готовит тело запроса из черновика — здесь же живёт разбор многострочных/списочных полей. */
export function draftToPayload(
  d: PrintDraft,
  defaults: PrintDefaults,
): CreateOzonPrintDto {
  const groups = filledColorGroups(d);
  return {
    slug: d.slug.trim() || undefined,
    name: d.name.trim(),
    description: d.description.trim() || undefined,
    hashtags: d.hashtags.trim() || undefined,
    /*
     * У принта своего фото больше нет: снимок бывает только у цвета. Поле в
     * базе осталось запасным для карточек, заведённых раньше, поэтому шлём
     * туда фото первого цвета — два поля рядом путали и норовили заполниться
     * одной и той же картинкой дважды.
     */
    mainPhotoUrl: groups[0]?.mainPhotoUrl.trim() ?? '',
    extraPhotoUrls: d.extraPhotoUrls.split('\n').map((s) => s.trim()).filter(Boolean),
    // Цена и «цена до скидки» — из шаблона кабинета, одни на всю партию.
    price: defaults.price,
    oldPrice: defaults.oldPrice || undefined,
    gender: d.gender,
    patternTags: d.patternTags,
    ...(d.unionKey.trim() ? { unionKey: d.unionKey.trim() } : {}),
    colorGroups: groups
      .map((g): OzonColorGroupInput => ({
        colorLabel: g.colorLabel,
        colorDictionaryValueId: g.colorDictionaryValueId,
        colorCode: g.colorCode.trim() || colorCodeFor(g.colorLabel),
        ...(g.mainPhotoUrl.trim() ? { mainPhotoUrl: g.mainPhotoUrl.trim() } : {}),
        sizes: g.sizes,
      })),
  };
}

export function draftErrors(d: PrintDraft, defaults: PrintDefaults): string[] {
  const errors: string[] = [];
  if (d.name.trim().length < 3) errors.push('Название короче 3 символов');
  if (!defaults.price) {
    errors.push('В шаблоне кабинета не задана цена — задайте её вверху страницы');
  }
  /*
   * Каждый недозаполненный цвет называем отдельно.
   *
   * Раньше проверка срабатывала, только если не осталось ни одного годного
   * цвета. Значит при «чёрный + белый», где у белого не выбрано значение из
   * подсказки, карточка создавалась молча — с одним чёрным. На экране
   * оставались оба, в Ozon уходил один, и разойтись это могло надолго.
   */
  const groups = d.colorGroups.filter(
    (g) => g.colorLabel.trim() || g.colorDictionaryValueId || g.sizes.length,
  );
  if (!groups.length) {
    errors.push('Нужен хотя бы один цвет с размерами');
    return errors;
  }
  groups.forEach((g, i) => {
    const name = g.colorLabel.trim() || `цвет #${i + 1}`;
    if (!g.colorLabel.trim()) {
      errors.push(`Цвет #${i + 1}: не указан`);
    } else if (!g.colorDictionaryValueId) {
      errors.push(
        `Цвет «${name}»: выберите значение из подсказки — свободный текст Ozon не примет`,
      );
    }
    if (!g.sizes.length) errors.push(`Цвет «${name}»: не отмечен ни один размер`);
    // Фото теперь только у цвета, запасного больше нет — значит оно
    // обязательно у каждого. Иначе карточка уйдёт в Ozon без картинки.
    if (!g.mainPhotoUrl.trim()) errors.push(`Цвет «${name}»: не добавлено фото`);
  });

  /*
   * Два цвета с одинаковым кодом в артикуле.
   *
   * Артикул собирается как <код>-<цвет>-<размер>, поэтому «чёрный» и «Черный»
   * дают один и тот же JDM-1-1-black-M. Раньше это ловилось только базой уже
   * после отправки формы, и ответ приходил про «такой артикул существует» —
   * про артикул, которого человек в глаза не видел.
   */
  const codes = new Map<string, string[]>();
  for (const g of groups) {
    const code = (g.colorCode.trim() || colorCodeFor(g.colorLabel)).toLowerCase();
    if (!code) continue;
    codes.set(code, [...(codes.get(code) ?? []), g.colorLabel.trim() || code]);
  }
  for (const [code, labels] of codes) {
    if (labels.length > 1) {
      errors.push(
        `Цвета ${labels.map((l) => `«${l}»`).join(' и ')} дают один код «${code}» — артикулы совпадут. Задайте разные коды цвета.`,
      );
    }
  }

  return errors;
}
