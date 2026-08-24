import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { PdfRasterService } from './pdf-raster.service';

/**
 * Растеризация PDF на настоящем Poppler.
 *
 * Тест пропускает себя там, где Poppler не установлен: на машине
 * разработчика под Windows его может не быть, и падать из-за этого сборка не
 * должна. Там, где он есть (образ бэкенда, CI), проверка выполняется целиком
 * и ловит главное — что первая страница действительно превращается в
 * картинку и что прозрачность фона при этом не теряется.
 */

/** Кладём в файл маленький PDF: круг, буквы и подпись. */
async function makePdf(file: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: [800, 1000], margin: 0 });
    const out = createWriteStream(file);
    doc.pipe(out);
    doc.circle(400, 400, 220).lineWidth(28).strokeColor('#f5c518').stroke();
    doc
      .fontSize(64)
      .fillColor('#111111')
      .text('RASPECHATKA', 0, 700, { width: 800, align: 'center' });
    doc.end();
    out.on('finish', () => resolve());
    out.on('error', reject);
  });
}

describe('растеризация PDF', () => {
  const service = new PdfRasterService();
  let dir: string;
  let available = false;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-raster-'));
    available = await service.isAvailable();
    if (!available) {
      console.warn(
        'Poppler не найден — проверка растеризации PDF пропущена. ' +
          'В образе бэкенда он ставится пакетом poppler-utils.',
      );
    }
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('первая страница превращается в картинку, прозрачность сохраняется', async () => {
    if (!available) return;

    const pdf = path.join(dir, 'maket.pdf');
    const png = path.join(dir, 'raster.png');
    await makePdf(pdf);

    await service.rasterizeFirstPage(pdf, png);

    const meta = await sharp(png).metadata();
    // Длинная сторона приведена к RASTER_LONG_SIDE, пропорции страницы 4:5.
    expect(meta.height).toBe(2400);
    expect(meta.width).toBe(1920);
    // Прозрачный фон — иначе принт лёг бы на футболку белым прямоугольником.
    expect(meta.hasAlpha).toBe(true);

    // И проверяем, что фон именно прозрачный, а не белый: пустые поля
    // должны срезаться обрезкой, иначе принт встанет вдвое мельче.
    const trimmed = await sharp(png)
      .trim({ threshold: 1 })
      .toBuffer({ resolveWithObject: true });
    expect(trimmed.info.width).toBeLessThan(meta.width);
    expect(trimmed.info.height).toBeLessThan(meta.height);
  }, 30_000);

  it('на не-PDF растеризация падает с внятной ошибкой, а не молча', async () => {
    if (!available) return;

    const notPdf = path.join(dir, 'broken.pdf');
    await fs.writeFile(notPdf, 'это вообще не PDF');

    await expect(
      service.rasterizeFirstPage(notPdf, path.join(dir, 'broken.png')),
    ).rejects.toThrow(/PDF/);
  }, 30_000);
});
