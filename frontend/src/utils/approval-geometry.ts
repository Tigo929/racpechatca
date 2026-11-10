import type { ApprovalSideState, MockupTemplate } from '../types/index';

/**
 * Геометрия согласования на стороне браузера.
 *
 * Повторяет crm-new/src/approval/approval-geometry.ts намеренно: сервер
 * рисует итоговый файл, а редактор должен показывать ровно то же самое ещё
 * до нажатия «Готово». Считать это на сервере при каждом движении мышью
 * нельзя — редактор перестанет быть отзывчивым. Если правится одна формула,
 * правятся обе; расхождение сразу поймает тест бэкенда.
 */

export const DPI_GOOD = 300;
export const DPI_ACCEPTABLE = 150;

const MM_PER_INCH = 25.4;

export type PrintQuality = 'GOOD' | 'ACCEPTABLE' | 'LOW';

export interface RectPx {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Шаблон готов к работе: есть фотография и задана зона печати. */
export function isCalibrated(template: MockupTemplate): boolean {
  return Boolean(
    template.imageFile &&
      template.printAreaWidth > 0 &&
      template.printAreaHeight > 0 &&
      template.printAreaWidthMm > 0 &&
      template.printAreaHeightMm > 0,
  );
}

/** Пикселей фотографии на миллиметр изделия. */
export function pxPerMm(template: MockupTemplate): number {
  if (template.printAreaWidthMm <= 0) return 0;
  return template.printAreaWidth / template.printAreaWidthMm;
}

export function printAreaRect(template: MockupTemplate): RectPx {
  return {
    left: template.printAreaX,
    top: template.printAreaY,
    width: template.printAreaWidth,
    height: template.printAreaHeight,
  };
}

/** Прямоугольник принта в пикселях фотографии, без учёта поворота. */
export function printRect(
  state: ApprovalSideState,
  template: MockupTemplate,
): RectPx {
  /*
   * Размер берём из доли зоны печати. Миллиметры сюда больше не входят: их
   * задают для отчёта, и раньше ввод «28 см» дёргал картинку на макете.
   *
   * Ноль — согласование сохранено до этой правки: считаем по-старому, от
   * миллиметров, чтобы прежние макеты выглядели как выглядели.
   */
  const scale = pxPerMm(template);
  const width = state.viewWidth
    ? state.viewWidth * template.printAreaWidth
    : state.widthMm * scale;
  const height = state.viewHeight
    ? state.viewHeight * template.printAreaHeight
    : state.heightMm * scale;
  const centerX = template.printAreaX + state.x * template.printAreaWidth;
  const centerY = template.printAreaY + state.y * template.printAreaHeight;
  return { left: centerX - width / 2, top: centerY - height / 2, width, height };
}

export function rotatedBounds(rect: RectPx, rotationDeg: number): RectPx {
  if (!rotationDeg) return rect;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = rect.width * cos + rect.height * sin;
  const height = rect.width * sin + rect.height * cos;
  return {
    left: rect.left + (rect.width - width) / 2,
    top: rect.top + (rect.height - height) / 2,
    width,
    height,
  };
}

export function isOutsidePrintArea(
  state: ApprovalSideState,
  template: MockupTemplate,
): boolean {
  const area = printAreaRect(template);
  const rect = rotatedBounds(printRect(state, template), state.rotation);
  const tolerance = 1;
  return (
    rect.left < area.left - tolerance ||
    rect.top < area.top - tolerance ||
    rect.left + rect.width > area.left + area.width + tolerance ||
    rect.top + rect.height > area.top + area.height + tolerance
  );
}

/** Фактический DPI печати по худшей стороне исходника. */
export function estimateDpi(state: ApprovalSideState): number {
  if (!state.printWidthPx || !state.printHeightPx) return 0;
  if (state.widthMm <= 0 || state.heightMm <= 0) return 0;
  return Math.round(
    Math.min(
      (state.printWidthPx * MM_PER_INCH) / state.widthMm,
      (state.printHeightPx * MM_PER_INCH) / state.heightMm,
    ),
  );
}

export function printQuality(dpi: number): PrintQuality {
  if (dpi >= DPI_GOOD) return 'GOOD';
  if (dpi >= DPI_ACCEPTABLE) return 'ACCEPTABLE';
  return 'LOW';
}

export const QUALITY_LABEL: Record<PrintQuality, string> = {
  GOOD: 'качество достаточное',
  ACCEPTABLE: 'допустимо, но лучше файл покрупнее',
  LOW: 'низкое разрешение для такого размера',
};

/** Миллиметры в сантиметры для полей ввода: там человек пишет «28», а не «280». */
export function mmToCm(mm: number): number {
  return Math.round(mm) / 10;
}

export function cmToMm(cm: number): number {
  return Math.round(cm * 10);
}

export function formatSizeCm(widthMm: number, heightMm: number): string {
  return `${formatCm(widthMm)} × ${formatCm(heightMm)} см`;
}

function formatCm(mm: number): string {
  const cm = mm / 10;
  return Number.isInteger(cm) ? String(cm) : cm.toFixed(1).replace('.', ',');
}
