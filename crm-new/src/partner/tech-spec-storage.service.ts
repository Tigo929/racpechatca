import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import sharp from 'sharp';

// Разрешённые типы ТЗ-макета: фото или PDF. mime → расширение файла.
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const EXT_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export const TECH_SPEC_MAX_BYTES = 15 * 1024 * 1024; // 15 МБ

// Макет — производственный референс, поэтому качество держим высоким, а
// уменьшаем только совсем крупные снимки: детали принта должны остаться
// читаемыми для печати.
const MAX_DIMENSION = 3000;
const WEBP_QUALITY = 90;

/**
 * Хранение ТЗ-фото (согласованного макета) на диске сервера.
 * Каталог настраивается через UPLOAD_DIR (по умолчанию ./uploads рядом с
 * процессом) и монтируется как том, чтобы файлы переживали пересборку.
 */
@Injectable()
export class TechSpecStorageService {
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    this.baseDir =
      config.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads');
  }

  /** Сохраняет макет заказа, перезаписывая прошлый. Возвращает имя файла. */
  async save(
    orderId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<string> {
    const ext = ALLOWED[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Допустимы только изображения (JPEG, PNG, WEBP) или PDF',
      );
    }
    if (file.size > TECH_SPEC_MAX_BYTES) {
      throw new BadRequestException('Файл больше 15 МБ');
    }
    await fs.mkdir(this.baseDir, { recursive: true });
    // Убираем возможный старый файл заказа с другим расширением.
    await this.remove(orderId);

    // PDF оставляем как есть: это векторный документ, конвертация только
    // испортит качество макета.
    if (ext === 'pdf') {
      const filename = `techspec-${orderId}.pdf`;
      await fs.writeFile(path.join(this.baseDir, filename), file.buffer);
      return filename;
    }

    // Фото приводим к WebP — тот же вид при заметно меньшем размере, открывается
    // в любом браузере. rotate() без аргументов доворачивает снимок по EXIF,
    // иначе фотография с телефона уезжает набок.
    let converted: Buffer;
    try {
      converted = await sharp(file.buffer)
        .rotate()
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Не удалось обработать изображение — возможно, файл повреждён',
      );
    }

    const filename = `techspec-${orderId}.webp`;
    await fs.writeFile(path.join(this.baseDir, filename), converted);
    return filename;
  }

  /** Читает файл макета по сохранённому имени. */
  async read(
    filename: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    // Защита от path traversal: работаем только с basename.
    const safe = path.basename(filename);
    const full = path.join(this.baseDir, safe);
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(full);
    } catch {
      throw new NotFoundException('Файл ТЗ не найден');
    }
    const ext = safe.split('.').pop() ?? '';
    return {
      buffer,
      contentType: EXT_CONTENT_TYPE[ext] ?? 'application/octet-stream',
    };
  }

  /** Удаляет все файлы макета заказа (любое расширение). */
  private async remove(orderId: string): Promise<void> {
    for (const ext of Object.values(ALLOWED)) {
      await fs
        .unlink(path.join(this.baseDir, `techspec-${orderId}.${ext}`))
        .catch(() => undefined);
    }
  }
}
