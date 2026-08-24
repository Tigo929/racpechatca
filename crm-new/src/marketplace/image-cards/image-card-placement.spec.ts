import {
  ASPECT_ALERT,
  containFit,
  DEFAULT_FILL,
  isOutside,
  parseRect,
  parseTransform,
  placementRect,
  reviewReasons,
  rotatedBounds,
  type CardTransform,
  type Rect,
} from './image-card-placement';

/**
 * Область размещения на шаблоне 1200 × 1600: квадрат 600 × 800 по центру
 * груди. На ней считается всё остальное, поэтому она же и в тестах.
 */
const AREA: Rect = { x: 300, y: 400, width: 600, height: 800 };

const transform = (over: Partial<CardTransform> = {}): CardTransform => ({
  x: 0.5,
  y: 0.5,
  scale: DEFAULT_FILL,
  rotation: 0,
  ...over,
});

describe('вписывание дизайна', () => {
  it('широкий дизайн упирается в ширину области', () => {
    // 1200 × 600 при области 600 × 800: ограничивает ширина.
    const fitted = containFit({ width: 1200, height: 600 }, AREA);
    expect(fitted.width).toBeCloseTo(600);
    expect(fitted.height).toBeCloseTo(300);
  });

  it('высокий дизайн упирается в высоту области', () => {
    const fitted = containFit({ width: 600, height: 1200 }, AREA);
    expect(fitted.height).toBeCloseTo(800);
    expect(fitted.width).toBeCloseTo(400);
  });

  it('пропорции сохраняются — по одной оси не растягиваем', () => {
    const design = { width: 900, height: 300 };
    const fitted = containFit(design, AREA);
    expect(fitted.width / fitted.height).toBeCloseTo(
      design.width / design.height,
    );
  });

  it('пустой дизайн или пустая область дают нули, а не деление на ноль', () => {
    expect(containFit({ width: 0, height: 0 }, AREA)).toEqual({
      width: 0,
      height: 0,
    });
    expect(
      containFit(
        { width: 100, height: 100 },
        { x: 0, y: 0, width: 0, height: 0 },
      ),
    ).toEqual({ width: 0, height: 0 });
  });
});

describe('положение на шаблоне', () => {
  it('по умолчанию принт по центру области и занимает 88% вписанного размера', () => {
    const rect = placementRect({ width: 600, height: 800 }, AREA, transform());
    expect(rect.width).toBeCloseTo(600 * DEFAULT_FILL);
    expect(rect.height).toBeCloseTo(800 * DEFAULT_FILL);
    // Середина области: 300 + 300 = 600 по X, 400 + 400 = 800 по Y.
    expect(rect.x + rect.width / 2).toBeCloseTo(600);
    expect(rect.y + rect.height / 2).toBeCloseTo(800);
  });

  it('масштаб 1 заполняет область целиком по узкой стороне', () => {
    const rect = placementRect(
      { width: 600, height: 800 },
      AREA,
      transform({ scale: 1 }),
    );
    expect(rect.width).toBeCloseTo(AREA.width);
    expect(isOutside(rect, AREA)).toBe(false);
  });

  it('поворот меняет габарит, но не центр', () => {
    const rect = placementRect({ width: 600, height: 800 }, AREA, transform());
    const turned = rotatedBounds(rect, 90);
    expect(turned.width).toBeCloseTo(rect.height);
    expect(turned.x + turned.width / 2).toBeCloseTo(rect.x + rect.width / 2);
  });
});

describe('что показать человеку', () => {
  it('обычный дизайн вопросов не вызывает', () => {
    expect(
      reviewReasons({ width: 1200, height: 1600 }, AREA, transform()),
    ).toEqual([]);
  });

  it('сильно вытянутый дизайн помечается', () => {
    // Полоса 2000 × 200 против области 3:4 — соотношения расходятся в разы.
    const reasons = reviewReasons(
      { width: 2000, height: 200 },
      AREA,
      transform(),
    );
    expect(reasons).toContain('ASPECT');
  });

  it('дизайн, который приходится растягивать вверх, помечается', () => {
    // 400 × 533 вписывается в 600 × 800, то есть увеличивается в полтора раза.
    const reasons = reviewReasons(
      { width: 400, height: 533 },
      AREA,
      transform(),
    );
    expect(reasons).toContain('LOW_RESOLUTION');
  });

  it('крошечный исходник помечается отдельно', () => {
    const reasons = reviewReasons(
      { width: 120, height: 160 },
      AREA,
      transform(),
    );
    expect(reasons).toContain('TINY_SOURCE');
  });

  it('уведённый за край принт помечается', () => {
    const reasons = reviewReasons(
      { width: 1200, height: 1600 },
      AREA,
      transform({ x: 1.2 }),
    );
    expect(reasons).toContain('OUTSIDE_AREA');
  });

  it('порог вытянутости именно на границе не срабатывает раньше времени', () => {
    // Соотношение области 0.75; берём дизайн чуть мягче порога.
    const ratio = (0.75 * ASPECT_ALERT) / 1.05;
    const reasons = reviewReasons(
      { width: 1000 * ratio, height: 1000 },
      AREA,
      transform(),
    );
    expect(reasons).not.toContain('ASPECT');
  });
});

describe('чтение из базы', () => {
  it('мусор вместо transform заменяется значением по умолчанию', () => {
    expect(parseTransform(null)).toEqual({
      x: 0.5,
      y: 0.5,
      scale: DEFAULT_FILL,
      rotation: 0,
    });
    expect(parseTransform('что-то')).toEqual({
      x: 0.5,
      y: 0.5,
      scale: DEFAULT_FILL,
      rotation: 0,
    });
  });

  it('масштаб удерживается в разумных пределах', () => {
    expect(parseTransform({ scale: 99 }).scale).toBe(3);
    expect(parseTransform({ scale: -5 }).scale).toBe(0.05);
  });

  it('область без размеров читается как незаданная', () => {
    expect(parseRect({ x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      width: 0,
      height: 0,
    });
    expect(parseRect(undefined)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
