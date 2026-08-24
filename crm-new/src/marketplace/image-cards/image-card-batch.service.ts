import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as path from 'node:path';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  cleanBaseName,
  sniffSourceType,
  uniqueBaseName,
} from './image-card-naming';
import {
  ImageCardStorageService,
  IMAGE_CARD_MAX_BYTES,
  type UploadedFileLike,
} from './image-card-storage.service';
import { DtoCreateImageCardBatch } from './dto/image-card-batch.dto';

/** Сколько исходников имеет смысл держать в одной пачке. */
const MAX_SOURCES = 300;

/**
 * Пачки генерации: загрузка исходников и их состояние.
 *
 * Файлы приходят по одному на запрос, а не пачкой в одном теле. Так сделано
 * не для красоты: nginx пропускает 30 МБ на запрос целиком, и полсотни
 * макетов в него просто не влезут. Заодно у браузера появляется честный
 * прогресс, а один битый файл не роняет загрузку остальных.
 */
@Injectable()
export class ImageCardBatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageCardStorageService,
  ) {}

  /** История пачек, свежие сверху. */
  async list() {
    const batches = await this.prisma.imageCardBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        createdBy: { select: { id: true, username: true } },
        _count: { select: { sources: true, cards: true } },
      },
    });
    return batches;
  }

  async get(id: string) {
    const batch = await this.prisma.imageCardBatch.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, username: true } },
        sources: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!batch) throw new NotFoundException('Пачка не найдена');
    return {
      ...batch,
      progress: summarize(batch.sources),
      report: await this.report(id, batch.sources),
    };
  }

  /**
   * Сводка по пачке: сколько исходников, сколько карточек запланировано и
   * что с ними стало. Считается на сервере, а не собирается на клиенте, —
   * иначе цифры разъедутся с тем, что реально лежит в базе.
   */
  private async report(batchId: string, sources: { status: string }[]) {
    const grouped = await this.prisma.imageCardGenerated.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all]),
    ) as Record<string, number>;

    const count = (status: string) => byStatus[status] ?? 0;
    const cards = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    const ready = sources.filter((s) => s.status === 'READY').length;

    const settings = await this.prisma.imageCardBatch.findUnique({
      where: { id: batchId },
      select: { settings: true },
    });
    const mode =
      (settings?.settings as { mode?: string } | null)?.mode ?? 'BOTH';

    return {
      sourcesTotal: sources.length,
      sourcesReady: ready,
      sourcesFailed: sources.filter((s) => s.status === 'ERROR').length,
      /** Сколько карточек должно получиться из готовых исходников. */
      cardsExpected: ready * (mode === 'BOTH' ? 2 : 1),
      cardsTotal: cards,
      generated: count('GENERATED'),
      reviewRequired: count('REVIEW_REQUIRED'),
      approved: count('APPROVED'),
      finalized: count('FINALIZED'),
      failed: count('ERROR'),
      skipped: count('SKIPPED'),
    };
  }

  create(dto: DtoCreateImageCardBatch, userId: string | null) {
    return this.prisma.imageCardBatch.create({
      data: {
        title: dto.title?.trim() || defaultTitle(),
        settings: {
          mode: dto.mode ?? 'BOTH',
          removeWhiteBackground: dto.removeWhiteBackground ?? false,
          autoPlacement: dto.autoPlacement ?? true,
          templateIds: dto.templateIds ?? [],
        },
        createdById: userId,
      },
    });
  }

  async updateSettings(id: string, dto: DtoCreateImageCardBatch) {
    const batch = await this.requireBatch(id);
    const current = (batch.settings ?? {}) as Record<string, unknown>;
    return this.prisma.imageCardBatch.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        settings: {
          ...current,
          ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
          ...(dto.removeWhiteBackground !== undefined
            ? { removeWhiteBackground: dto.removeWhiteBackground }
            : {}),
          ...(dto.autoPlacement !== undefined
            ? { autoPlacement: dto.autoPlacement }
            : {}),
          ...(dto.templateIds !== undefined
            ? { templateIds: dto.templateIds }
            : {}),
        },
      },
    });
  }

  /**
   * Приём одного исходника.
   *
   * Тип определяется по первым байтам файла, а не по MIME и не по расширению:
   * и то и другое присылает браузер, то есть назначает их тот, кто загружает.
   */
  async addSource(batchId: string, file: UploadedFileLike) {
    const batch = await this.requireBatch(batchId);
    if (file.size > IMAGE_CARD_MAX_BYTES) {
      throw new BadRequestException('Файл больше 30 МБ');
    }

    const sourceType = sniffSourceType(file.buffer);
    if (!sourceType) {
      throw new BadRequestException(
        'Формат файла не поддерживается — нужен PDF, PNG, JPEG или WEBP',
      );
    }

    const existing = await this.prisma.imageCardSource.findMany({
      where: { batchId },
      select: { baseName: true },
    });
    if (existing.length >= MAX_SOURCES) {
      throw new BadRequestException(
        `В одной пачке не больше ${MAX_SOURCES} исходников`,
      );
    }

    const originalName = file.originalname ?? 'design';
    const baseName = uniqueBaseName(
      cleanBaseName(originalName),
      new Set(existing.map((s) => s.baseName)),
    );

    const filename = await this.storage.saveSource(
      batchId,
      baseName,
      sourceType,
      file.buffer,
    );

    return this.prisma.imageCardSource.create({
      data: {
        batchId: batch.id,
        originalName,
        baseName,
        sourceType,
        sourceFile: filename,
      },
    });
  }

  /** Повторить обработку файла, который упал: снова в очередь. */
  async retrySource(sourceId: string) {
    const source = await this.prisma.imageCardSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Исходник не найден');
    return this.prisma.imageCardSource.update({
      where: { id: sourceId },
      data: { status: 'PENDING', errorMessage: null },
    });
  }

  async removeSource(sourceId: string) {
    const source = await this.prisma.imageCardSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Исходник не найден');
    await this.storage.removeSource(
      source.batchId,
      source.sourceFile,
      source.baseName,
    );
    await this.prisma.imageCardSource.delete({ where: { id: sourceId } });
    return { ok: true };
  }

  async remove(id: string) {
    await this.requireBatch(id);
    await this.storage.removeBatch(id);
    await this.prisma.imageCardBatch.delete({ where: { id } });
    return { ok: true };
  }

  /** Растр исходника — то, что реально пойдёт в композит. */
  async readRaster(sourceId: string): Promise<Buffer> {
    const source = await this.prisma.imageCardSource.findUnique({
      where: { id: sourceId },
      select: { batchId: true, baseName: true, status: true },
    });
    if (!source) throw new NotFoundException('Исходник не найден');
    if (source.status !== 'READY') {
      throw new NotFoundException('Исходник ещё не обработан');
    }
    return this.storage.readFile(
      this.storage.rasterPath(source.batchId, source.baseName),
    );
  }

  /** Карточки пачки для сетки проверки. */
  async listCards(batchId: string) {
    await this.requireBatch(batchId);
    return this.prisma.imageCardGenerated.findMany({
      where: { batchId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        source: {
          select: {
            id: true,
            originalName: true,
            baseName: true,
            // Размеры нужны редактору: по ним считается, куда и какого
            // размера ложится принт.
            widthPx: true,
            heightPx: true,
          },
        },
      },
    });
  }

  /** Превью карточки — то, что видно в сетке. */
  async readPreview(cardId: string): Promise<Buffer> {
    const card = await this.prisma.imageCardGenerated.findUnique({
      where: { id: cardId },
      include: { source: { select: { baseName: true } } },
    });
    if (!card) throw new NotFoundException('Карточка не найдена');
    if (!card.previewFile) {
      throw new NotFoundException('Превью ещё не собрано');
    }
    return this.storage.readFile(
      this.storage.previewPath(
        card.batchId,
        card.source.baseName,
        card.shirtColor,
      ),
    );
  }

  /**
   * Картинка шаблона, которой карточка собрана.
   *
   * Именно из снимка, а не текущая версия шаблона: редактор должен показывать
   * то же, что уйдёт в файл, иначе после замены шаблона человек двигал бы
   * принт по одной подложке, а получал другую.
   */
  async readCardTemplate(cardId: string): Promise<Buffer> {
    const card = await this.prisma.imageCardGenerated.findUnique({
      where: { id: cardId },
      select: { templateSnapshot: true },
    });
    if (!card) throw new NotFoundException('Карточка не найдена');
    const file = (card.templateSnapshot as { file?: unknown } | null)?.file;
    if (typeof file !== 'string' || !file) {
      throw new NotFoundException('У карточки нет снимка шаблона');
    }
    return this.storage.readTemplate(file);
  }

  /**
   * Готовые файлы пачки для выгрузки архивом.
   *
   * Отдаём список, а не сам архив: собирать zip — дело контроллера, а знать,
   * что и под каким именем лежит, — дело этого сервиса.
   */
  async listFinalFiles(batchId: string) {
    const batch = await this.requireBatch(batchId);
    const cards = await this.prisma.imageCardGenerated.findMany({
      where: { batchId, status: 'FINALIZED', finalFile: { not: null } },
      orderBy: [{ createdAt: 'asc' }],
      include: { source: { select: { baseName: true } } },
    });

    return {
      title: batch.title,
      files: cards.map((card) => ({
        // Внутри архива повторяем структуру из ТЗ: папка на дизайн.
        entryName: `${card.source.baseName}/${card.finalFile}`,
        fullPath: path.join(
          this.storage.batchDir(batchId, 'generated', card.source.baseName),
          card.finalFile as string,
        ),
      })),
    };
  }

  private async requireBatch(id: string) {
    const batch = await this.prisma.imageCardBatch.findUnique({
      where: { id },
    });
    if (!batch) throw new NotFoundException('Пачка не найдена');
    return batch;
  }
}

interface SourceLike {
  status: string;
}

/** Сводка по исходникам — из неё фронт рисует прогресс «18 из 42». */
export function summarize(sources: SourceLike[]) {
  const total = sources.length;
  const ready = sources.filter((s) => s.status === 'READY').length;
  const failed = sources.filter((s) => s.status === 'ERROR').length;
  const pending = sources.filter(
    (s) => s.status === 'PENDING' || s.status === 'PROCESSING',
  ).length;
  return { total, ready, failed, pending, done: ready + failed };
}

function defaultTitle(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Генерация ${pad(now.getDate())}.${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
