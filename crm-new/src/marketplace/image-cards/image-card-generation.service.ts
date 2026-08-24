import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import type { EnumGeneratedCardStatus } from 'src/generated/prisma/enums';
import {
  DEFAULT_TRANSFORM,
  isUsableArea,
  parseRect,
  parseTransform,
  reviewReasons,
  REVIEW_LABELS,
  type ReviewReason,
} from './image-card-placement';
import type { CardMode } from './dto/image-card-batch.dto';
import type { DtoUpdateImageCard } from './dto/image-card-update.dto';
import type { BulkAction } from './dto/image-card-bulk.dto';

/** Какие цвета собирать в каждом режиме. */
const MODE_COLORS: Record<CardMode, string[]> = {
  BLACK: ['black'],
  WHITE: ['white'],
  BOTH: ['black', 'white'],
};

/**
 * Постановка карточек в работу.
 *
 * Здесь только решение «что собирать»: пары «исходник × шаблон», начальное
 * положение принта и пометка «требует проверки». Сама отрисовка идёт фоном —
 * держать запрос открытым на сотне композитов нельзя.
 */
@Injectable()
export class ImageCardGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Создаёт недостающие карточки пачки.
   *
   * Повторный запуск не трогает уже собранное: он лишь добавляет пары, которых
   * ещё нет. Иначе догрузка пяти файлов к сорока стирала бы ручные правки в
   * тридцати пяти.
   */
  async generate(batchId: string) {
    const batch = await this.prisma.imageCardBatch.findUnique({
      where: { id: batchId },
      include: { sources: true },
    });
    if (!batch) throw new NotFoundException('Пачка не найдена');

    const settings = (batch.settings ?? {}) as {
      mode?: CardMode;
      templateIds?: string[];
      removeWhiteBackground?: boolean;
    };
    const mode = settings.mode ?? 'BOTH';
    const colors = MODE_COLORS[mode] ?? MODE_COLORS.BOTH;

    const ready = batch.sources.filter((s) => s.status === 'READY');
    if (ready.length === 0) {
      throw new BadRequestException(
        'Нет ни одного готового исходника — дождитесь обработки загруженных файлов',
      );
    }

    const templates = await this.resolveTemplates(
      colors,
      settings.templateIds ?? [],
    );

    const existing = await this.prisma.imageCardGenerated.findMany({
      where: { batchId },
      select: { sourceId: true, templateId: true },
    });
    const done = new Set(
      existing.map((card) => `${card.sourceId}:${card.templateId}`),
    );

    const rows: {
      batchId: string;
      sourceId: string;
      templateId: string;
      templateSnapshot: object;
      shirtColor: string;
      status: 'GENERATED' | 'REVIEW_REQUIRED';
      transform: object;
      removeWhiteBackground: boolean;
      note: string | null;
    }[] = [];

    for (const source of ready) {
      for (const template of templates) {
        if (done.has(`${source.id}:${template.id}`)) continue;

        const area = parseRect(template.placementArea);
        const reasons = reviewReasons(
          { width: source.widthPx, height: source.heightPx },
          area,
          DEFAULT_TRANSFORM,
        );

        rows.push({
          batchId,
          sourceId: source.id,
          templateId: template.id,
          // Снимок шаблона: карточка потом рисуется тем, чем её собирали,
          // даже если шаблон заменят.
          templateSnapshot: {
            version: template.version,
            file: template.templateFile,
            canvasWidth: template.canvasWidth,
            canvasHeight: template.canvasHeight,
            placementArea: area,
          },
          shirtColor: template.shirtColor,
          status: reasons.length > 0 ? 'REVIEW_REQUIRED' : 'GENERATED',
          transform: { ...DEFAULT_TRANSFORM },
          removeWhiteBackground: settings.removeWhiteBackground ?? false,
          note: describe(reasons),
        });
      }
    }

    if (rows.length > 0) {
      await this.prisma.imageCardGenerated.createMany({ data: rows });
    }

    await this.prisma.imageCardBatch.update({
      where: { id: batchId },
      data: { status: 'PROCESSING' },
    });

    return {
      created: rows.length,
      sources: ready.length,
      templates: templates.length,
      expected: ready.length * templates.length,
    };
  }

  /**
   * Кнопка «Сгенерировать финальные PNG».
   *
   * Карточки со статусом «требует проверки» сюда не попадают, пока человек
   * не подтвердит это отдельно (`includeReview`): именно на них автоматика и
   * засомневалась, и молча выгружать их в готовое нельзя. Пропущенные и
   * сломанные не берём никогда.
   *
   * Сам рендер идёт фоном — сотня композитов в полном разрешении в один
   * запрос не поместится.
   */
  async finalize(batchId: string, includeReview: boolean) {
    const batch = await this.prisma.imageCardBatch.findUnique({
      where: { id: batchId },
      select: { id: true },
    });
    if (!batch) throw new NotFoundException('Пачка не найдена');

    const statuses: EnumGeneratedCardStatus[] = includeReview
      ? ['GENERATED', 'APPROVED', 'REVIEW_REQUIRED']
      : ['GENERATED', 'APPROVED'];

    const eligible = await this.prisma.imageCardGenerated.count({
      where: { batchId, status: { in: statuses }, previewFile: { not: null } },
    });
    if (eligible === 0) {
      throw new BadRequestException(
        'Нечего финализировать: карточки либо ещё собираются, либо пропущены, либо ждут проверки',
      );
    }

    await this.prisma.imageCardGenerated.updateMany({
      where: { batchId, status: { in: statuses }, previewFile: { not: null } },
      // Финал пересобираем заново: карточку могли править после прошлого раза.
      data: { status: 'APPROVED', finalFile: null, validation: Prisma.DbNull },
    });

    await this.prisma.imageCardBatch.update({
      where: { id: batchId },
      data: { status: 'FINALIZING', completedAt: null },
    });

    return { queued: eligible };
  }

  /**
   * Правка карточки из сетки: одобрить, пропустить, вернуть в работу либо
   * поменять положение принта.
   *
   * Смена положения или настройки фона сбрасывает превью: оно перестало
   * соответствовать карточке, и показывать старое хуже, чем подождать
   * несколько секунд, пока фон соберёт новое.
   */
  async updateCard(cardId: string, dto: DtoUpdateImageCard) {
    const card = await this.requireCard(cardId);
    const data: Prisma.ImageCardGeneratedUpdateInput = {};

    if (dto.status !== undefined) data.status = dto.status;

    const visualChanged =
      dto.transform !== undefined || dto.removeWhiteBackground !== undefined;

    if (dto.transform !== undefined) {
      // Приводим к нашему виду и обратно в обычный объект: колонка Json
      // не принимает типизированный интерфейс без индексной сигнатуры.
      data.transform = { ...parseTransform(dto.transform) };
    }
    if (dto.removeWhiteBackground !== undefined) {
      data.removeWhiteBackground = dto.removeWhiteBackground;
    }
    if (visualChanged) {
      data.previewFile = null;
      // Финальный файл тоже устарел: собирать его заново будет Этап 7.
      data.finalFile = null;
    }

    return this.prisma.imageCardGenerated.update({
      where: { id: card.id },
      data,
      include: {
        source: { select: { id: true, originalName: true, baseName: true } },
      },
    });
  }

  /**
   * Вернуть карточку к автоматическому размещению.
   *
   * Пересчитываем и пометку «требует проверки»: исходник мог быть заменён, и
   * прошлая причина могла исчезнуть либо появиться новая.
   */
  async regenerateCard(cardId: string) {
    const card = await this.requireCard(cardId);
    const area = parseRect(
      (card.templateSnapshot as { placementArea?: unknown } | null)
        ?.placementArea,
    );
    const reasons = reviewReasons(
      { width: card.source.widthPx, height: card.source.heightPx },
      area,
      DEFAULT_TRANSFORM,
    );

    return this.prisma.imageCardGenerated.update({
      where: { id: card.id },
      data: {
        transform: { ...DEFAULT_TRANSFORM },
        previewFile: null,
        finalFile: null,
        status: reasons.length > 0 ? 'REVIEW_REQUIRED' : 'GENERATED',
        note: describe(reasons),
      },
      include: {
        source: { select: { id: true, originalName: true, baseName: true } },
      },
    });
  }

  /**
   * Массовое действие над отмеченными карточками.
   *
   * Всё делается одним запросом к базе там, где это возможно: сотня отдельных
   * запросов из браузера превратила бы «одобрить всё» в минуту ожидания.
   * Пересборка — исключение: там у каждой карточки свой пересчёт пометки
   * «требует проверки».
   */
  async bulk(batchId: string, ids: string[], action: BulkAction) {
    const where = { id: { in: ids }, batchId };

    if (action === 'APPROVE') {
      // Одобрять нечего, пока нет превью: одобрять было бы нечего смотреть.
      const result = await this.prisma.imageCardGenerated.updateMany({
        where: { ...where, previewFile: { not: null } },
        data: { status: 'APPROVED' },
      });
      return { changed: result.count };
    }

    if (action === 'SKIP' || action === 'UNSKIP') {
      const result = await this.prisma.imageCardGenerated.updateMany({
        where,
        data: { status: action === 'SKIP' ? 'SKIPPED' : 'GENERATED' },
      });
      return { changed: result.count };
    }

    if (action === 'CENTER') {
      const cards = await this.prisma.imageCardGenerated.findMany({
        where,
        select: { id: true, transform: true },
      });
      for (const card of cards) {
        const current = parseTransform(card.transform);
        await this.prisma.imageCardGenerated.update({
          where: { id: card.id },
          data: {
            transform: { ...current, x: 0.5, y: 0.5 },
            previewFile: null,
            finalFile: null,
          },
        });
      }
      return { changed: cards.length };
    }

    // REGENERATE: у каждой карточки свой пересчёт причины проверки.
    const cards = await this.prisma.imageCardGenerated.findMany({
      where,
      select: { id: true },
    });
    for (const card of cards) {
      await this.regenerateCard(card.id);
    }
    return { changed: cards.length };
  }

  private async requireCard(cardId: string) {
    const card = await this.prisma.imageCardGenerated.findUnique({
      where: { id: cardId },
      include: { source: true },
    });
    if (!card) throw new NotFoundException('Карточка не найдена');
    return card;
  }

  /**
   * Какими шаблонами собирать. Явно выбранные имеют приоритет; если не
   * выбрано ничего — берём активные и готовые по нужным цветам, по одному
   * на цвет: две карточки одного цвета из одного дизайна Ozon не нужны.
   */
  private async resolveTemplates(colors: string[], chosen: string[]) {
    const all = await this.prisma.imageCardTemplate.findMany({
      where: chosen.length > 0 ? { id: { in: chosen } } : { active: true },
      orderBy: { createdAt: 'asc' },
    });

    const usable = all.filter(
      (t) => t.templateFile && isUsableArea(parseRect(t.placementArea)),
    );

    const picked = colors
      .map((color) =>
        usable.find((t) => t.shirtColor.trim().toLowerCase() === color),
      )
      .filter((t): t is (typeof usable)[number] => Boolean(t));

    if (picked.length === 0) {
      throw new BadRequestException(
        'Нет готового шаблона под выбранный режим. Загрузите картинку шаблона и задайте область принта на вкладке «Шаблоны».',
      );
    }
    return picked;
  }
}

/** Человеческая формулировка того, почему карточку стоит посмотреть. */
function describe(reasons: ReviewReason[]): string | null {
  if (reasons.length === 0) return null;
  return reasons.map((reason) => REVIEW_LABELS[reason]).join('; ');
}
