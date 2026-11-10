import { describe, expect, it } from 'vitest';
import { printRect, pxPerMm, sizeFromView } from './approval-geometry';
import type { ApprovalSideState, MockupTemplate } from '../types/index';

/**
 * Размер печати, посчитанный по раскладке.
 *
 * Зеркало серверного расчёта (crm-new/src/approval/approval-geometry.ts):
 * сервер этот размер сохраняет и печатает на листе, а здесь он показывается
 * человеку, пока он тянет принт мышкой. Числа обязаны совпадать — иначе в
 * редакторе одно, а у клиента на листе другое.
 *
 * Значения в тестах те же, что в серверной спецификации: расхождение
 * увидит тот, кто поправит только одну сторону.
 */

/** Зона печати 720 × 900 px равна 40 × 50 см. */
const TEMPLATE = {
  printAreaX: 420,
  printAreaY: 380,
  printAreaWidth: 720,
  printAreaHeight: 900,
  printAreaWidthMm: 400,
  printAreaHeightMm: 500,
} as MockupTemplate;

const side = (over: Partial<ApprovalSideState> = {}): ApprovalSideState =>
  ({
    templateKey: 'tshirt_black_front',
    printFile: 'print.webp',
    printOriginalName: 'logo.png',
    printWidthPx: 1800,
    printHeightPx: 2400,
    widthMm: 280,
    heightMm: 350,
    viewWidth: 0,
    viewHeight: 0,
    lockRatio: true,
    x: 0.5,
    y: 0.5,
    rotation: 0,
    ...over,
  }) as ApprovalSideState;

describe('размер печати из раскладки', () => {
  it('доля зоны переводится в сантиметры зоны', () => {
    expect(sizeFromView(side({ viewWidth: 0.5, viewHeight: 0.25 }), TEMPLATE)).toEqual({
      widthMm: 200,
      heightMm: 125,
    });
  });

  it('принт во всю зону равен самой зоне', () => {
    expect(sizeFromView(side({ viewWidth: 1, viewHeight: 1 }), TEMPLATE)).toEqual({
      widthMm: 400,
      heightMm: 500,
    });
  });

  it('округление до десятой — как на сервере', () => {
    const size = sizeFromView(side({ viewWidth: 0.333, viewHeight: 0.333 }), TEMPLATE);
    expect(size).toEqual({ widthMm: 133.2, heightMm: 166.5 });
  });

  it('совпадает с тем, что нарисовано на холсте', () => {
    const state = side({ viewWidth: 0.37, viewHeight: 0.62 });
    const rect = printRect(state, TEMPLATE);
    expect(sizeFromView(state, TEMPLATE).widthMm).toBeCloseTo(
      rect.width / pxPerMm(TEMPLATE),
      1,
    );
  });

  it('старое согласование сохраняет записанный размер', () => {
    expect(sizeFromView(side(), TEMPLATE)).toEqual({ widthMm: 280, heightMm: 350 });
  });

  it('без калибровки зоны размер не выдумываем', () => {
    const blank = { printAreaWidthMm: 0, printAreaHeightMm: 0 } as MockupTemplate;
    expect(sizeFromView(side({ viewWidth: 0.5, viewHeight: 0.5 }), blank)).toEqual({
      widthMm: 280,
      heightMm: 350,
    });
  });

  it('крошечный принт не уходит ниже сантиметра', () => {
    expect(
      sizeFromView(side({ viewWidth: 0.001, viewHeight: 0.001 }), TEMPLATE).widthMm,
    ).toBe(10);
  });
});
