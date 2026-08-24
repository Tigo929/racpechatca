import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import sharp from 'sharp';
import { ApprovalStorageService } from './approval-storage.service';
import {
  ApprovalRenderService,
  type RenderSideInput,
} from './approval-render.service';
import type { ApprovalSideState } from './approval-state';

/**
 * Рендер листа целиком, на настоящих файлах и настоящем sharp.
 *
 * Проверяем именно пиксели: арифметика наложения ошибается тихо — принт
 * встаёт на пару сотен точек мимо, и заметить это можно только глазами на
 * готовом макете. Отдельно проверяем принт, свисающий за край фотографии:
 * sharp отказывается класть накладку больше основы, поэтому невидимую часть
 * мы обрезаем сами, и эта ветка обязана работать.
 */

const MOCKUP_W = 800;
const MOCKUP_H = 1000;

/** Зона печати 400 × 500 px = 200 × 250 мм, то есть ровно 2 точки на миллиметр. */
const CALIBRATION = {
  printAreaX: 200,
  printAreaY: 200,
  printAreaWidth: 400,
  printAreaHeight: 500,
  printAreaWidthMm: 200,
  printAreaHeightMm: 250,
};

describe('отрисовка согласования', () => {
  let dir: string;
  let storage: ApprovalStorageService;
  let render: ApprovalRenderService;
  let mockupFile: string;
  let printFile: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'approval-render-'));
    storage = new ApprovalStorageService({
      get: () => dir,
    } as never);
    render = new ApprovalRenderService(storage);

    // Серая «футболка» и красный «принт» — контрастная пара, по которой
    // видно, куда именно лёг принт.
    const mockup = await sharp({
      create: {
        width: MOCKUP_W,
        height: MOCKUP_H,
        channels: 3,
        background: '#808080',
      },
    })
      .png()
      .toBuffer();
    const print = await sharp({
      create: {
        width: 600,
        height: 750,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    mockupFile = (
      await storage.saveMockup({
        buffer: mockup,
        mimetype: 'image/png',
        size: mockup.length,
      })
    ).filename;
    printFile = (
      await storage.savePrint({
        buffer: print,
        mimetype: 'image/png',
        size: print.length,
      })
    ).filename;
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  function side(overrides: Partial<ApprovalSideState> = {}): RenderSideInput {
    const state: ApprovalSideState = {
      templateKey: 'tshirt_black_front',
      printFile,
      printOriginalName: 'print.png',
      printWidthPx: 600,
      printHeightPx: 750,
      widthMm: 100,
      heightMm: 125,
      lockRatio: true,
      x: 0.5,
      y: 0.5,
      rotation: 0,
      ...overrides,
    };
    return {
      side: 'FRONT',
      state,
      template: {
        ...CALIBRATION,
        imageFile: mockupFile,
        imageWidth: MOCKUP_W,
        imageHeight: MOCKUP_H,
      },
    };
  }

  async function pixelAt(buffer: Buffer, x: number, y: number) {
    const { data } = await sharp(buffer)
      .extract({ left: x, top: y, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { r: data[0], g: data[1], b: data[2] };
  }

  it('кладёт принт ровно в рассчитанное место', async () => {
    const composed = await render.composeMockup(side());

    // Центр зоны печати: 200 + 200 = 400 по X, 200 + 250 = 450 по Y.
    const inside = await pixelAt(composed, 400, 450);
    expect(inside.r).toBeGreaterThan(200);
    expect(inside.g).toBeLessThan(60);

    // Принт 100 × 125 мм при двух точках на миллиметр — это 200 × 250 px,
    // то есть от 300 до 500 по X. Точка в 280 обязана остаться футболкой.
    const outside = await pixelAt(composed, 280, 450);
    expect(outside.r).toBeGreaterThan(100);
    expect(outside.r).toBeLessThan(160);
    expect(Math.abs(outside.r - outside.g)).toBeLessThan(12);
  });

  it('размер мокапа не меняется от наложения', async () => {
    const composed = await render.composeMockup(side());
    const meta = await sharp(composed).metadata();
    expect(meta.width).toBe(MOCKUP_W);
    expect(meta.height).toBe(MOCKUP_H);
  });

  it('принт, свисающий за край фотографии, обрезается, а не роняет рендер', async () => {
    // Огромный принт, уведённый в угол: за кадром остаётся большая его часть.
    const composed = await render.composeMockup(
      side({ widthMm: 400, heightMm: 500, x: 0, y: 0 }),
    );
    const meta = await sharp(composed).metadata();
    expect(meta.width).toBe(MOCKUP_W);

    const corner = await pixelAt(composed, 5, 5);
    expect(corner.r).toBeGreaterThan(200);
  });

  it('повёрнутый принт остаётся в кадре', async () => {
    const composed = await render.composeMockup(side({ rotation: 45 }));
    const meta = await sharp(composed).metadata();
    expect(meta.width).toBe(MOCKUP_W);

    // Центр не смещается поворотом.
    const center = await pixelAt(composed, 400, 450);
    expect(center.r).toBeGreaterThan(200);
    // Угол неповёрнутого прямоугольника после поворота на 45° освобождается.
    const wasCorner = await pixelAt(composed, 305, 330);
    expect(wasCorner.r).toBeLessThan(200);
  });

  it('принт целиком за кадром просто не рисуется', async () => {
    const composed = await render.composeMockup(side({ x: -1, y: -1 }));
    const meta = await sharp(composed).metadata();
    expect(meta.width).toBe(MOCKUP_W);
  });

  it('лист согласования выходит листом A4 при 200 dpi', async () => {
    const sheet = await render.renderSheet({
      numberOrder: '20260824-1',
      version: 1,
      shirtColor: 'Чёрный',
      shirtSizeLabel: 'XL',
      comment: 'Печать по центру груди',
      author: 'tigran',
      date: new Date('2026-08-24T10:00:00Z'),
      sides: [side(), { ...side(), side: 'BACK' }],
    });

    const meta = await sharp(sheet).metadata();
    expect(meta.width).toBe(1654);
    expect(meta.height).toBe(2339);

    // Оба мокапа на месте: слева и справа от середины листа принт красный.
    const left = await pixelAt(sheet, 460, 800);
    const right = await pixelAt(sheet, 1195, 800);
    expect(left.r).toBeGreaterThan(180);
    expect(right.r).toBeGreaterThan(180);
  });
});
