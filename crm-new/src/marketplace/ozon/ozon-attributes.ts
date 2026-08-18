import { randomBytes } from 'node:crypto';
import type {
  EnumTshirtGender,
  EnumTshirtSize,
} from 'src/generated/prisma/enums';

/**
 * Всё, что нужно, чтобы собрать тело `/v3/product/import` для категории
 * «Футболка», без похода в Ozon и без базы. Числовые id ниже — не
 * произвольные догадки: каждый проверен вызовом
 * `/v1/description-category/attribute/values/search` на живом кабинете
 * 17.08.2026 (см. docs/ozon-integration.md). Ozon эти id не меняет — они
 * привязаны к самому словарю, а не к конкретному товару.
 */

/** attribute_id категории «Одежда»/«Футболка» — фиксированы, не настройка. */
export const OZON_ATTR = {
  UNION_KEY: 8292, // «Объединить на одной карточке»
  COLOR: 10096, // «Цвет товара»
  COLOR_NAME: 10097, // «Название цвета» — переиспользуем под внутренний слаг принта
  SIZE: 4295, // «Российский размер»
  MANUFACTURER_SIZE: 9533, // «Размер производителя» — дублируем российский размер
  TYPE: 8229, // «Тип»
  GENDER: 9163, // «Пол»
  MARKING: 23536, // «Нужен код маркировки»
  TNVED: 22232, // «ТН ВЭД коды ЕАЭС»
  BRAND: 31, // «Бренд в одежде и обуви»
  MATERIAL: 4496, // «Материал»
  MATERIAL_COMPOSITION: 4604, // «Состав материала» (свободный текст)
  COUNTRY: 4389, // «Страна-изготовитель»
  STYLE: 4501, // «Стиль»
  SEASON: 4495, // «Сезон»
  CARE: 4655, // «Уход за вещами» (свободный текст)
  SLEEVE: 4596, // «Тип рукава»
  NECKLINE: 11071, // «Вырез горловины»
  PACKAGE_TYPE: 4300, // «Тип упаковки одежды»
  PATTERN: 9437, // «Рисунок»
  HASHTAGS: 23171, // «#Хештеги»
  ANNOTATION: 4191, // «Аннотация» (описание)
} as const;

/**
 * Российский размер → dictionary_value_id атрибута 4295. Проверено на живом
 * кабинете: значения совпадают буква в букву с уже существующим
 * EnumTshirtSize (XS..XXXL = 44..56 через 2), поэтому отдельного enum под
 * Ozon не заводим — берём тот, что уже есть в схеме для футболочных заказов.
 */
export const SIZE_TO_OZON_DICTIONARY_ID: Record<EnumTshirtSize, number> = {
  XS: 35428, // 44
  S: 35429, // 46
  M: 35430, // 48
  L: 35431, // 50
  XL: 35432, // 52
  XXL: 35433, // 54
  XXXL: 35576, // 56
};

export const SIZE_TO_RUSSIAN_LABEL: Record<EnumTshirtSize, string> = {
  XS: '44',
  S: '46',
  M: '48',
  L: '50',
  XL: '52',
  XXL: '54',
  XXXL: '56',
};

/**
 * Стандартный набор размеров, который продавец использует по умолчанию для
 * каждого принта — ровно то, что описано как «у футболки 5 размеров».
 * XS и XXXL остаются доступны, но не отмечены по умолчанию.
 */
export const DEFAULT_SIZES: EnumTshirtSize[] = ['S', 'M', 'L', 'XL', 'XXL'];

/**
 * Пол → dictionary_value_id атрибута 9163. UNISEX уходит как сочетание
 * «Мужской;Женский» — так делает сам продавец в живых карточках; своего
 * значения «унисекс» у Ozon для этой категории нет, только комбинация 2-4
 * значений пола.
 */
export const GENDER_TO_OZON_DICTIONARY_IDS: Record<EnumTshirtGender, number[]> =
  {
    UNISEX: [22880, 22881], // Мужской, Женский
    MALE: [22880],
    FEMALE: [22881],
    KIDS: [22882, 22883], // Девочки, Мальчики
  };

/** Символы, которые Ozon запрещает в названии файла и артикуле. а-я не включает ё. */
const SLUG_UNSAFE = /[^a-zа-яё0-9-]+/gi;

function stripUnsafe(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '-')
    .replace(SLUG_UNSAFE, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Слаг принта, выведенный из названия товара: приводим к нижнему регистру. */
export function slugify(input: string): string {
  return stripUnsafe(input.toLowerCase());
}

/**
 * Слаг, введённый человеком вручную (например «JDM-1-1»), — регистр
 * сохраняем. У продавца код принта заглавный и совпадает с именем папки
 * макетов, а offer_id в Ozon регистрозависим: привести к нижнему регистру
 * значило бы разойтись с его собственной номенклатурой.
 */
export function normalizeSlug(input: string): string {
  return stripUnsafe(input);
}

/**
 * Латинский код цвета для артикула. Цвет в карточке выбирается из словаря
 * Ozon и приходит по-русски («черный»), а в артикуле у продавца стоит
 * латиница — переводим по таблице, для незнакомого цвета транслитерируем.
 */
const COLOR_CODE_BY_LABEL: Record<string, string> = {
  черный: 'black',
  чёрный: 'black',
  белый: 'white',
  серый: 'gray',
  синий: 'blue',
  голубой: 'lightblue',
  красный: 'red',
  зеленый: 'green',
  зелёный: 'green',
  желтый: 'yellow',
  жёлтый: 'yellow',
  оранжевый: 'orange',
  розовый: 'pink',
  фиолетовый: 'purple',
  коричневый: 'brown',
  бежевый: 'beige',
  бордовый: 'burgundy',
  хаки: 'khaki',
};

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function colorCodeFor(colorLabel: string): string {
  const key = colorLabel.trim().toLowerCase();
  const known = COLOR_CODE_BY_LABEL[key];
  if (known) return known;
  return stripUnsafe([...key].map((ch) => TRANSLIT[ch] ?? ch).join(''));
}

/**
 * offer_id по схеме продавца: `<принт>-<цвет>-<размер>` — например
 * `JDM-1-1-black-S`, где JDM это категория темы, первая единица —
 * подгруппа, вторая — пункт. Цвет обязателен в артикуле: без него два
 * цвета одного принта столкнулись бы на одинаковом размере.
 */
export function buildOfferId(
  printSlug: string,
  colorCode: string,
  size: EnumTshirtSize,
): string {
  return `${printSlug}-${colorCode}-${size}`;
}

/**
 * Значение атрибута 8292 «Объединить на одной карточке» — свободная строка,
 * важно только чтобы она была одинаковой у всех вариантов принта и не
 * совпадала со значением другого принта. 32 hex-символа — тот же формат,
 * что уже использует продавец в существующих карточках.
 */
export function generateUnionKey(): string {
  return randomBytes(16).toString('hex');
}

export interface OzonImportAttributeValue {
  dictionary_value_id?: number;
  value?: string;
}

export interface OzonImportAttribute {
  id: number;
  complex_id?: number;
  values: OzonImportAttributeValue[];
}

/** Габариты упаковки одного варианта. */
export interface VariantDimensions {
  weightG: number;
  widthMm: number;
  heightMm: number;
  lengthMm: number;
}

/** Всё, что нужно из шаблона кабинета для сборки одного варианта. */
export interface CatalogTemplateForImport {
  descriptionCategoryId: number;
  typeId: number;
  vatRate: string;
  needsMarkingCode: boolean;
  brandDictionaryValueId: number;
  countryDictionaryValueId: number | null;
  materialDictionaryValueId: number | null;
  materialComposition: string | null;
  styleDictionaryValueId: number | null;
  seasonDictionaryValueId: number | null;
  careInstructions: string | null;
  sleeveDictionaryValueId: number | null;
  necklineDictionaryValueId: number | null;
  packageTypeDictionaryValueId: number | null;
  tnvedDictionaryValueId: number | null;
  sizeDimensions: Record<string, VariantDimensions>;
  /** Общие доп. фото кабинета — одинаковые во всех карточках. */
  sharedPhotoUrls: string[];
}

/** Ozon принимает не больше 14 дополнительных фото на карточку. */
export const MAX_EXTRA_PHOTOS = 14;

export interface PrintForImport {
  slug: string;
  name: string;
  description: string | null;
  hashtags: string | null;
  mainPhotoUrl: string;
  extraPhotoUrls: string[];
  price: number;
  oldPrice: number | null;
  gender: EnumTshirtGender;
  patternTags: string[];
  unionKey: string;
}

export interface VariantForImport {
  offerId: string;
  colorLabel: string;
  colorDictionaryValueId: number;
  size: EnumTshirtSize;
  priceOverride: number | null;
}

/** Тело одного элемента массива `items` в `/v3/product/import`. */
export interface OzonImportItem {
  offer_id: string;
  name: string;
  description_category_id: number;
  /**
   * Тип товара отдельным полем — обязателен, несмотря на то что он же уходит
   * атрибутом 8229. Без него Ozon отвечает 400 «invalid Request.Items.TypeId:
   * value must be greater than 0»; проверено живой загрузкой 17.08.2026.
   * Разборы API в интернете утверждают обратное — не верить, проверять.
   */
  type_id: number;
  price: string;
  old_price: string;
  vat: string;
  currency_code: 'RUB';
  weight: number;
  width: number;
  height: number;
  depth: number;
  dimension_unit: 'mm';
  weight_unit: 'g';
  images: string[];
  primary_image: string;
  attributes: OzonImportAttribute[];
}

function textAttr(
  id: number,
  value: string | null | undefined,
): OzonImportAttribute | null {
  if (!value) return null;
  return { id, values: [{ value }] };
}

function dictAttr(
  id: number,
  dictionaryValueId: number | null | undefined,
): OzonImportAttribute | null {
  if (!dictionaryValueId) return null;
  return { id, values: [{ dictionary_value_id: dictionaryValueId }] };
}

function dictListAttr(id: number, ids: number[]): OzonImportAttribute {
  return {
    id,
    values: ids.map((dictionary_value_id) => ({ dictionary_value_id })),
  };
}

/**
 * VAT в проценте, который принимает `/v3/product/import` — не совпадает с
 * подписью в выпадающем списке экспорт-шаблона («Не облагается» → «0»).
 */
function vatToApiValue(vatRate: string): string {
  const numeric = vatRate.match(/\d+/)?.[0];
  return numeric ?? '0';
}

/**
 * Собирает один элемент запроса `/v3/product/import` из шаблона кабинета,
 * принта и конкретного варианта. Чистая функция — не ходит в сеть и в базу,
 * поэтому проверяется юнит-тестом без моков Prisma/HTTP.
 */
export function buildImportItem(
  template: CatalogTemplateForImport,
  print: PrintForImport,
  variant: VariantForImport,
): OzonImportItem {
  const dims =
    template.sizeDimensions[variant.size] ??
    // Размер не заведён в таблице шаблона — берём соседний как компромисс,
    // лишь бы не уронить весь импорт из-за одной недостающей строки.
    Object.values(template.sizeDimensions)[0];
  if (!dims) {
    throw new Error(
      `В шаблоне кабинета не заданы габариты ни для одного размера — нечем заполнить вариант ${variant.offerId}`,
    );
  }

  const price = variant.priceOverride ?? print.price;
  const oldPrice = print.oldPrice ?? 0;

  const attributes = [
    { id: OZON_ATTR.UNION_KEY, values: [{ value: print.unionKey }] },
    dictAttr(OZON_ATTR.COLOR, variant.colorDictionaryValueId),
    textAttr(OZON_ATTR.COLOR_NAME, print.slug),
    dictAttr(OZON_ATTR.SIZE, SIZE_TO_OZON_DICTIONARY_ID[variant.size]),
    textAttr(OZON_ATTR.MANUFACTURER_SIZE, SIZE_TO_RUSSIAN_LABEL[variant.size]),
    dictAttr(OZON_ATTR.TYPE, template.typeId),
    dictListAttr(OZON_ATTR.GENDER, GENDER_TO_OZON_DICTIONARY_IDS[print.gender]),
    {
      id: OZON_ATTR.MARKING,
      values: [{ value: template.needsMarkingCode ? 'true' : 'false' }],
    },
    dictAttr(OZON_ATTR.TNVED, template.tnvedDictionaryValueId),
    dictAttr(OZON_ATTR.BRAND, template.brandDictionaryValueId),
    dictAttr(OZON_ATTR.MATERIAL, template.materialDictionaryValueId),
    textAttr(OZON_ATTR.MATERIAL_COMPOSITION, template.materialComposition),
    dictAttr(OZON_ATTR.COUNTRY, template.countryDictionaryValueId),
    dictAttr(OZON_ATTR.STYLE, template.styleDictionaryValueId),
    dictAttr(OZON_ATTR.SEASON, template.seasonDictionaryValueId),
    textAttr(OZON_ATTR.CARE, template.careInstructions),
    dictAttr(OZON_ATTR.SLEEVE, template.sleeveDictionaryValueId),
    dictAttr(OZON_ATTR.NECKLINE, template.necklineDictionaryValueId),
    dictAttr(OZON_ATTR.PACKAGE_TYPE, template.packageTypeDictionaryValueId),
    print.patternTags.length
      ? dictListAttrFromLabels(OZON_ATTR.PATTERN, print.patternTags)
      : null,
    textAttr(OZON_ATTR.HASHTAGS, print.hashtags),
    textAttr(OZON_ATTR.ANNOTATION, print.description),
  ].filter((a): a is OzonImportAttribute => a !== null);

  return {
    offer_id: variant.offerId,
    name: print.name,
    description_category_id: template.descriptionCategoryId,
    type_id: template.typeId,
    price: String(price),
    old_price: String(oldPrice),
    vat: vatToApiValue(template.vatRate),
    currency_code: 'RUB',
    weight: dims.weightG,
    width: dims.widthMm,
    height: dims.heightMm,
    depth: dims.lengthMm,
    dimension_unit: 'mm',
    weight_unit: 'g',
    images: buildExtraImages(template, print),
    primary_image: print.mainPhotoUrl,
    attributes,
  };
}

/**
 * Дополнительные фото карточки: сначала свои у принта (если он чем-то
 * отличается), затем общие из шаблона — размерная сетка, условия доставки и
 * прочее, одинаковое во всех товарах. Дубли убираем: одна и та же ссылка
 * дважды — это ошибка модерации, а не два разных изображения.
 */
export function buildExtraImages(
  template: Pick<CatalogTemplateForImport, 'sharedPhotoUrls'>,
  print: Pick<PrintForImport, 'extraPhotoUrls' | 'mainPhotoUrl'>,
): string[] {
  const all = [...print.extraPhotoUrls, ...template.sharedPhotoUrls];
  const seen = new Set<string>([print.mainPhotoUrl]);
  const result: string[] = [];
  for (const url of all) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length === MAX_EXTRA_PHOTOS) break;
  }
  return result;
}

/**
 * Рисунок/тематика (атрибут 9437).
 *
 * Комментарий здесь раньше утверждал, что Ozon принимает свободный текст.
 * Это неверно: площадка отклонила публикацию всех вариантов со словами
 * «указывайте только значения из списка». Значения теперь выбираются из
 * словаря в интерфейсе, сюда приходят готовыми подписями из того же списка.
 */
function dictListAttrFromLabels(
  id: number,
  labels: string[],
): OzonImportAttribute {
  return { id, values: labels.map((value) => ({ value })) };
}

/** До скольки вариантов Ozon принимает за один вызов `/v3/product/import`. */
export const IMPORT_BATCH_SIZE = 100;

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
