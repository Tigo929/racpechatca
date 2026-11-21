/**
 * Цвет печати «с полями» и «без полей»: различать с одного взгляда.
 *
 * 10×15 и 7,5×10 печатают и так и так, а формат пишется одной строкой:
 * «10×15 с полями» и «10×15 без полей» отличаются парой слов в середине.
 * Перепутать их легко, а перепечатка стоит бумаги и времени.
 *
 * Цвета не пересекаются с соседними в таблице позиций: синий и фиолетовый
 * там у типа бумаги (заливка строки), янтарный — пометка «своб.», красный
 * и зелёный — удаление и сохранение. Правило одно для карточки заказа и
 * формы создания, как и у типа бумаги (utils/paper-type.ts).
 */

export type PhotoBorder = 'WITH' | 'WITHOUT';

export interface PhotoBorderStyle {
  label: string;
  /** Плашка с форматом в таблице позиций. */
  badge: string;
  /** Поле ввода формата в форме, когда формат уже выбран. */
  field: string;
}

export const PHOTO_BORDER_STYLES: Record<PhotoBorder, PhotoBorderStyle> = {
  // Бирюзовая плашка с рамкой — рамка и есть «поля».
  WITH: {
    label: 'с полями',
    badge: 'bg-teal-50 text-teal-900 ring-2 ring-teal-500',
    field: 'bg-teal-50 text-teal-900 ring-2 ring-teal-500',
  },
  // Сплошная оранжевая заливка «до краёв» — без полей.
  WITHOUT: {
    label: 'без полей',
    badge: 'bg-orange-500 text-white',
    field: 'bg-orange-100 text-orange-900 font-semibold',
  },
};

/** С полями формат, без полей, или в названии об этом ничего нет. */
export function photoBorder(format: string): PhotoBorder | null {
  const text = format.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  if (/без\s*пол/.test(text)) return 'WITHOUT';
  if (/(^|\s)с\s*пол/.test(text)) return 'WITH';
  return null;
}

/** Стиль для позиции; свободную позицию (товар, не печать) не красим. */
export function photoBorderStyle(
  format: string,
  isFreePrice?: boolean,
): PhotoBorderStyle | null {
  if (isFreePrice) return null;
  const border = photoBorder(format);
  return border ? PHOTO_BORDER_STYLES[border] : null;
}
