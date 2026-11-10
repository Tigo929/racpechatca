import { MAX_PRINT_MM, MIN_PRINT_MM, tenth } from './approval-state';

/**
 * Настоящий размер макета — тот, с которым он уйдёт в печать.
 *
 * Берётся из самого файла и живёт отдельно от раскладки на мокапе.
 * Принт на фотографии футболки двигают и масштабируют на глаз, чтобы он
 * смотрелся на месте; размер отпечатка от этого не меняется — в печать
 * уходит прикреплённый файл, а не картинка с мокапа.
 *
 * Поэтому связи между раскладкой и сантиметрами нет ни в одну сторону:
 * мышь не трогает размер, размер не двигает картинку.
 */

/** Что сказал о размере тот, кто прислал файл. */
export interface DeclaredSize {
  widthMm?: number;
  heightMm?: number;
}

/** Что удалось вычитать из самого файла при сохранении. */
export interface SavedSource {
  sourceWidthMm?: number;
  sourceHeightMm?: number;
}

export interface PrintSizeMm {
  widthMm: number;
  heightMm: number;
}

/** Умолчание на случай, когда о размере не сказал никто. */
export const DEFAULT_WIDTH_MM = 280;

function usable(width?: number, height?: number): PrintSizeMm | null {
  if (!width || !height) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  const size = { widthMm: clampMm(width), heightMm: clampMm(height) };
  return size.widthMm > 0 && size.heightMm > 0 ? size : null;
}

function clampMm(mm: number): number {
  return Math.min(MAX_PRINT_MM, Math.max(MIN_PRINT_MM, tenth(mm)));
}

/**
 * Размер нового принта по старшинству источников.
 *
 * 1. Браузер: PDF он разбирает у себя и знает размер страницы точно —
 *    на сервер в этом случае приезжает уже картинка, и спрашивать её о
 *    сантиметрах бесполезно.
 * 2. Файл на сервере: размер страницы PDF или DPI картинки.
 * 3. Прежний размер этой стороны: перезаливают обычно исправленный макет
 *    того же размера, и повторно вводить его незачем.
 * 4. Умолчание в пропорциях исходника — его правят руками.
 */
export function realPrintSize(
  declared: DeclaredSize | undefined,
  saved: SavedSource,
  previous: PrintSizeMm | undefined,
  sourceRatio: number,
): PrintSizeMm {
  return (
    usable(declared?.widthMm, declared?.heightMm) ??
    usable(saved.sourceWidthMm, saved.sourceHeightMm) ??
    usable(previous?.widthMm, previous?.heightMm) ?? {
      widthMm: DEFAULT_WIDTH_MM,
      heightMm: tenth(DEFAULT_WIDTH_MM * (sourceRatio || 1)),
    }
  );
}
