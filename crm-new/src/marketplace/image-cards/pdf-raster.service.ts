import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const run = promisify(execFile);

/**
 * Растеризация первой страницы PDF через Poppler (`pdftocairo`).
 *
 * Никаких shell-строк: команда вызывается через execFile с массивом
 * аргументов, а пути мы строим сами из своих же имён файлов. Имя, которое
 * дал пользователь, до этого места вообще не доходит — оно живёт в базе.
 * Иначе файл с именем вида `; rm -rf /` был бы командой, а не файлом.
 *
 * В образ бэкенда poppler ставится строкой в Dockerfile. Для локальной
 * разработки под Windows его нужно поставить отдельно — без него PDF не
 * растрируется, а PNG и JPEG работают как обычно.
 */

const BINARY = 'pdftocairo';

/**
 * Длинная сторона растра. Итоговая карточка — 1200 × 1600, область принта
 * заметно меньше; 2400 даёт запас на кадрирование и ручное увеличение, но не
 * раздувает память при массовой обработке.
 */
export const RASTER_LONG_SIDE = 2400;

/** Потолок времени на один файл: битый PDF не должен занять воркер навсегда. */
const TIMEOUT_MS = 60_000;

export class PdfRasterUnavailableError extends Error {
  constructor() {
    super(
      'На сервере не установлен Poppler (pdftocairo) — PDF растрировать нечем. ' +
        'В Docker он ставится пакетом poppler-utils; для локальной разработки ' +
        'установите Poppler и добавьте его в PATH. Загрузка PNG и JPEG работает без него.',
    );
    this.name = 'PdfRasterUnavailableError';
  }
}

@Injectable()
export class PdfRasterService {
  private readonly logger = new Logger(PdfRasterService.name);
  private available: boolean | null = null;

  /** Есть ли Poppler. Результат запоминаем: проверять на каждый файл незачем. */
  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;
    try {
      await run(BINARY, ['-v'], { timeout: 10_000 });
      this.available = true;
    } catch (error) {
      const code = (error as { code?: string }).code;
      // pdftocairo -v печатает версию в stderr и выходит с ненулевым кодом на
      // части сборок: отсутствием считаем только «файл не найден».
      this.available = code !== 'ENOENT';
      if (!this.available) {
        this.logger.warn('Poppler не найден — растеризация PDF недоступна');
      }
    }
    return this.available;
  }

  /**
   * Рисует первую страницу PDF в PNG рядом с исходником.
   *
   * Прозрачность сохраняется (`-transp`): у макетов принтов она есть почти
   * всегда, и белая подложка вместо неё легла бы на футболку прямоугольником.
   * Страница ровно одна: multi-page в MVP не поддерживается намеренно.
   */
  async rasterizeFirstPage(pdfPath: string, outputPath: string): Promise<void> {
    if (!(await this.isAvailable())) {
      throw new PdfRasterUnavailableError();
    }

    // pdftocairo сам дописывает «.png» к префиксу, поэтому передаём путь
    // без расширения, а ждём файл с ним.
    const prefix = outputPath.replace(/\.png$/i, '');

    try {
      await run(
        BINARY,
        [
          '-png',
          '-singlefile',
          '-transp',
          '-f',
          '1',
          '-l',
          '1',
          '-scale-to',
          String(RASTER_LONG_SIDE),
          pdfPath,
          prefix,
        ],
        { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      );
    } catch (error) {
      const message = error as { stderr?: string; message?: string };
      throw new Error(
        `Не удалось растрировать PDF: ${message.stderr?.trim() || message.message || 'неизвестная ошибка'}`,
      );
    }

    // Убеждаемся, что файл действительно появился: pdftocairo умеет выйти с
    // нулевым кодом, не создав ничего — например, на пустой странице.
    const produced = `${prefix}.png`;
    try {
      const stat = await fs.stat(produced);
      if (!stat.isFile() || stat.size === 0) throw new Error('пустой файл');
    } catch {
      throw new Error(
        'PDF обработан, но страница оказалась пустой — проверьте файл',
      );
    }

    if (path.resolve(produced) !== path.resolve(outputPath)) {
      await fs.rename(produced, outputPath);
    }
  }
}
