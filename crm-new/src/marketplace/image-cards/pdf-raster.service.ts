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
/** Чтение свойств страницы — из того же пакета poppler-utils. */
const INFO_BINARY = 'pdfinfo';

/** Точек PostScript в дюйме: в них pdfinfo печатает размер страницы. */
const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;

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
   * Физический размер первой страницы в миллиметрах.
   *
   * У макета, который идёт в печать, размер задан в самом файле: страница
   * PDF измеряется в точках, и это не «разрешение картинки», а настоящие
   * сантиметры будущего отпечатка. Поэтому его и спрашиваем у файла, а не
   * высчитываем из пикселей растра — растр мы делаем сами и в своём
   * масштабе, к размеру изделия он отношения не имеет.
   *
   * null — размер узнать не вышло (нет poppler, битый файл, нестандартный
   * вывод). Это не ошибка загрузки: принт сохранится, а размер останется
   * тем, что был, и его можно указать руками.
   */
  async pageSizeMm(
    pdfPath: string,
  ): Promise<{ widthMm: number; heightMm: number } | null> {
    if (!(await this.isAvailable())) return null;
    try {
      const { stdout } = await run(INFO_BINARY, ['-f', '1', '-l', '1', pdfPath], {
        timeout: TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
      });
      return parsePageSizeMm(stdout);
    } catch (error) {
      this.logger.warn(
        `Не удалось прочитать размер страницы PDF: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Рисует первую страницу PDF в PNG рядом с исходником.
   *
   * Прозрачность сохраняется (`-transp`): у макетов принтов она есть почти
   * всегда, и белая подложка вместо неё легла бы на футболку прямоугольником.
   * Страница ровно одна: multi-page в MVP не поддерживается намеренно.
   *
   * Длинная сторона растра задаётся вызывающим: карточкам Ozon хватает 2400,
   * принту в листе согласования нужно больше — он идёт в печать.
   */
  async rasterizeFirstPage(
    pdfPath: string,
    outputPath: string,
    longSide: number = RASTER_LONG_SIDE,
  ): Promise<void> {
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
          String(Math.max(1, Math.round(longSide))),
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

/**
 * Размер страницы из вывода `pdfinfo`.
 *
 * Строка у него двух видов, и зависит это от того, спросили ли мы
 * конкретную страницу:
 *   без диапазона — «Page size:       841.89 x 595.276 pts (A4)»
 *   с `-f 1 -l 1` — «Page    1 size:  566.93 x 566.93 pts»
 * Мы спрашиваем первую страницу, то есть получаем второй вид; принимаем
 * оба, чтобы разбор не зависел от того, как позвали команду.
 *
 * Разделителем десятичной части всегда идёт точка — вывод не локализован.
 * Разбор защитный: не совпало — возвращаем null, а не выдуманный размер.
 */
export function parsePageSizeMm(
  stdout: string,
): { widthMm: number; heightMm: number } | null {
  const match = /^Page\s+(?:\d+\s+)?size:\s+([\d.]+)\s*x\s*([\d.]+)\s*pts/im.exec(
    stdout,
  );
  if (!match) return null;
  const widthPt = Number(match[1]);
  const heightPt = Number(match[2]);
  if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt)) return null;
  if (widthPt <= 0 || heightPt <= 0) return null;
  const toMm = (pt: number) => Math.round((pt / POINTS_PER_INCH) * MM_PER_INCH * 10) / 10;
  return { widthMm: toMm(widthPt), heightMm: toMm(heightPt) };
}
