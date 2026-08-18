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
  sizes: EnumTshirtSize[];
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
  name: string;
  slug: string;
  description: string;
  hashtags: string;
  mainPhotoUrl: string;
  extraPhotoUrls: string; // по одной ссылке на строку — парсится при отправке
  price: string;
  oldPrice: string;
  gender: EnumTshirtGender;
  patternTags: string; // через запятую
  /** «Объединить на одной карточке» в Ozon. Пусто — берётся код принта. */
  unionKey: string;
  colorGroups: ColorGroupDraft[];
}

export function emptyPrintDraft(): PrintDraft {
  return {
    name: '', slug: '', description: '', hashtags: '',
    mainPhotoUrl: '', extraPhotoUrls: '',
    price: '', oldPrice: '', gender: 'UNISEX', patternTags: '', unionKey: '',
    colorGroups: [{ colorLabel: '', colorDictionaryValueId: 0, colorCode: '', sizes: [...DEFAULT_SIZES] }],
  };
}

/** Готовит тело запроса из черновика — здесь же живёт разбор многострочных/списочных полей. */
export function draftToPayload(d: PrintDraft): CreateOzonPrintDto {
  return {
    slug: d.slug.trim() || undefined,
    name: d.name.trim(),
    description: d.description.trim() || undefined,
    hashtags: d.hashtags.trim() || undefined,
    mainPhotoUrl: d.mainPhotoUrl.trim(),
    extraPhotoUrls: d.extraPhotoUrls.split('\n').map((s) => s.trim()).filter(Boolean),
    price: Number(d.price) || 0,
    oldPrice: d.oldPrice.trim() ? Number(d.oldPrice) : undefined,
    gender: d.gender,
    patternTags: d.patternTags.split(',').map((s) => s.trim()).filter(Boolean),
    ...(d.unionKey.trim() ? { unionKey: d.unionKey.trim() } : {}),
    colorGroups: d.colorGroups
      .filter((g) => g.colorLabel && g.colorDictionaryValueId && g.sizes.length)
      .map((g): OzonColorGroupInput => ({
        colorLabel: g.colorLabel,
        colorDictionaryValueId: g.colorDictionaryValueId,
        colorCode: g.colorCode.trim() || colorCodeFor(g.colorLabel),
        sizes: g.sizes,
      })),
  };
}

export function draftErrors(d: PrintDraft): string[] {
  const errors: string[] = [];
  if (d.name.trim().length < 3) errors.push('Название короче 3 символов');
  if (!d.mainPhotoUrl.trim()) errors.push('Не указана ссылка на главное фото');
  if (!Number(d.price)) errors.push('Не указана цена');
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
  });
  return errors;
}
