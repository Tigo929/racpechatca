/**
 * Размещение принта на шаблоне карточки.
 *
 * Всё здесь — чистая арифметика без файлов и базы: ровно она решает, каким
 * получится итоговое изображение, и ошибается тихо. Принт, вставший на сотню
 * пикселей мимо, заметен только глазами на готовой карточке, поэтому правила
 * вынесены отдельно и покрыты тестами.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Положение принта в долях области размещения.
 *
 * x и y — центр принта: 0.5/0.5 это ровно середина области. scale — доля от
 * «вписанного» размера: 1 означает, что принт занимает область целиком по
 * узкой стороне, 0.88 — что вокруг него остаётся воздух. Хранить пиксели
 * браузера нельзя: карточка собирается и в уменьшенном предпросмотре, и в
 * полном разрешении, и выглядеть должна одинаково.
 */
export interface CardTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/**
 * Заполнение области по умолчанию. 88% — середина рекомендованного коридора
 * 85–92%: принт крупный, но не упирается в края, и мелкие различия пропорций
 * между шаблонами не выталкивают его за границу.
 */
export const DEFAULT_FILL = 0.88;

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 3;

/** Дизайн вытянут относительно области сильнее, чем во столько раз. */
export const ASPECT_ALERT = 2.2;

/**
 * Насколько принт разрешено растянуть вверх от исходного разрешения.
 * 1.25 — то есть апскейл больше чем на четверть уже помечаем: на карточке
 * это видно как мыло, а Ozon такие фото пропускает и портит выдачу.
 */
export const MAX_UPSCALE = 1.25;

export const DEFAULT_TRANSFORM: CardTransform = {
  x: 0.5,
  y: 0.5,
  scale: DEFAULT_FILL,
  rotation: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Разбор transform из базы: колонка Json типизирована как «что угодно». */
export function parseTransform(value: unknown): CardTransform {
  if (!value || typeof value !== 'object') return { ...DEFAULT_TRANSFORM };
  const raw = value as Record<string, unknown>;
  const num = (key: string, fallback: number) =>
    typeof raw[key] === 'number' && Number.isFinite(raw[key])
      ? raw[key]
      : fallback;
  return {
    // Центр разрешаем увести за край области — это предупреждение, а не
    // запрет, — но не бесконечно, иначе принт уезжает за пределы холста.
    x: clamp(num('x', 0.5), -1, 2),
    y: clamp(num('y', 0.5), -1, 2),
    scale: clamp(num('scale', DEFAULT_FILL), MIN_SCALE, MAX_SCALE),
    rotation: clamp(num('rotation', 0), -180, 180),
  };
}

/** Разбор области размещения из базы. Нулевая область означает «не задана». */
export function parseRect(value: unknown): Rect {
  if (!value || typeof value !== 'object') {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const raw = value as Record<string, unknown>;
  const num = (key: string) =>
    typeof raw[key] === 'number' && Number.isFinite(raw[key])
      ? Math.round(raw[key])
      : 0;
  return {
    x: num('x'),
    y: num('y'),
    width: Math.max(0, num('width')),
    height: Math.max(0, num('height')),
  };
}

export function isUsableArea(area: Rect): boolean {
  return area.width > 0 && area.height > 0;
}

/**
 * Размер дизайна, вписанного в область целиком, с сохранением пропорций.
 * Именно вписанного, а не заполняющего: обрезать принт нельзя.
 */
export function containFit(design: Size, area: Rect): Size {
  if (design.width <= 0 || design.height <= 0 || !isUsableArea(area)) {
    return { width: 0, height: 0 };
  }
  const k = Math.min(area.width / design.width, area.height / design.height);
  return { width: design.width * k, height: design.height * k };
}

/** Куда и какого размера ложится принт на шаблоне, в пикселях шаблона. */
export function placementRect(
  design: Size,
  area: Rect,
  transform: CardTransform,
): Rect {
  const fitted = containFit(design, area);
  const width = fitted.width * transform.scale;
  const height = fitted.height * transform.scale;
  return {
    x: area.x + transform.x * area.width - width / 2,
    y: area.y + transform.y * area.height - height / 2,
    width,
    height,
  };
}

/** Габарит прямоугольника после поворота вокруг центра. */
export function rotatedBounds(rect: Rect, rotationDeg: number): Rect {
  if (!rotationDeg) return rect;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = rect.width * cos + rect.height * sin;
  const height = rect.width * sin + rect.height * cos;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

/** Выходит ли принт за пределы области (safe area, если она задана). */
export function isOutside(rect: Rect, area: Rect): boolean {
  const tolerance = 1;
  return (
    rect.x < area.x - tolerance ||
    rect.y < area.y - tolerance ||
    rect.x + rect.width > area.x + area.width + tolerance ||
    rect.y + rect.height > area.y + area.height + tolerance
  );
}

export type ReviewReason =
  | 'ASPECT'
  | 'LOW_RESOLUTION'
  | 'TINY_SOURCE'
  | 'OUTSIDE_AREA';

export const REVIEW_LABELS: Record<ReviewReason, string> = {
  ASPECT: 'Дизайн сильно вытянут — в области остаётся много пустого места',
  LOW_RESOLUTION: 'Исходник растягивается вверх — на карточке будет мыло',
  TINY_SOURCE: 'Слишком маленькое разрешение исходника',
  OUTSIDE_AREA: 'Принт выходит за область размещения',
};

/** Ниже этого размера исходник бессмысленно ставить на карточку вовсе. */
export const MIN_SOURCE_PX = 300;

/**
 * Почему карточку стоит показать человеку.
 *
 * Ничего не исправляем автоматически: агрессивная правка «на всякий случай»
 * портит нормальные дизайны, а разбирать потом придётся все сто. Помечаем и
 * даём открыть редактор.
 */
export function reviewReasons(
  design: Size,
  area: Rect,
  transform: CardTransform,
): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (design.width <= 0 || design.height <= 0 || !isUsableArea(area)) {
    return ['TINY_SOURCE'];
  }

  if (design.width < MIN_SOURCE_PX || design.height < MIN_SOURCE_PX) {
    reasons.push('TINY_SOURCE');
  }

  const designRatio = design.width / design.height;
  const areaRatio = area.width / area.height;
  const mismatch = Math.max(designRatio / areaRatio, areaRatio / designRatio);
  if (mismatch >= ASPECT_ALERT) reasons.push('ASPECT');

  const rect = placementRect(design, area, transform);
  if (rect.width > design.width * MAX_UPSCALE) {
    reasons.push('LOW_RESOLUTION');
  }
  if (isOutside(rotatedBounds(rect, transform.rotation), area)) {
    reasons.push('OUTSIDE_AREA');
  }

  return reasons;
}
