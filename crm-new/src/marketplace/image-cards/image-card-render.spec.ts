import sharp from 'sharp';
import { ImageCardRenderService } from './image-card-render.service';
import { DEFAULT_TRANSFORM } from './image-card-placement';

/**
 * Сборка карточки на настоящем sharp, с проверкой пикселей.
 *
 * Арифметика наложения ошибается тихо: принт встаёт на сотню точек мимо, и
 * заметить это можно только глазами на готовой карточке. Отдельно проверяем
 * принт, свисающий за край холста, — sharp отказывается класть накладку
 * больше основы, поэтому невидимую часть мы обрезаем сами.
 */

const CANVAS_W = 1200;
const CANVAS_H = 1600;

/** Область принта на груди: 600 × 800 с отступом 300 слева и 400 сверху. */
const SNAPSHOT = {
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
  placementArea: { x: 300, y: 400, width: 600, height: 800 },
};

describe('сборка карточки', () => {
  const render = new ImageCardRenderService();
  let template: Buffer;
  let design: Buffer;

  beforeAll(async () => {
    // Серый «шаблон» и красный «принт» — по контрасту видно, куда он лёг.
    template = await sharp({
      create: {
        width: CANVAS_W,
        height: CANVAS_H,
        channels: 3,
        background: '#808080',
      },
    })
      .png()
      .toBuffer();
    design = await sharp({
      create: {
        width: 600,
        height: 800,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  });

  async function pixelAt(buffer: Buffer, x: number, y: number) {
    const { data } = await sharp(buffer)
      .extract({ left: x, top: y, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { r: data[0], g: data[1], b: data[2] };
  }

  const compose = (
    over: Partial<Parameters<typeof render.composeCard>[0]> = {},
  ) =>
    render.composeCard({
      template,
      design,
      designWidth: 600,
      designHeight: 800,
      snapshot: SNAPSHOT,
      transform: { ...DEFAULT_TRANSFORM },
      ...over,
    });

  it('принт встаёт по центру области и занимает 88% вписанного размера', async () => {
    const card = await compose();

    // Центр области: 300 + 300 = 600 по X, 400 + 400 = 800 по Y.
    const center = await pixelAt(card, 600, 800);
    expect(center.r).toBeGreaterThan(200);
    expect(center.g).toBeLessThan(60);

    // 600 × 800 при масштабе 0.88 — это 528 × 704, то есть от 336 до 864
    // по X. Точка в 310 обязана остаться шаблоном, хотя и лежит в области.
    const inArea = await pixelAt(card, 310, 800);
    expect(Math.abs(inArea.r - 128)).toBeLessThan(12);
    expect(Math.abs(inArea.r - inArea.g)).toBeLessThan(8);
  });

  it('размер холста не меняется от наложения', async () => {
    const meta = await sharp(await compose()).metadata();
    expect(meta.width).toBe(CANVAS_W);
    expect(meta.height).toBe(CANVAS_H);
  });

  it('превью — тот же композит, только меньше', async () => {
    const meta = await sharp(await compose({ longSide: 600 })).metadata();
    // Холст 1200 × 1600, длинная сторона 600 → 450 × 600.
    expect(meta.width).toBe(450);
    expect(meta.height).toBe(600);
  });

  it('принт, уведённый за край, обрезается и не роняет сборку', async () => {
    const card = await compose({
      transform: { ...DEFAULT_TRANSFORM, x: -0.6, y: -0.4, scale: 2 },
    });
    const meta = await sharp(card).metadata();
    expect(meta.width).toBe(CANVAS_W);

    // Угол холста должен оказаться закрыт свисающим принтом.
    const corner = await pixelAt(card, 2, 2);
    expect(corner.r).toBeGreaterThan(200);
  });

  it('принт целиком за кадром просто не рисуется', async () => {
    const card = await compose({
      transform: { ...DEFAULT_TRANSFORM, x: -1, y: -1, scale: 0.1 },
    });
    const meta = await sharp(card).metadata();
    expect(meta.width).toBe(CANVAS_W);
    const center = await pixelAt(card, 600, 800);
    expect(Math.abs(center.r - 128)).toBeLessThan(12);
  });

  it('поворот не смещает центр принта', async () => {
    const card = await compose({
      transform: { ...DEFAULT_TRANSFORM, rotation: 45 },
    });
    const center = await pixelAt(card, 600, 800);
    expect(center.r).toBeGreaterThan(200);
    // Угол неповёрнутого прямоугольника после поворота освобождается.
    const wasCorner = await pixelAt(card, 345, 455);
    expect(wasCorner.r).toBeLessThan(200);
  });
});

describe('удаление белого фона', () => {
  const render = new ImageCardRenderService();

  it('почти белое становится прозрачным, цветное остаётся', async () => {
    // Полосатая картинка: слева белое, справа красное.
    const raw = Buffer.alloc(4 * 2 * 4);
    for (let i = 0; i < 4; i++) {
      const white = i * 4;
      raw[white] = 250;
      raw[white + 1] = 250;
      raw[white + 2] = 250;
      raw[white + 3] = 255;
      const red = (4 + i) * 4;
      raw[red] = 220;
      raw[red + 1] = 20;
      raw[red + 2] = 20;
      raw[red + 3] = 255;
    }
    const input = await sharp(raw, {
      raw: { width: 8, height: 1, channels: 4 },
    })
      .png()
      .toBuffer();

    const cleaned = await render.removeWhiteBackground(input);
    const { data } = await sharp(cleaned)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(data[3]).toBe(0); // белый пиксель стал прозрачным
    expect(data[4 * 4 + 3]).toBe(255); // красный остался непрозрачным
    expect(data[4 * 4]).toBeGreaterThan(200);
  });

  it('серый фон не трогаем — порог не должен съедать рисунок', async () => {
    const grey = await sharp({
      create: {
        width: 4,
        height: 1,
        channels: 4,
        background: { r: 200, g: 200, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const cleaned = await render.removeWhiteBackground(grey);
    const { data } = await sharp(cleaned)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(255);
  });
});
