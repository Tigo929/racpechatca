import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sharp from 'sharp';
import { PrismaService } from 'src/prisma/prisma.service';
import { ImageCardStorageService } from './image-card-storage.service';
import { PdfRasterService, RASTER_LONG_SIDE } from './pdf-raster.service';
import {
  ImageCardRenderService,
  PREVIEW_LONG_SIDE,
  type CardTemplateSnapshot,
} from './image-card-render.service';
import { parseRect, parseTransform } from './image-card-placement';
import { cardFileName } from './image-card-naming';
import { validateAgainstPreset } from './ozon-image-preset';

/**
 * Фоновая подготовка исходников: PDF отрисовывается, картинка приводится к
 * общему виду. Результат — один PNG на дизайн, который дальше и ложится на
 * шаблон.
 *
 * Очередь — таблица, а не Redis: в проекте уже есть ровно такой рабочий
 * образец (GulianOutbox), и заводить брокер ради десятков файлов в день
 * значило бы добавить ещё одну вещь, которая может упасть ночью.
 *
 * Один битый файл не трогает остальные: ошибка пишется в его строку, пачка
 * продолжает обрабатываться, а человек нажимает «Повторить».
 */

/** Как часто заглядывать в очередь. */
const TICK_MS = 4_000;

/**
 * Сколько файлов брать за раз. Растеризация PDF прожорлива по памяти, а у
 * сервера её 1.6 ГБ: три штуки — компромисс между скоростью и тем, чтобы не
 * положить контейнер на пачке из полусотни макетов.
 */
const BATCH_SIZE = 3;

@Injectable()
export class ImageCardProcessorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ImageCardProcessorService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageCardStorageService,
    private readonly pdf: PdfRasterService,
    private readonly render: ImageCardRenderService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Контейнер могли перезапустить прямо во время обработки. Такие строки
    // остались бы в PROCESSING навсегда — возвращаем их в очередь.
    const revived = await this.prisma.imageCardSource.updateMany({
      where: { status: 'PROCESSING' },
      data: { status: 'PENDING' },
    });
    if (revived.count > 0) {
      this.logger.log(
        `Возвращено в очередь после перезапуска: ${revived.count} исходников`,
      );
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    // Очередь не должна держать процесс живым при остановке.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Один проход очереди. Параллельных проходов не допускаем. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.prisma.imageCardSource.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });
      for (const source of pending) {
        await this.processOne(source.id);
      }

      // Превью считаем только когда исходники разобраны: пока идёт
      // растеризация, композит всё равно не из чего собирать.
      if (pending.length === 0) {
        await this.renderPendingPreviews();
        await this.renderPendingFinals();
      }
    } catch (error) {
      this.logger.error('Сбой обхода очереди исходников', error as Error);
    } finally {
      this.running = false;
    }
  }

  /** Карточки без превью — рисуем и складываем рядом с растром дизайна. */
  private async renderPendingPreviews(): Promise<void> {
    const cards = await this.prisma.imageCardGenerated.findMany({
      where: {
        previewFile: null,
        status: { in: ['GENERATED', 'REVIEW_REQUIRED', 'APPROVED'] },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      include: { source: true },
    });

    for (const card of cards) {
      try {
        const snapshot = parseSnapshot(card.templateSnapshot);
        if (!snapshot) throw new Error('У карточки нет снимка шаблона');

        const template = await this.storage.readTemplate(snapshot.file);
        const design = await this.storage.readFile(
          this.storage.rasterPath(card.batchId, card.source.baseName),
        );

        const preview = await this.render.composeCard({
          template,
          design,
          designWidth: card.source.widthPx,
          designHeight: card.source.heightPx,
          snapshot,
          transform: parseTransform(card.transform),
          removeWhite: card.removeWhiteBackground,
          longSide: PREVIEW_LONG_SIDE,
        });

        const previewPath = this.storage.previewPath(
          card.batchId,
          card.source.baseName,
          card.shirtColor,
        );
        await fs.writeFile(previewPath, preview);

        await this.prisma.imageCardGenerated.update({
          where: { id: card.id },
          data: { previewFile: path.basename(previewPath) },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Неизвестная ошибка';
        this.logger.warn(`Превью карточки не собрано: ${message}`);
        await this.prisma.imageCardGenerated.update({
          where: { id: card.id },
          data: { status: 'ERROR', note: message.slice(0, 500) },
        });
      }
    }

    if (cards.length > 0) await this.refreshBatchStatuses();
  }

  /**
   * Финальные PNG в полном разрешении.
   *
   * Берём только карточки пачек, которые человек отправил в финализацию: без
   * этого условия одобренная в сетке карточка рендерилась бы в полный размер
   * сразу, и кнопка «Готово» потеряла бы смысл.
   *
   * Каждый файл проверяется по требованиям площадки уже после записи — по
   * тому, что реально лежит на диске. Не прошедшая проверку карточка готовой
   * не считается: иначе в выгрузке окажутся файлы, которые Ozon отклонит.
   */
  private async renderPendingFinals(): Promise<void> {
    const cards = await this.prisma.imageCardGenerated.findMany({
      where: {
        status: 'APPROVED',
        finalFile: null,
        previewFile: { not: null },
        batch: { status: 'FINALIZING' },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      include: { source: true },
    });

    for (const card of cards) {
      try {
        const snapshot = parseSnapshot(card.templateSnapshot);
        if (!snapshot) throw new Error('У карточки нет снимка шаблона');

        const template = await this.storage.readTemplate(snapshot.file);
        const design = await this.storage.readFile(
          this.storage.rasterPath(card.batchId, card.source.baseName),
        );

        const full = await this.render.composeCard({
          template,
          design,
          designWidth: card.source.widthPx,
          designHeight: card.source.heightPx,
          snapshot,
          transform: parseTransform(card.transform),
          removeWhite: card.removeWhiteBackground,
        });

        const filename = cardFileName(card.source.baseName, card.shirtColor);
        const dir = await this.storage.ensureAssetDir(
          card.batchId,
          card.source.baseName,
        );
        const fullPath = path.join(dir, filename);
        await fs.writeFile(fullPath, full);

        const meta = await sharp(full).metadata();
        const result = validateAgainstPreset({
          width: meta.width ?? 0,
          height: meta.height ?? 0,
          format: meta.format,
          fileSizeBytes: full.length,
        });

        await this.prisma.imageCardGenerated.update({
          where: { id: card.id },
          data: result.ok
            ? {
                finalFile: filename,
                status: 'FINALIZED',
                validation: { ...result.checked, ok: true },
                note: null,
              }
            : {
                finalFile: null,
                status: 'ERROR',
                validation: { ...result.checked, ok: false },
                note: `Файл не соответствует требованиям Ozon: ${result.problems.join('; ')}`,
              },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Неизвестная ошибка';
        this.logger.warn(`Финальный файл не собран: ${message}`);
        await this.prisma.imageCardGenerated.update({
          where: { id: card.id },
          data: { status: 'ERROR', note: message.slice(0, 500) },
        });
      }
    }

    if (cards.length > 0) await this.closeFinishedBatches();
  }

  /** Пачка закрывается, когда по всем её одобренным карточкам есть решение. */
  private async closeFinishedBatches(): Promise<void> {
    const finalizing = await this.prisma.imageCardBatch.findMany({
      where: { status: 'FINALIZING' },
      select: { id: true },
    });
    for (const batch of finalizing) {
      const left = await this.prisma.imageCardGenerated.count({
        where: { batchId: batch.id, status: 'APPROVED', finalFile: null },
      });
      if (left === 0) {
        await this.prisma.imageCardBatch.update({
          where: { id: batch.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }
    }
  }

  /**
   * Пачка переходит в «проверку», когда собраны все её карточки. Считаем это
   * здесь, а не в запросе: обработка идёт фоном, и кто-то должен закрыть
   * состояние, когда очередь опустела.
   */
  private async refreshBatchStatuses(): Promise<void> {
    const processing = await this.prisma.imageCardBatch.findMany({
      where: { status: 'PROCESSING' },
      select: { id: true },
    });
    for (const batch of processing) {
      const left = await this.prisma.imageCardGenerated.count({
        where: {
          batchId: batch.id,
          previewFile: null,
          status: { not: 'ERROR' },
        },
      });
      if (left === 0) {
        await this.prisma.imageCardBatch.update({
          where: { id: batch.id },
          data: { status: 'REVIEW' },
        });
      }
    }
  }

  private async processOne(sourceId: string): Promise<void> {
    // Занимаем строку условным обновлением: если её уже забрал другой
    // экземпляр приложения, count будет нулевым и мы её не тронем.
    const claimed = await this.prisma.imageCardSource.updateMany({
      where: { id: sourceId, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });
    if (claimed.count === 0) return;

    const source = await this.prisma.imageCardSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) return;

    try {
      await this.storage.ensureAssetDir(source.batchId, source.baseName);
      const rasterPath = this.storage.rasterPath(
        source.batchId,
        source.baseName,
      );
      const sourcePath = this.storage.sourcePath(
        source.batchId,
        source.sourceFile,
      );

      if (source.sourceType === 'pdf') {
        await this.pdf.rasterizeFirstPage(sourcePath, rasterPath);
      } else {
        await this.normalizeImage(sourcePath, rasterPath);
      }

      await this.trimTransparentMargins(rasterPath);

      const meta = await sharp(rasterPath).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (!width || !height) {
        throw new Error('В файле не оказалось изображения');
      }

      await this.prisma.imageCardSource.update({
        where: { id: sourceId },
        data: {
          status: 'READY',
          widthPx: width,
          heightPx: height,
          hasAlpha: Boolean(meta.hasAlpha),
          errorMessage: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Неизвестная ошибка';
      this.logger.warn(
        `Исходник ${source.originalName} не обработан: ${message}`,
      );
      await this.prisma.imageCardSource.update({
        where: { id: sourceId },
        data: { status: 'ERROR', errorMessage: message.slice(0, 500) },
      });
    }
  }

  /**
   * Приведение картинки к общему виду: разворот по EXIF, потолок размера,
   * PNG на выходе. Прозрачность сохраняем — она есть почти у всех макетов
   * принтов, и белая подложка вместо неё легла бы на футболку прямоугольником.
   */
  /**
   * Срезает пустые прозрачные поля вокруг рисунка.
   *
   * У макетов принтов вокруг картинки часто остаётся половина холста пустоты.
   * Без обрезки принт «вписывается в область» вместе с этой пустотой и
   * выходит вдвое меньше, чем задумано.
   *
   * Только прозрачные поля и только у картинок с альфа-каналом: белую рамку
   * здесь не трогаем — удаление белого фона это отдельная настройка, которая
   * по умолчанию выключена, и делать её молча нельзя.
   */
  private async trimTransparentMargins(file: string): Promise<void> {
    const meta = await sharp(file).metadata();
    if (!meta.hasAlpha || !meta.width || !meta.height) return;

    try {
      const trimmed = await sharp(file)
        .trim({ threshold: 1 })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });

      const before = meta.width * meta.height;
      const after = trimmed.info.width * trimmed.info.height;

      // Совсем маленький остаток — почти наверняка пустой или битый макет:
      // обрезать до него опаснее, чем оставить как есть.
      if (after < before * 0.02) return;
      // Меньше пары процентов разницы — трогать файл незачем.
      if (after > before * 0.98) return;

      await fs.writeFile(file, trimmed.data);
    } catch {
      // Обрезка — улучшение, а не обязанность: не вышло, работаем с исходным.
      this.logger.debug(`Обрезка полей не удалась: ${file}`);
    }
  }

  private async normalizeImage(from: string, to: string): Promise<void> {
    await sharp(from)
      .rotate()
      .resize({
        width: RASTER_LONG_SIDE,
        height: RASTER_LONG_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9 })
      .toFile(to);
  }
}

/**
 * Разбор снимка шаблона из карточки. Снимок пишем мы сами, но колонка Json
 * типизирована как «что угодно», а карточка могла быть создана и прошлой
 * версией кода — читаем защитно.
 */
function parseSnapshot(
  value: unknown,
): (CardTemplateSnapshot & { file: string }) | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const file = typeof raw.file === 'string' ? raw.file : null;
  const canvasWidth = typeof raw.canvasWidth === 'number' ? raw.canvasWidth : 0;
  const canvasHeight =
    typeof raw.canvasHeight === 'number' ? raw.canvasHeight : 0;
  if (!file || canvasWidth <= 0 || canvasHeight <= 0) return null;
  return {
    file,
    canvasWidth,
    canvasHeight,
    placementArea: parseRect(raw.placementArea),
  };
}
