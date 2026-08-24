import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import sharp from 'sharp';
import { ImageCardStorageService } from './image-card-storage.service';
import {
  PdfRasterService,
  PdfRasterUnavailableError,
} from './pdf-raster.service';

/**
 * Раскладка файлов и границы хранилища.
 *
 * Структура каталогов — требование ТЗ, а не деталь реализации: по ней человек
 * потом ищет готовые карточки. Отдельно проверяем, что идентификатор из
 * запроса не может увести запись за пределы каталога загрузок.
 */
describe('хранилище генератора карточек', () => {
  let dir: string;
  let storage: ImageCardStorageService;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'image-cards-'));
    storage = new ImageCardStorageService({ get: () => dir } as never);
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const norm = (p: string) => p.split(path.sep).join('/');

  it('раскладка совпадает с описанной в ТЗ', () => {
    expect(norm(storage.sourcePath('batch-1', 'jdm-skyline.pdf'))).toContain(
      'ozon-image-cards/batch-1/source/jdm-skyline.pdf',
    );
    expect(norm(storage.rasterPath('batch-1', 'jdm-skyline'))).toContain(
      'ozon-image-cards/batch-1/generated/jdm-skyline/source_extracted.png',
    );
  });

  it('обход каталога не проходит ни по пачке, ни по имени', () => {
    // Проверяем не текст пути, а само свойство: куда бы ни указывал
    // подставленный идентификатор, результат обязан остаться внутри каталога
    // загрузок. Каждый сегмент проходит через basename, поэтому «../..»
    // превращается в обычное имя папки, а не поднимается вверх.
    for (const evil of ['../../etc', '..', '/etc', 'C:\\Windows']) {
      const result = path.resolve(storage.batchDir(evil, 'passwd'));
      expect(result.startsWith(path.resolve(dir))).toBe(true);
    }
  });

  it('исходник ложится в свою пачку и читается обратно', async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();

    const filename = await storage.saveSource('batch-2', 'kot', 'png', png);
    expect(filename).toBe('kot.png');

    const back = await storage.readFile(
      storage.sourcePath('batch-2', filename),
    );
    expect(back.length).toBe(png.length);
  });

  it('jpeg на диске получает привычное расширение jpg', async () => {
    const filename = await storage.saveSource(
      'batch-3',
      'kot',
      'jpeg',
      Buffer.from('не важно'),
    );
    expect(filename).toBe('kot.jpg');
  });

  it('удаление исходника уносит и папку с его карточками', async () => {
    await storage.saveSource('batch-4', 'kot', 'png', Buffer.from('x'));
    const assetDir = await storage.ensureAssetDir('batch-4', 'kot');
    await fs.writeFile(path.join(assetDir, 'source_extracted.png'), 'x');

    await storage.removeSource('batch-4', 'kot.png', 'kot');

    expect(await storage.exists(storage.sourcePath('batch-4', 'kot.png'))).toBe(
      false,
    );
    expect(await storage.exists(assetDir)).toBe(false);
  });
});

describe('растеризация PDF без Poppler', () => {
  it('говорит человеку, чего не хватает, а не падает молча', async () => {
    const service = new PdfRasterService();
    jest.spyOn(service, 'isAvailable').mockResolvedValue(false);

    await expect(
      service.rasterizeFirstPage('/нет/файла.pdf', '/нет/выхода.png'),
    ).rejects.toBeInstanceOf(PdfRasterUnavailableError);

    // Сообщение уходит в карточку исходника и должно объяснять, что делать.
    const error = await service
      .rasterizeFirstPage('/нет/файла.pdf', '/нет/выхода.png')
      .catch((e: Error) => e);
    expect(error.message).toContain('poppler-utils');
    expect(error.message).toContain('PNG');
  });
});
