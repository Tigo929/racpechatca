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
 * Файлы генератора карточек Ozon на диске сервера.
 *
 * Каталоги внутри UPLOAD_DIR:
 *   ozon-templates/            — шаблоны карточек (по файлу на версию);
 *   ozon-image-cards/<пачка>/  — исходники, растры, превью и финалы пачки.
 *
 * Имя файла всегда придумывает сервер. Пользовательское имя живёт в базе
 * (ImageCardSource.originalName) и на диск не попадает никогда: из него потом
 * строится имя итогового файла, но уже после очистки и транслитерации.
 */

const ALLOWED_TEMPLATE: Record<string, true> = {
  'image/png': true,
  'image/jpeg': true,
  'image/webp': true,
};

/** Столько же пропускает nginx фронтенда (client_max_body_size 30m). */
export const IMAGE_CARD_MAX_BYTES = 30 * 1024 * 1024;

/**
 * Потолок шаблона. Главное фото Ozon — 1200 × 1600, держать исходник крупнее
 * 4000 по длинной стороне незачем: качество композита это не улучшит, а
 * память при массовой генерации съест.
 */
const TEMPLATE_MAX_DIMENSION = 4000;

const TEMPLATE_FILE_RE = /^tpl-[0-9a-f-]{36}\.png$/;

export interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

export interface SavedTemplate {
  filename: string;
  width: number;
  height: number;
}

@Injectable()
export class ImageCardStorageService {
  private readonly templateDir: string;
  private readonly batchRoot: string;

  constructor(config: ConfigService) {
    const base =
      config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads');
    this.templateDir = path.join(base, 'ozon-templates');
    this.batchRoot = path.join(base, 'ozon-image-cards');
  }

  /**
   * Сохраняет картинку шаблона. Всегда PNG и без потерь: шаблон — подложка
   * под принт, и повторное сжатие на каждой из сотни карточек накапливало бы
   * артефакты именно там, где покупатель смотрит на товар.
   */
  async saveTemplate(file: UploadedFileLike): Promise<SavedTemplate> {
    if (!ALLOWED_TEMPLATE[file.mimetype]) {
      throw new BadRequestException(
        'Формат шаблона не поддерживается — нужен PNG, JPEG или WEBP',
      );
    }
    if (file.size > IMAGE_CARD_MAX_BYTES) {
      throw new BadRequestException('Файл больше 30 МБ');
    }

    let data: Buffer;
    let width = 0;
    let height = 0;
    try {
      const result = await sharp(file.buffer)
        .rotate()
        .resize({
          width: TEMPLATE_MAX_DIMENSION,
          height: TEMPLATE_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
      data = result.data;
      width = result.info.width;
      height = result.info.height;
    } catch {
      throw new BadRequestException(
        'Не удалось прочитать шаблон — возможно, файл повреждён',
      );
    }

    await fs.mkdir(this.templateDir, { recursive: true });
    const filename = `tpl-${randomUUID()}.png`;
    await fs.writeFile(path.join(this.templateDir, filename), data);
    return { filename, width, height };
  }

  async readTemplate(filename: string): Promise<Buffer> {
    const safe = path.basename(filename);
    if (!TEMPLATE_FILE_RE.test(safe)) {
      throw new NotFoundException('Шаблон не найден');
    }
    try {
      return await fs.readFile(path.join(this.templateDir, safe));
    } catch {
      throw new NotFoundException('Шаблон не найден');
    }
  }

  /**
   * Файлы шаблонов не удаляем при замене картинки.
   *
   * На них ссылаются снимки в уже сгенерированных карточках: удалив файл, мы
   * лишили бы старые пачки возможности перерисоваться тем, чем их собирали.
   * Метод оставлен для полного удаления шаблона, у которого карточек нет.
   */
  async removeTemplate(filename: string | null | undefined): Promise<void> {
    if (!filename || !TEMPLATE_FILE_RE.test(path.basename(filename))) return;
    await fs
      .unlink(path.join(this.templateDir, path.basename(filename)))
      .catch(() => undefined);
  }

  /**
   * Каталог пачки. Структура из ТЗ повторена на диске один в один:
   *
   *   ozon-image-cards/<пачка>/source/<slug>.<ext>
   *   ozon-image-cards/<пачка>/generated/<slug>/source_extracted.png
   *   ozon-image-cards/<пачка>/generated/<slug>/<slug>_black_image_card.png
   *
   * basename на каждом сегменте — защита от обхода каталога: сюда приходят
   * идентификаторы из базы, но полагаться на это без проверки нельзя.
   */
  batchDir(batchId: string, ...parts: string[]): string {
    return path.join(
      this.batchRoot,
      path.basename(batchId),
      ...parts.map((part) => path.basename(part)),
    );
  }

  /**
   * Кладёт загруженный исходник. Имя на диске строится из чистого имени и
   * типа, определённого по MIME, — расширению из имени файла не доверяем.
   */
  async saveSource(
    batchId: string,
    baseName: string,
    sourceType: string,
    buffer: Buffer,
  ): Promise<string> {
    const dir = this.batchDir(batchId, 'source');
    await fs.mkdir(dir, { recursive: true });
    const filename = `${baseName}.${sourceType === 'jpeg' ? 'jpg' : sourceType}`;
    await fs.writeFile(path.join(dir, path.basename(filename)), buffer);
    return filename;
  }

  sourcePath(batchId: string, filename: string): string {
    return this.batchDir(batchId, 'source', filename);
  }

  /**
   * Путь растра исходника — того, что реально идёт в композит.
   * Для PDF это отрисованная первая страница, для картинки — нормализованная
   * копия. Лежит рядом с будущими карточками этого же дизайна.
   */
  rasterPath(batchId: string, baseName: string): string {
    return this.batchDir(
      batchId,
      'generated',
      baseName,
      'source_extracted.png',
    );
  }

  /**
   * Дизайн с убранным белым фоном. Лежит рядом с растром и считается один
   * раз на исходник: тот же дизайн идёт и в чёрную карточку, и в белую, и
   * в превью, и в финал — четыре прохода по пикселям вместо одного.
   */
  rasterCleanPath(batchId: string, baseName: string): string {
    return this.batchDir(batchId, 'generated', baseName, 'source_nobg.png');
  }

  /** Превью карточки для сетки проверки — рядом с растром этого дизайна. */
  previewPath(batchId: string, baseName: string, shirtColor: string): string {
    return this.batchDir(
      batchId,
      'generated',
      baseName,
      `preview_${shirtColor}.png`,
    );
  }

  async ensureAssetDir(batchId: string, baseName: string): Promise<string> {
    const dir = this.batchDir(batchId, 'generated', baseName);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async readFile(fullPath: string): Promise<Buffer> {
    try {
      return await fs.readFile(fullPath);
    } catch {
      throw new NotFoundException('Файл не найден');
    }
  }

  async exists(fullPath: string): Promise<boolean> {
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /** Удаляет все файлы пачки — вызывается при удалении пачки целиком. */
  async removeBatch(batchId: string): Promise<void> {
    await fs
      .rm(this.batchDir(batchId), { recursive: true, force: true })
      .catch(() => undefined);
  }

  /** Удаляет файлы одного исходника: сам файл, растр и папку с карточками. */
  async removeSource(
    batchId: string,
    filename: string | null,
    baseName: string,
  ): Promise<void> {
    if (filename) {
      await fs
        .rm(this.sourcePath(batchId, filename), { force: true })
        .catch(() => undefined);
    }
    await fs
      .rm(this.batchDir(batchId, 'generated', baseName), {
        recursive: true,
        force: true,
      })
      .catch(() => undefined);
  }
}
