import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EnumApprovalSide } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ApprovalStorageService,
  type UploadedImage,
} from './approval-storage.service';
import {
  DtoCreateMockupTemplate,
  DtoUpdateMockupTemplate,
} from './dto/mockup-template.dto';

/**
 * Шаблоны мокапов: фотографии изделий и калибровка зоны печати.
 *
 * Модуль сознательно не знает, что футболок ровно две. Новый цвет, спина,
 * худи или детская футболка добавляются строкой в этой таблице и загруженной
 * фотографией — код при этом не меняется.
 */
@Injectable()
export class MockupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ApprovalStorageService,
  ) {}

  list() {
    return this.prisma.mockupTemplate.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async get(id: string) {
    const template = await this.prisma.mockupTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Шаблон мокапа не найден');
    return template;
  }

  /** Шаблон под выбранный цвет футболки и сторону печати. */
  async findByColorAndSide(color: string, side: EnumApprovalSide) {
    const templates = await this.prisma.mockupTemplate.findMany({
      where: { side, isActive: true },
      orderBy: [{ sortOrder: 'asc' }],
    });
    const wanted = color.trim().toLowerCase();
    return (
      templates.find((t) => t.color.trim().toLowerCase() === wanted) ?? null
    );
  }

  async create(dto: DtoCreateMockupTemplate) {
    const existing = await this.prisma.mockupTemplate.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new BadRequestException('Шаблон с таким ключом уже есть');
    }
    return this.prisma.mockupTemplate.create({
      data: {
        key: dto.key,
        title: dto.title,
        color: dto.color,
        side: dto.side,
        garmentType: dto.garmentType ?? 'tshirt',
        sortOrder: dto.sortOrder ?? 100,
      },
    });
  }

  async update(id: string, dto: DtoUpdateMockupTemplate) {
    const template = await this.get(id);
    const next = { ...template, ...dto };

    // Зона печати должна оставаться внутри фотографии, иначе принт будет
    // считаться от координат, которых на снимке нет.
    if (next.imageWidth && next.imageHeight) {
      const right = next.printAreaX + next.printAreaWidth;
      const bottom = next.printAreaY + next.printAreaHeight;
      if (right > next.imageWidth || bottom > next.imageHeight) {
        throw new BadRequestException(
          `Зона печати выходит за пределы фотографии (${next.imageWidth} × ${next.imageHeight} px)`,
        );
      }
    }

    return this.prisma.mockupTemplate.update({ where: { id }, data: dto });
  }

  /**
   * Загружает фотографию шаблона. Некалиброванному шаблону сразу ставим
   * зону печати «по умолчанию» — прямоугольник на груди: пустая рамка в
   * ноль пикселей сделала бы шаблон нерабочим до ручной настройки, а так
   * им можно пользоваться сразу и уточнить размеры позже.
   */
  async uploadImage(id: string, file: UploadedImage) {
    const template = await this.get(id);
    const saved = await this.storage.saveMockup(file);
    await this.storage.removeMockup(template.imageFile);

    const needsDefaultArea =
      template.printAreaWidth <= 0 || template.printAreaHeight <= 0;
    // Пропорции рамки должны совпадать с пропорциями её реального размера,
    // иначе калибровка противоречит сама себе: масштаб считается по ширине,
    // и «зона 40 × 50 см» оказалась бы нарисована как 40 × 54. Поэтому высоту
    // в пикселях выводим из ширины и заявленных миллиметров, а не из высоты
    // кадра.
    const width = Math.round(saved.width * 0.42);
    const defaults = needsDefaultArea
      ? {
          printAreaWidth: width,
          printAreaHeight: Math.round(
            (width * template.printAreaHeightMm) / template.printAreaWidthMm,
          ),
          printAreaX: Math.round((saved.width - width) / 2),
          printAreaY: Math.round(saved.height * 0.26),
        }
      : {};

    return this.prisma.mockupTemplate.update({
      where: { id },
      data: {
        imageFile: saved.filename,
        imageWidth: saved.width,
        imageHeight: saved.height,
        ...defaults,
      },
    });
  }

  async remove(id: string) {
    const template = await this.get(id);
    await this.storage.removeMockup(template.imageFile);
    await this.prisma.mockupTemplate.delete({ where: { id } });
    return { ok: true };
  }

  async readImage(id: string): Promise<Buffer> {
    const template = await this.get(id);
    if (!template.imageFile) {
      throw new NotFoundException('У шаблона нет фотографии');
    }
    return this.storage.readMockup(template.imageFile);
  }
}
