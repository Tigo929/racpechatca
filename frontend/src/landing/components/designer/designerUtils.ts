import type { PrintArea } from './designerTypes';

/** Базовая система координат конструктора (как в TshirtSVG viewBox). */
export const BASE_W = 240;
export const BASE_H = 260;

/** SVG-путь силуэта футболки (тот же, что в TshirtSVG). */
export const SHIRT_PATH =
  'M82 26 L52 44 L30 78 L48 98 L66 86 L66 232 Q66 240 74 240 L166 240 Q174 240 174 232 L174 86 L192 98 L210 78 L188 44 L158 26 Q140 46 120 46 Q100 46 82 26 Z';

/** Путь воротника. */
export const COLLAR_PATH = 'M84 28 Q120 56 156 28';

/** Область печати на груди (в координатах 240×260). */
export const PRINT_AREA: PrintArea = { x: 84, y: 96, width: 72, height: 92 };

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];

export interface FileValidation {
  ok: boolean;
  error?: string;
}

/** Проверяет тип и размер файла макета. */
export function validateArtworkFile(file: File): FileValidation {
  const typeOk =
    ALLOWED_TYPES.includes(file.type) || /\.(png|jpe?g|svg)$/i.test(file.name);
  if (!typeOk) return { ok: false, error: 'Поддерживаются PNG, JPG и SVG' };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: 'Файл больше 10 МБ' };
  return { ok: true };
}

/** Загружает File в HTMLImageElement через object URL. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = url;
  });
}

/**
 * Вписывает изображение в область печати с сохранением пропорций и центрирует.
 * Возвращает базовый размер (width/height в координатах 240×260) и позицию центра.
 */
export function fitIntoPrintArea(
  imgW: number,
  imgH: number,
  area: PrintArea = PRINT_AREA,
) {
  const ratio = Math.min(area.width / imgW, area.height / imgH);
  const width = imgW * ratio;
  const height = imgH * ratio;
  return {
    width,
    height,
    // позиция верхнего левого угла для центрирования внутри области
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
  };
}

/** Ограничивает значение в диапазоне [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
