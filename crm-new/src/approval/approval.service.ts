import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from 'src/generated/prisma/client';
import type {
  EnumApprovalSide,
  EnumTshirtSize,
} from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { isCalibrated } from './approval-geometry';
import {
  filledSides,
  parseSides,
  type ApprovalSideState,
  type ApprovalSides,
} from './approval-state';
import {
  ApprovalStorageService,
  type UploadedImage,
} from './approval-storage.service';
import {
  ApprovalRenderService,
  type RenderSideInput,
} from './approval-render.service';
import { MockupService } from './mockup.service';
import { DtoCreateApproval } from './dto/create-approval.dto';
import { DtoUpdateApproval } from './dto/update-approval.dto';

const SIZE_LABELS: Record<EnumTshirtSize, string> = {
  XS: 'XS',
  S: 'S',
  M: 'M',
  L: 'L',
  XL: 'XL',
  XXL: '2XL',
  XXXL: '3XL',
};

/** Размер печати по умолчанию для только что загруженного принта: 28 × 35 см. */
const DEFAULT_WIDTH_MM = 280;

const approvalInclude = {
  createdBy: { select: { id: true, username: true } },
} satisfies Prisma.PrintApprovalInclude;

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ApprovalStorageService,
    private readonly render: ApprovalRenderService,
    private readonly mockups: MockupService,
  ) {}

  /** Версии согласования по заказу, свежие сверху. */
  async list(orderId: string) {
    const rows = await this.prisma.printApproval.findMany({
      where: { orderId },
      orderBy: { version: 'desc' },
      include: approvalInclude,
    });
    return rows.map((row) => this.toView(row));
  }

  async get(id: string) {
    return this.toView(await this.load(id));
  }

  async create(dto: DtoCreateApproval, userId: string | null) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: dto.orderId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const last = await this.prisma.printApproval.findFirst({
      where: { orderId: dto.orderId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    let sides: ApprovalSides = {};
    if (dto.copyFromId) {
      sides = await this.copySides(dto.copyFromId, dto.orderId);
    }
    sides = await this.syncTemplates(sides, dto.shirtColor);

    const created = await this.prisma.printApproval.create({
      data: {
        orderId: dto.orderId,
        version: (last?.version ?? 0) + 1,
        shirtColor: dto.shirtColor,
        shirtSize: dto.shirtSize,
        sides: sides as unknown as Prisma.InputJsonObject,
        createdById: userId,
      },
      include: approvalInclude,
    });
    return this.toView(created);
  }

  /**
   * Сохранение черновика. Вызывается автосохранением после каждого движения
   * принта, поэтому пишет ровно то, что пришло, и ничего не пересчитывает,
   * кроме привязки к шаблону при смене цвета футболки.
   */
  async update(id: string, dto: DtoUpdateApproval) {
    const approval = await this.load(id);
    const data: Prisma.PrintApprovalUpdateInput = {};

    if (dto.comment !== undefined) data.comment = dto.comment || null;
    if (dto.shirtSize !== undefined) data.shirtSize = dto.shirtSize;
    if (dto.status !== undefined) data.status = dto.status;

    const color = dto.shirtColor ?? approval.shirtColor;
    if (dto.shirtColor !== undefined) data.shirtColor = dto.shirtColor;

    if (dto.sides !== undefined || dto.shirtColor !== undefined) {
      const base = dto.sides
        ? parseSides(dto.sides)
        : parseSides(approval.sides);
      const synced = await this.syncTemplates(base, color);
      data.sides = synced as unknown as Prisma.InputJsonObject;
    }

    const updated = await this.prisma.printApproval.update({
      where: { id },
      data,
      include: approvalInclude,
    });
    return this.toView(updated);
  }

  /** Загрузка принта на сторону. Прошлый файл этой стороны удаляется. */
  async uploadPrint(id: string, side: EnumApprovalSide, file: UploadedImage) {
    const approval = await this.load(id);
    const sides = parseSides(approval.sides);
    const template = await this.mockups.findByColorAndSide(
      approval.shirtColor,
      side,
    );
    if (!template) {
      throw new BadRequestException(
        `Нет шаблона мокапа для футболки «${approval.shirtColor}» (${side === 'FRONT' ? 'лицевая' : 'спина'})`,
      );
    }

    const saved = await this.storage.savePrint(file);
    await this.storage.removePrint(sides[side]?.printFile);

    const previous = sides[side];
    // Пропорции берём от исходника: подставить произвольную высоту значило бы
    // растянуть принт по одной оси — ровно то, чего делать нельзя.
    const ratio = saved.sourceHeight / saved.sourceWidth;
    const widthMm = previous?.widthMm ?? DEFAULT_WIDTH_MM;

    const next: ApprovalSideState = {
      templateKey: template.key,
      printFile: saved.filename,
      printOriginalName: file.originalname ?? null,
      printWidthPx: saved.sourceWidth,
      printHeightPx: saved.sourceHeight,
      widthMm,
      heightMm: Math.round(widthMm * ratio),
      lockRatio: previous?.lockRatio ?? true,
      x: previous?.x ?? 0.5,
      y: previous?.y ?? 0.5,
      rotation: previous?.rotation ?? 0,
    };

    return this.saveSides(id, { ...sides, [side]: next });
  }

  /** Убирает принт со стороны вместе с файлом. */
  async removePrint(id: string, side: EnumApprovalSide) {
    const approval = await this.load(id);
    const sides = parseSides(approval.sides);
    await this.storage.removePrint(sides[side]?.printFile);
    const next = { ...sides };
    delete next[side];
    return this.saveSides(id, next);
  }

  async readPrint(id: string, side: EnumApprovalSide): Promise<Buffer> {
    const approval = await this.load(id);
    const file = parseSides(approval.sides)[side]?.printFile;
    if (!file) throw new NotFoundException('Принт отсутствует');
    return this.storage.readPrint(file);
  }

  /** Предпросмотр листа: рисуем, но никуда не сохраняем. */
  async preview(id: string): Promise<Buffer> {
    const approval = await this.load(id);
    return this.render.renderSheet(await this.buildRenderInput(approval));
  }

  /**
   * Кнопка «Готово»: проверяем данные, рисуем лист, кладём его в заказ.
   * Версию не меняем — файл принадлежит той версии, из которой сделан.
   */
  async finalize(id: string) {
    const approval = await this.load(id);
    const png = await this.render.renderSheet(
      await this.buildRenderInput(approval),
    );
    // Имя файла детерминированное: повторное «Готово» переписывает лист той
    // же версии, а не плодит копии. Прошлые версии заказа при этом целы —
    // у них своя цифра в имени.
    const filename = await this.storage.saveSheet(
      approval.id,
      approval.version,
      png,
    );

    const updated = await this.prisma.printApproval.update({
      where: { id },
      data: {
        previewFile: filename,
        finalizedAt: new Date(),
        status: approval.status === 'DRAFT' ? 'READY' : approval.status,
      },
      include: approvalInclude,
    });
    return this.toView(updated);
  }

  async readSheet(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const approval = await this.load(id);
    if (!approval.previewFile) {
      throw new NotFoundException('Файл ещё не сформирован — нажмите «Готово»');
    }
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: approval.orderId },
      select: { numberOrder: true },
    });
    return {
      buffer: await this.storage.readSheet(approval.previewFile),
      filename: `Согласование_${order?.numberOrder ?? approval.orderId}_v${approval.version}.png`,
    };
  }

  async remove(id: string) {
    const approval = await this.load(id);
    for (const { state } of filledSides(parseSides(approval.sides))) {
      await this.storage.removePrint(state.printFile);
    }
    await this.storage.removeSheet(approval.previewFile);
    await this.prisma.printApproval.delete({ where: { id } });
    return { ok: true };
  }

  // ── внутреннее ──────────────────────────────────────────────

  private async load(id: string) {
    const approval = await this.prisma.printApproval.findUnique({
      where: { id },
      include: approvalInclude,
    });
    if (!approval) throw new NotFoundException('Согласование не найдено');
    return approval;
  }

  private async saveSides(id: string, sides: ApprovalSides) {
    const updated = await this.prisma.printApproval.update({
      where: { id },
      data: { sides: sides as unknown as Prisma.InputJsonObject },
      include: approvalInclude,
    });
    return this.toView(updated);
  }

  /**
   * Держит привязку сторон к шаблонам в согласии с выбранным цветом футболки.
   * Сотрудник переключил чёрную на белую — принты должны переехать на белый
   * мокап сами, без повторной загрузки.
   */
  private async syncTemplates(
    sides: ApprovalSides,
    color: string,
  ): Promise<ApprovalSides> {
    const result: ApprovalSides = {};
    for (const side of ['FRONT', 'BACK'] as EnumApprovalSide[]) {
      const state = sides[side];
      if (!state) continue;
      const template = await this.mockups.findByColorAndSide(color, side);
      result[side] = template ? { ...state, templateKey: template.key } : state;
    }
    return result;
  }

  /** Копирует стороны прошлой версии вместе с независимыми копиями файлов. */
  private async copySides(
    sourceId: string,
    orderId: string,
  ): Promise<ApprovalSides> {
    const source = await this.prisma.printApproval.findUnique({
      where: { id: sourceId },
      select: { orderId: true, sides: true },
    });
    if (!source || source.orderId !== orderId) {
      throw new BadRequestException(
        'Версия, с которой копируем, не принадлежит этому заказу',
      );
    }
    const sides = parseSides(source.sides);
    const result: ApprovalSides = {};
    for (const { side, state } of filledSides(sides)) {
      result[side] = {
        ...state,
        printFile: await this.storage.copyPrint(state.printFile),
      };
    }
    return result;
  }

  /**
   * Собирает данные для отрисовки и по дороге проверяет всё, что должно быть
   * заполнено. Сообщения намеренно человеческие: их видит менеджер, а не
   * разработчик.
   */
  private async buildRenderInput(approval: {
    id: string;
    orderId: string;
    version: number;
    shirtColor: string;
    shirtSize: EnumTshirtSize;
    comment: string | null;
    sides: unknown;
  }) {
    const sides = parseSides(approval.sides);
    const filled = filledSides(sides);
    if (filled.length === 0) {
      throw new BadRequestException(
        'Принт отсутствует — загрузите файл хотя бы на одну сторону',
      );
    }

    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: approval.orderId },
      select: { numberOrder: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const templates = await this.prisma.mockupTemplate.findMany({
      where: { key: { in: filled.map((f) => f.state.templateKey) } },
    });

    const renderSides: RenderSideInput[] = [];
    for (const { side, state } of filled) {
      const template = templates.find((t) => t.key === state.templateKey);
      if (!template) {
        throw new BadRequestException(
          `Шаблон мокапа «${state.templateKey}» не найден — проверьте настройки`,
        );
      }
      if (!isCalibrated(template)) {
        throw new BadRequestException(
          `Шаблон «${template.title}» не готов: загрузите фотографию и задайте зону печати в настройках`,
        );
      }
      if (state.widthMm <= 0 || state.heightMm <= 0) {
        throw new BadRequestException('Не указан физический размер принта');
      }
      renderSides.push({ side, state, template });
    }

    // Перед всегда первый: клиент смотрит лист сверху вниз и слева направо.
    renderSides.sort((a, b) =>
      a.side === 'FRONT' ? -1 : b.side === 'FRONT' ? 1 : 0,
    );

    return {
      numberOrder: order.numberOrder,
      version: approval.version,
      shirtColor: approval.shirtColor,
      shirtSizeLabel: SIZE_LABELS[approval.shirtSize] ?? approval.shirtSize,
      comment: approval.comment,
      date: new Date(),
      sides: renderSides,
    };
  }

  /**
   * Вид согласования наружу: стороны разобраны, плюс признак «файл устарел».
   * Он считается из дат, а не хранится колонкой: любая правка обновляет
   * updatedAt, и этого достаточно, чтобы понять — картинка уже не та.
   */
  private toView<
    T extends { sides: unknown; updatedAt: Date; finalizedAt: Date | null },
  >(approval: T) {
    return {
      ...approval,
      sides: parseSides(approval.sides),
      fileOutdated: Boolean(
        approval.finalizedAt &&
        approval.updatedAt.getTime() > approval.finalizedAt.getTime(),
      ),
    };
  }
}
