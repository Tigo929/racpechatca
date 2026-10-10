import { BadRequestException } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import sharp from 'sharp';
import { ApprovalStorageService } from './approval-storage.service';
import { PdfRasterUnavailableError } from 'src/marketplace/image-cards/pdf-raster.service';

/**
 * Принт можно принести PDF-ом.
 *
 * Макеты приходят от дизайнеров вектором, и до сих пор их пересохраняли
 * в PNG только ради загрузки. Теперь PDF рисуется на сервере, а дальше
 * по системе идёт обычная картинка — поэтому редактор, лист согласования
 * и отправка клиенту ничего про PDF знать не должны.
 *
 * Проверяем именно это: что из PDF получается такой же файл принта, как
 * из картинки, и что отказы объясняются человеческим языком.
 */
describe('PDF как исходник принта', () => {
  let dir: string;

  const pngPage = (width: number, height: number) =>
    sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 128, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

  /** Растеризатор-заглушка: кладёт готовую картинку туда, куда просят. */
  const raster = (png: Buffer, seen?: { longSide?: number }) => ({
    rasterizeFirstPage: async (
      _pdfPath: string,
      outputPath: string,
      longSide?: number,
    ) => {
      if (seen) seen.longSide = longSide;
      await fs.writeFile(outputPath, png);
    },
  });

  const service = (pdf: unknown) =>
    new ApprovalStorageService({ get: () => dir } as never, pdf as never);

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'approval-pdf-'));
  });

  afterAll(async () => {
    // Под Windows sharp ещё держит дескриптор только что прочитанного файла,
    // и удаление падает с EBUSY. Временная папка — не предмет проверки,
    // поэтому ошибку уборки глотаем: система её подчистит сама.
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('из PDF получается такой же принт, как из картинки', async () => {
    const png = await pngPage(1200, 900);
    const saved = await service(raster(png)).savePrint({
      buffer: Buffer.from('%PDF-1.7 притворяется файлом'),
      mimetype: 'application/pdf',
      size: 28,
      originalname: 'макет.pdf',
    });

    expect(saved.filename).toMatch(/^print-[0-9a-f-]{36}\.webp$/);
    expect(saved.sourceWidth).toBe(1200);
    expect(saved.sourceHeight).toBe(900);

    // Файл действительно лежит на диске и читается как картинка.
    const meta = await sharp(
      path.join(dir, 'approvals', saved.filename),
    ).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1200);
  });

  it('прозрачность вектора доживает до файла принта', async () => {
    // Без неё принт лёг бы на футболку белым прямоугольником.
    const transparent = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const saved = await service(raster(transparent)).savePrint({
      buffer: Buffer.from('%PDF-1.7'),
      mimetype: 'application/pdf',
      size: 8,
    });
    const meta = await sharp(
      path.join(dir, 'approvals', saved.filename),
    ).metadata();
    expect(meta.hasAlpha).toBe(true);
  });

  it('рисуем под наш потолок хранения, а не под карточки Ozon', async () => {
    // У вектора своего разрешения нет: качество ограничивает то, в каком
    // размере мы его растрируем, и мельчить здесь нельзя — файл идёт в печать.
    const seen: { longSide?: number } = {};
    await service(raster(await pngPage(100, 100), seen)).savePrint({
      buffer: Buffer.from('%PDF-1.7'),
      mimetype: 'application/pdf',
      size: 8,
    });
    expect(seen.longSide).toBe(4000);
  });

  it('картинку по-прежнему принимаем напрямую, без растеризатора', async () => {
    const png = await pngPage(300, 300);
    const never = {
      rasterizeFirstPage: async () => {
        throw new Error('растеризатор трогать не должны');
      },
    };
    const saved = await service(never).savePrint({
      buffer: png,
      mimetype: 'image/png',
      size: png.length,
    });
    expect(saved.width).toBe(300);
  });

  it('формат не из списка отклоняется, и в ответе сказано про PDF', async () => {
    await expect(
      service(raster(Buffer.alloc(0))).savePrint({
        buffer: Buffer.from('GIF89a'),
        mimetype: 'image/gif',
        size: 6,
      }),
    ).rejects.toThrow(/PNG, JPEG, WEBP или PDF/);
  });

  it('нет Poppler — объясняем, чего не хватает серверу', async () => {
    const broken = {
      rasterizeFirstPage: async () => {
        throw new PdfRasterUnavailableError();
      },
    };
    await expect(
      service(broken).savePrint({
        buffer: Buffer.from('%PDF-1.7'),
        mimetype: 'application/pdf',
        size: 8,
      }),
    ).rejects.toThrow(/Poppler/);
  });

  it('битый PDF не роняет загрузку, а объясняет причину', async () => {
    const broken = {
      rasterizeFirstPage: async () => {
        throw new Error('страница оказалась пустой');
      },
    };
    await expect(
      service(broken).savePrint({
        buffer: Buffer.from('%PDF-1.7'),
        mimetype: 'application/pdf',
        size: 8,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('мокап футболки PDF-ом не принимаем: это фотография, а не макет', async () => {
    await expect(
      service(raster(Buffer.alloc(0))).saveMockup({
        buffer: Buffer.from('%PDF-1.7'),
        mimetype: 'application/pdf',
        size: 8,
      }),
    ).rejects.toThrow(/PNG, JPEG или WEBP/);
  });
});
