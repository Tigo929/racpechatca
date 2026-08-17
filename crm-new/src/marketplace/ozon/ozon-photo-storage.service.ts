import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import sharp from 'sharp';

/**
 * Фотографии карточек Ozon на диске сервера.
 *
 * Отдельно от TechSpecStorageService, потому что требования площадки другие
 * и несовместимые: ТЗ-макеты пережимаются в WebP, а Ozon WebP **не
 * принимает** — только jpeg/jpg/png. Плюс картинку скачивает сам Ozon, без
 * наших заголовков, поэтому файл должен лежать по публичной ссылке.
 *
 * Требования Ozon к изображению (из шаблона категории):
 * формат jpeg/jpg/png · от 200×200 до 4320×7680 · не больше 10 МБ ·
 * имя файла без «/» и «_».
 */

const ALLOWED_INPUT: Record<string, true> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true, // на входе принимаем, наружу всё равно отдадим JPEG
};

/** Приёмный лимит исходника: снимок с телефона бывает и 25 МБ. */
export const OZON_PHOTO_MAX_BYTES = 30 * 1024 * 1024;
export const OZON_PHOTO_MAX_FILES = 15;

/** Потолок Ozon — 4320×7680; держимся заметно ниже, чтобы влезть в 10 МБ. */
const MAX_DIMENSION = 3500;
const MIN_DIMENSION = 200;
const JPEG_QUALITY = 88;

/** Имя файла: только латиница, цифры и дефисы — подчёркивания Ozon запрещает. */
const FILENAME_RE = /^ozon-[0-9a-f-]{36}\.jpg$/;

@Injectable()
export class OzonPhotoStorageService {
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = path.join(
      config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads'),
      'ozon',
    );
  }

  /**
   * Сохраняет изображение и возвращает имя файла. Конвертация в JPEG
   * обязательна: продавец грузит что угодно (в том числе WebP и PNG с
   * прозрачностью), а Ozon примет только jpeg/jpg/png без альфа-канала.
   */
  async save(file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
  }): Promise<string> {
    if (!ALLOWED_INPUT[file.mimetype]) {
      throw new BadRequestException(
        'Допустимы только изображения JPEG, PNG или WEBP',
      );
    }
    if (file.size > OZON_PHOTO_MAX_BYTES) {
      throw new BadRequestException('Файл больше 30 МБ');
    }

    let converted: Buffer;
    let width: number | undefined;
    let height: number | undefined;
    try {
      const result = await sharp(file.buffer)
        // rotate() без аргументов доворачивает снимок по EXIF — иначе фото
        // с телефона уезжает набок уже в карточке Ozon.
        .rotate()
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        // flatten: PNG с прозрачностью иначе даёт чёрный фон в JPEG.
        // Серый #f2f3f5 — фон, который Ozon требует для одежды.
        .flatten({ background: '#f2f3f5' })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer({ resolveWithObject: true });
      converted = result.data;
      width = result.info.width;
      height = result.info.height;
    } catch {
      throw new BadRequestException(
        'Не удалось обработать изображение — возможно, файл повреждён',
      );
    }

    if ((width ?? 0) < MIN_DIMENSION || (height ?? 0) < MIN_DIMENSION) {
      throw new BadRequestException(
        `Ozon не примет изображение меньше ${MIN_DIMENSION}×${MIN_DIMENSION} — у этого ${width}×${height}`,
      );
    }

    await fs.mkdir(this.baseDir, { recursive: true });
    const filename = `ozon-${randomUUID()}.jpg`;
    await fs.writeFile(path.join(this.baseDir, filename), converted);
    return filename;
  }

  /** Читает файл по имени. Имя проверяем по маске — каталог публичный. */
  async read(filename: string): Promise<Buffer> {
    const safe = path.basename(filename);
    if (!FILENAME_RE.test(safe)) {
      throw new NotFoundException('Файл не найден');
    }
    try {
      return await fs.readFile(path.join(this.baseDir, safe));
    } catch {
      throw new NotFoundException('Файл не найден');
    }
  }

  /**
   * Публичная ссылка на файл — именно её мы отдаём Ozon, и он по ней
   * скачивает картинку сам. PUBLIC_BASE_URL задан не во всех окружениях,
   * поэтому при его отсутствии собираем адрес по заголовкам запроса.
   *
   * Схема (https) в этом случае держится на `trust proxy` в main.ts: без
   * него Express не смотрит на X-Forwarded-Proto и вернёт http, а по http
   * nginx отвечает редиректом — и Ozon может не пойти за картинкой.
   */
  publicUrl(filename: string, requestOrigin?: string): string {
    const configured = (this.config.get<string>('PUBLIC_BASE_URL') ?? '')
      .trim()
      .replace(/\/+$/, '');
    const base = configured || (requestOrigin ?? '').replace(/\/+$/, '');
    if (!base) {
      throw new BadRequestException(
        'Не задан PUBLIC_BASE_URL — Ozon не сможет скачать фото по ссылке',
      );
    }
    return `${base}/marketplace/ozon/photos/${filename}`;
  }
}
