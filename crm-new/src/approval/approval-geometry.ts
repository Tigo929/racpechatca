import type { ApprovalSideState } from './approval-state';

/**
 * Калибровка мокапа: зона печати в пикселях фотографии и её реальный размер.
 * Ровно та пара, из которой берётся масштаб «пикселей на миллиметр».
 */
export interface PrintAreaCalibration {
  printAreaX: number;
  printAreaY: number;
  printAreaWidth: number;
  printAreaHeight: number;
  printAreaWidthMm: number;
  printAreaHeightMm: number;
}

export interface RectPx {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Пороги качества печати. Не разбросаны по коду: их меняют целиком. */
export const DPI_GOOD = 300;
export const DPI_ACCEPTABLE = 150;

export type PrintQuality = 'GOOD' | 'ACCEPTABLE' | 'LOW';

const MM_PER_INCH = 25.4;

/** Шаблон считается готовым к работе, только если откалиброван и есть фото. */
export function isCalibrated(
  template: PrintAreaCalibration & { imageFile?: string | null },
): boolean {
  return Boolean(
    template.imageFile &&
    template.printAreaWidth > 0 &&
    template.printAreaHeight > 0 &&
    template.printAreaWidthMm > 0 &&
    template.printAreaHeightMm > 0,
  );
}

/**
 * Сколько пикселей фотографии приходится на миллиметр реального изделия.
 *
 * Считаем по ширине: она измеряется по груди рулеткой надёжнее, чем высота,
 * которую легко «съедает» перспектива при съёмке сверху.
 */
export function pxPerMm(template: PrintAreaCalibration): number {
  if (template.printAreaWidthMm <= 0) return 0;
  return template.printAreaWidth / template.printAreaWidthMm;
}

/** Прямоугольник зоны печати в пикселях фотографии. */
export function printAreaRect(template: PrintAreaCalibration): RectPx {
  return {
    left: template.printAreaX,
    top: template.printAreaY,
    width: template.printAreaWidth,
    height: template.printAreaHeight,
  };
}

/**
 * Куда и какого размера ложится принт на фотографии мокапа.
 * Возвращает неповёрнутый прямоугольник — поворот учитывается отдельно,
 * потому что повёрнутая картинка занимает больший габарит.
 */
export function printRect(
  state: ApprovalSideState,
  template: PrintAreaCalibration,
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
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  };
}

/** Габарит прямоугольника после поворота вокруг собственного центра. */
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

/**
 * Вылезает ли принт за допустимую область печати.
 *
 * Допуск в один пиксель намеренный: принт, выставленный ровно по краю зоны,
 * не должен мигать предупреждением из-за округления дробных координат.
 */
export function isOutsidePrintArea(
  state: ApprovalSideState,
  template: PrintAreaCalibration,
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

/**
 * Фактическое разрешение печати: сколько точек исходника придётся на дюйм
 * при выбранном физическом размере. Считаем по обеим сторонам и берём
 * худшую — печать не бывает качественнее своего слабого измерения.
 */
export function estimateDpi(state: ApprovalSideState): number {
  if (!state.printWidthPx || !state.printHeightPx) return 0;
  if (state.widthMm <= 0 || state.heightMm <= 0) return 0;
  const byWidth = (state.printWidthPx * MM_PER_INCH) / state.widthMm;
  const byHeight = (state.printHeightPx * MM_PER_INCH) / state.heightMm;
  return Math.round(Math.min(byWidth, byHeight));
}

export function printQuality(dpi: number): PrintQuality {
  if (dpi >= DPI_GOOD) return 'GOOD';
  if (dpi >= DPI_ACCEPTABLE) return 'ACCEPTABLE';
  return 'LOW';
}

/** Размер печати «28 × 35 см» из миллиметров. Дробную часть показываем только когда она есть. */
export function formatSizeCm(widthMm: number, heightMm: number): string {
  return `${formatCm(widthMm)} × ${formatCm(heightMm)} см`;
}

function formatCm(mm: number): string {
  const cm = mm / 10;
  return Number.isInteger(cm) ? String(cm) : cm.toFixed(1).replace('.', ',');
}
