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
  sizes: EnumTshirtSize[];
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
  colorGroups: ColorGroupDraft[];
}

export function emptyPrintDraft(): PrintDraft {
  return {
    name: '', slug: '', description: '', hashtags: '',
    mainPhotoUrl: '', extraPhotoUrls: '',
    price: '', oldPrice: '', gender: 'UNISEX', patternTags: '',
    colorGroups: [{ colorLabel: '', colorDictionaryValueId: 0, sizes: [...DEFAULT_SIZES] }],
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
    colorGroups: d.colorGroups
      .filter((g) => g.colorLabel && g.colorDictionaryValueId && g.sizes.length)
      .map((g): OzonColorGroupInput => ({
        colorLabel: g.colorLabel, colorDictionaryValueId: g.colorDictionaryValueId, sizes: g.sizes,
      })),
  };
}

export function draftErrors(d: PrintDraft): string[] {
  const errors: string[] = [];
  if (d.name.trim().length < 3) errors.push('Название короче 3 символов');
  if (!d.mainPhotoUrl.trim()) errors.push('Не указана ссылка на главное фото');
  if (!Number(d.price)) errors.push('Не указана цена');
  const validGroups = d.colorGroups.filter((g) => g.colorLabel && g.colorDictionaryValueId && g.sizes.length);
  if (!validGroups.length) errors.push('Нужен хотя бы один цвет с выбранным значением из подсказки и размерами');
  return errors;
}
