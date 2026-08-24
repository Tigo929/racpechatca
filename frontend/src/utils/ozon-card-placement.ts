import type { CardRect, CardTransform, ImageCardGenerated } from '../types/index';

/**
 * Геометрия карточки Ozon на стороне браузера.
 *
 * Повторяет crm-new/src/marketplace/image-cards/image-card-placement.ts
 * намеренно: сервер рисует итоговый файл, а редактор обязан показывать ровно
 * то же самое до сохранения. Считать это на сервере при каждом движении мышью
 * нельзя — редактор перестанет быть отзывчивым. Правится одна формула —
 * правятся обе; расхождение поймает тест бэкенда.
 */

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 3;
/** Заполнение по умолчанию — середина рекомендованного ТЗ коридора 85–92%. */
export const DEFAULT_FILL = 0.88;

export const DEFAULT_CARD_TRANSFORM: CardTransform = {
  x: 0.5,
  y: 0.5,
  scale: DEFAULT_FILL,
  rotation: 0,
};

export interface CardSnapshot {
  canvasWidth: number;
  canvasHeight: number;
  placementArea: CardRect;
}

export function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/**
 * Снимок шаблона из карточки. Читаем защитно: поле хранится как JSON и
 * могло быть записано прошлой версией кода.
 */
export function readCardSnapshot(card: ImageCardGenerated): CardSnapshot | null {
  const raw = card.templateSnapshot;
  if (!raw) return null;
  const canvasWidth = Number(raw.canvasWidth) || 0;
  const canvasHeight = Number(raw.canvasHeight) || 0;
  if (canvasWidth <= 0 || canvasHeight <= 0) return null;

  const area = (raw.placementArea ?? {}) as Record<string, unknown>;
  return {
    canvasWidth,
    canvasHeight,
    placementArea: {
      x: Number(area.x) || 0,
      y: Number(area.y) || 0,
      width: Number(area.width) || 0,
      height: Number(area.height) || 0,
    },
  };
}

export function readCardTransform(card: ImageCardGenerated): CardTransform {
  const raw = card.transform ?? {};
  const num = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    x: num(raw.x, 0.5),
    y: num(raw.y, 0.5),
    scale: clampScale(num(raw.scale, DEFAULT_FILL)),
    rotation: num(raw.rotation, 0),
  };
}

/** Размер дизайна, вписанного в область целиком, с сохранением пропорций. */
export function containFit(
  design: { width: number; height: number },
  area: CardRect,
): { width: number; height: number } {
  if (design.width <= 0 || design.height <= 0 || area.width <= 0 || area.height <= 0) {
    return { width: 0, height: 0 };
  }
  const k = Math.min(area.width / design.width, area.height / design.height);
  return { width: design.width * k, height: design.height * k };
}

/** Куда и какого размера ложится принт, в пикселях шаблона. */
export function cardPlacementRect(
  design: { width: number; height: number },
  area: CardRect,
  transform: CardTransform,
): { left: number; top: number; width: number; height: number } {
  const fitted = containFit(design, area);
  const width = fitted.width * transform.scale;
  const height = fitted.height * transform.scale;
  return {
    left: area.x + transform.x * area.width - width / 2,
    top: area.y + transform.y * area.height - height / 2,
    width,
    height,
  };
}

/** Вылезает ли принт за область. Допуск в пиксель гасит дробное округление. */
export function isCardOutside(
  rect: { left: number; top: number; width: number; height: number },
  area: CardRect,
): boolean {
  const tolerance = 1;
  return (
    rect.left < area.x - tolerance ||
    rect.top < area.y - tolerance ||
    rect.left + rect.width > area.x + area.width + tolerance ||
    rect.top + rect.height > area.y + area.height + tolerance
  );
}
