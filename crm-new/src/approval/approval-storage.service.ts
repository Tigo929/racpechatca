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
 * Файлы раздела «Согласование» на диске сервера.
 *
 * Отдельно от TechSpecStorageService: там производственный макет, который
 * уходит партнёру как есть, здесь — исходники для отрисовки мокапа. Общее у
 * них только то, что имя файла всегда придумывает сервер: пользовательское имя
 * хранится рядом, в состоянии согласования, и на диск не попадает никогда.
 *
 * Каталоги внутри UPLOAD_DIR:
 *   mockups/   — фотографии футболок (по одной на шаблон);
 *   approvals/ — загруженные принты и готовые листы согласования.
 */

const ALLOWED_IMAGE: Record<string, true> = {
  'image/png': true,
  'image/jpeg': true,
  'image/webp': true,
};

/** Приёмный лимит: столько же пропускает nginx фронтенда (client_max_body_size 30m). */
export const APPROVAL_MAX_BYTES = 30 * 1024 * 1024;

/**
 * Потолок хранимой копии принта. Исходник бывает и 8000 px, но лист
 * согласования — картинка шириной ~1650 px: держать больше 4000 незачем.
 * Разрешение оригинала при этом запоминается отдельно и именно по нему
 * считается DPI — качество оценивается по файлу, который уйдёт в печать,
 * а не по нашей уменьшенной копии.
 */
const PRINT_MAX_DIMENSION = 4000;
const PRINT_WEBP_QUALITY = 92;

/** Фотография мокапа: фон листа, крупнее 3000 px не нужен. */
const MOCKUP_MAX_DIMENSION = 3000;
const MOCKUP_WEBP_QUALITY = 90;

const PRINT_FILE_RE = /^print-[0-9a-f-]{36}\.webp$/;
const MOCKUP_FILE_RE = /^mockup-[0-9a-f-]{36}\.webp$/;
const SHEET_FILE_RE = /^approval-[0-9a-f-]{36}-v\d+\.png$/;

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

export interface SavedImage {
  filename: string;
  /** Разрешение исходника — до нашего уменьшения. */
  sourceWidth: number;
  sourceHeight: number;
  /** Разрешение сохранённой копии — по нему рисуется лист. */
  width: number;
  height: number;
}

@Injectable()
export class ApprovalStorageService {
  private readonly mockupDir: string;
  private readonly approvalDir: string;

  constructor(config: ConfigService) {
    const base =
      config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads');
    this.mockupDir = path.join(base, 'mockups');
    this.approvalDir = path.join(base, 'approvals');
  }

  /**
   * Сохраняет принт. Приводим к WebP: формат держит прозрачность (без неё
   * принт лёг бы на футболку белым прямоугольником) и весит заметно меньше PNG.
   */
  async savePrint(file: UploadedImage): Promise<SavedImage> {
    this.validate(file);
    const filename = `print-${randomUUID()}.webp`;
    const saved = await this.convert(
      file,
      path.join(this.approvalDir, filename),
      PRINT_MAX_DIMENSION,
      PRINT_WEBP_QUALITY,
      true,
    );
    return { filename, ...saved };
  }

  /** Сохраняет фотографию мокапа под конкретный шаблон, заменяя прошлую. */
  async saveMockup(file: UploadedImage): Promise<SavedImage> {
    this.validate(file);
    const filename = `mockup-${randomUUID()}.webp`;
    const saved = await this.convert(
      file,
      path.join(this.mockupDir, filename),
      MOCKUP_MAX_DIMENSION,
      MOCKUP_WEBP_QUALITY,
      false,
    );
    return { filename, ...saved };
  }

  /** Записывает готовый лист согласования и возвращает его имя. */
  async saveSheet(
    approvalId: string,
    version: number,
    png: Buffer,
  ): Promise<string> {
    const filename = `approval-${approvalId}-v${version}.png`;
    await fs.mkdir(this.approvalDir, { recursive: true });
    await fs.writeFile(path.join(this.approvalDir, filename), png);
    return filename;
  }

  /**
   * Делает независимую копию принта под новую версию согласования.
   *
   * Именно копию, а не ссылку на тот же файл: версии живут отдельными
   * жизнями, и удаление одной не должно оставлять другую без картинки.
   * Файлы принтов маленькие, так что дублирование дешевле путаницы.
   */
  async copyPrint(filename: string | null | undefined): Promise<string | null> {
    if (!filename) return null;
    const source = path.basename(filename);
    if (!PRINT_FILE_RE.test(source)) return null;
    const target = `print-${randomUUID()}.webp`;
    try {
      await fs.copyFile(
        path.join(this.approvalDir, source),
        path.join(this.approvalDir, target),
      );
    } catch {
      return null;
    }
    return target;
  }

  readPrint(filename: string): Promise<Buffer> {
    return this.read(
      this.approvalDir,
      filename,
      PRINT_FILE_RE,
      'Принт не найден',
    );
  }

  readMockup(filename: string): Promise<Buffer> {
    return this.read(
      this.mockupDir,
      filename,
      MOCKUP_FILE_RE,
      'Фотография мокапа не найдена',
    );
  }

  readSheet(filename: string): Promise<Buffer> {
    return this.read(
      this.approvalDir,
      filename,
      SHEET_FILE_RE,
      'Файл согласования не найден',
    );
  }

  /** Удаляет файл принта. Молча: отсутствие файла — не ошибка при замене. */
  async removePrint(filename: string | null | undefined): Promise<void> {
    if (!filename || !PRINT_FILE_RE.test(path.basename(filename))) return;
    await fs
      .unlink(path.join(this.approvalDir, path.basename(filename)))
      .catch(() => undefined);
  }

  /** Удаляет фотографию мокапа. */
  async removeMockup(filename: string | null | undefined): Promise<void> {
    if (!filename || !MOCKUP_FILE_RE.test(path.basename(filename))) return;
    await fs
      .unlink(path.join(this.mockupDir, path.basename(filename)))
      .catch(() => undefined);
  }

  /** Удаляет готовый лист согласования (при удалении версии). */
  async removeSheet(filename: string | null | undefined): Promise<void> {
    if (!filename || !SHEET_FILE_RE.test(path.basename(filename))) return;
    await fs
      .unlink(path.join(this.approvalDir, path.basename(filename)))
      .catch(() => undefined);
  }

  private validate(file: UploadedImage): void {
    if (!ALLOWED_IMAGE[file.mimetype]) {
      throw new BadRequestException(
        'Формат файла не поддерживается — нужен PNG, JPEG или WEBP',
      );
    }
    if (file.size > APPROVAL_MAX_BYTES) {
      throw new BadRequestException(
        'Размер файла превышает допустимый — до 30 МБ',
      );
    }
  }

  private async convert(
    file: UploadedImage,
    fullPath: string,
    maxDimension: number,
    quality: number,
    keepAlpha: boolean,
  ): Promise<Omit<SavedImage, 'filename'>> {
    let sourceWidth = 0;
    let sourceHeight = 0;
    let converted: Buffer;
    let width = 0;
    let height = 0;

    try {
      const image = sharp(file.buffer);
      const meta = await image.metadata();
      // rotate() без аргументов доворачивает снимок по EXIF — иначе фото
      // с телефона уезжает набок. Из-за этого же ширина и высота могут
      // поменяться местами, поэтому исходный размер берём уже с учётом
      // ориентации.
      const turned = meta.orientation && meta.orientation >= 5;
      sourceWidth = (turned ? meta.height : meta.width) ?? 0;
      sourceHeight = (turned ? meta.width : meta.height) ?? 0;

      const pipeline = sharp(file.buffer).rotate().resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      });
      const result = await (
        keepAlpha
          ? pipeline.webp({ quality })
          : pipeline.flatten({ background: '#ffffff' }).webp({ quality })
      ).toBuffer({ resolveWithObject: true });
      converted = result.data;
      width = result.info.width;
      height = result.info.height;
    } catch {
      throw new BadRequestException(
        'Не удалось загрузить принт — возможно, файл повреждён',
      );
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, converted);
    return {
      sourceWidth: sourceWidth || width,
      sourceHeight: sourceHeight || height,
      width,
      height,
    };
  }

  private async read(
    dir: string,
    filename: string,
    pattern: RegExp,
    notFound: string,
  ): Promise<Buffer> {
    // Защита от обхода каталога: работаем только с basename и только с
    // именами, которые сами же и выдали.
    const safe = path.basename(filename);
    if (!pattern.test(safe)) throw new NotFoundException(notFound);
    try {
      return await fs.readFile(path.join(dir, safe));
    } catch {
      throw new NotFoundException(notFound);
    }
  }
}
