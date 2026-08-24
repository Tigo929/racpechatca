import {
  estimateDpi,
  formatSizeCm,
  isCalibrated,
  isOutsidePrintArea,
  printQuality,
  printRect,
  pxPerMm,
  rotatedBounds,
  type PrintAreaCalibration,
} from './approval-geometry';
import { parseSides, type ApprovalSideState } from './approval-state';

/**
 * Шаблон из ТЗ: зона печати 720 × 900 пикселей равна 40 × 50 см.
 * То есть 18 пикселей на сантиметр — на этой калибровке считается всё
 * остальное, поэтому она же в тестах.
 */
const TEMPLATE: PrintAreaCalibration & { imageFile: string } = {
  imageFile: 'mockup-x.webp',
  printAreaX: 420,
  printAreaY: 380,
  printAreaWidth: 720,
  printAreaHeight: 900,
  printAreaWidthMm: 400,
  printAreaHeightMm: 500,
};

function side(overrides: Partial<ApprovalSideState> = {}): ApprovalSideState {
  return {
    templateKey: 'tshirt_black_front',
    printFile: 'print-1.webp',
    printOriginalName: 'logo.png',
    printWidthPx: 1800,
    printHeightPx: 2400,
    widthMm: 280,
    heightMm: 350,
    lockRatio: true,
    x: 0.5,
    y: 0.5,
    rotation: 0,
    ...overrides,
  };
}

describe('калибровка мокапа', () => {
  it('переводит сантиметры в пиксели по зоне печати', () => {
    // 720 px = 400 мм → 1.8 px на миллиметр.
    expect(pxPerMm(TEMPLATE)).toBeCloseTo(1.8);
  });

  it('без реального размера масштаба нет — вместо деления на ноль отдаём ноль', () => {
    expect(pxPerMm({ ...TEMPLATE, printAreaWidthMm: 0 })).toBe(0);
  });

  it('шаблон без фотографии и без зоны в работу не берётся', () => {
    expect(isCalibrated(TEMPLATE)).toBe(true);
    expect(isCalibrated({ ...TEMPLATE, imageFile: null })).toBe(false);
    expect(isCalibrated({ ...TEMPLATE, printAreaWidth: 0 })).toBe(false);
  });
});

describe('размещение принта', () => {
  it('принт 28 × 35 см занимает 504 × 630 пикселей', () => {
    const rect = printRect(side(), TEMPLATE);
    expect(rect.width).toBeCloseTo(504);
    expect(rect.height).toBeCloseTo(630);
  });

  it('центр 0.5/0.5 ставит принт ровно в середину зоны печати', () => {
    const rect = printRect(side(), TEMPLATE);
    // Середина зоны: 420 + 360 = 780 по X, 380 + 450 = 830 по Y.
    expect(rect.left + rect.width / 2).toBeCloseTo(780);
    expect(rect.top + rect.height / 2).toBeCloseTo(830);
  });

  it('поворот увеличивает габарит, но не двигает центр', () => {
    const rect = printRect(side(), TEMPLATE);
    const turned = rotatedBounds(rect, 90);
    expect(turned.width).toBeCloseTo(rect.height);
    expect(turned.height).toBeCloseTo(rect.width);
    expect(turned.left + turned.width / 2).toBeCloseTo(
      rect.left + rect.width / 2,
    );
  });
});

describe('выход за область печати', () => {
  it('принт по центру зоны укладывается', () => {
    expect(isOutsidePrintArea(side(), TEMPLATE)).toBe(false);
  });

  it('принт шире зоны печати помечается как вылезающий', () => {
    expect(isOutsidePrintArea(side({ widthMm: 420 }), TEMPLATE)).toBe(true);
  });

  it('сдвиг к краю выводит принт за зону', () => {
    expect(isOutsidePrintArea(side({ x: 0.9 }), TEMPLATE)).toBe(true);
  });

  it('принт ровно по ширине зоны не считается вылезшим', () => {
    // 400 мм — точная ширина зоны; допуск в пиксель гасит дробное округление.
    expect(
      isOutsidePrintArea(side({ widthMm: 400, heightMm: 500 }), TEMPLATE),
    ).toBe(false);
  });

  it('поворот квадратного принта выводит углы за зону', () => {
    const square = side({ widthMm: 400, heightMm: 400, rotation: 45 });
    expect(isOutsidePrintArea(square, TEMPLATE)).toBe(true);
  });
});

describe('качество исходника', () => {
  it('считает DPI по худшей стороне', () => {
    // 1800 px на 280 мм ≈ 163 dpi; 2400 px на 350 мм ≈ 174 dpi.
    expect(estimateDpi(side())).toBe(163);
  });

  it('маленький файл на большой печати даёт низкое качество', () => {
    const dpi = estimateDpi(side({ printWidthPx: 600, printHeightPx: 800 }));
    expect(printQuality(dpi)).toBe('LOW');
  });

  it('300 dpi и выше — зелёная зона', () => {
    const dpi = estimateDpi(
      side({
        printWidthPx: 3400,
        printHeightPx: 4200,
        widthMm: 280,
        heightMm: 350,
      }),
    );
    expect(printQuality(dpi)).toBe('GOOD');
  });

  it('без разрешения исходника DPI не выдумываем', () => {
    expect(estimateDpi(side({ printWidthPx: 0, printHeightPx: 0 }))).toBe(0);
  });
});

describe('подпись размера', () => {
  it('целые сантиметры пишутся без запятой', () => {
    expect(formatSizeCm(280, 350)).toBe('28 × 35 см');
  });

  it('половинки показываются', () => {
    expect(formatSizeCm(285, 350)).toBe('28,5 × 35 см');
  });
});

describe('чтение состояния из базы', () => {
  it('мусор вместо стороны отбрасывается, а не роняет заказ', () => {
    expect(parseSides({ FRONT: 'что-то не то', BACK: null })).toEqual({});
    expect(parseSides(null)).toEqual({});
    expect(parseSides('[]')).toEqual({});
  });

  it('сторона без ключа шаблона бесполезна и отбрасывается', () => {
    expect(parseSides({ FRONT: { printFile: 'a.webp' } })).toEqual({});
  });

  it('размер печати ограничивается разумными пределами', () => {
    const parsed = parseSides({
      FRONT: { templateKey: 'k', widthMm: 999999, heightMm: 0 },
    });
    expect(parsed.FRONT?.widthMm).toBe(2000);
    expect(parsed.FRONT?.heightMm).toBe(10);
  });

  it('сохранение пропорций включено, пока его явно не сняли', () => {
    expect(parseSides({ FRONT: { templateKey: 'k' } }).FRONT?.lockRatio).toBe(
      true,
    );
    expect(
      parseSides({ FRONT: { templateKey: 'k', lockRatio: false } }).FRONT
        ?.lockRatio,
    ).toBe(false);
  });
});
