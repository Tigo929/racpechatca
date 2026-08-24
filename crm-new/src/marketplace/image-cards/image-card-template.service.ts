import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { isUsableArea, parseRect, type Rect } from './image-card-placement';
import {
  ImageCardStorageService,
  type UploadedFileLike,
} from './image-card-storage.service';
import {
  DtoCreateImageCardTemplate,
  DtoUpdateImageCardTemplate,
} from './dto/image-card-template.dto';

/**
 * Шаблоны карточек: готовые композиции с футболкой, фоном и инфографикой.
 *
 * Модуль не знает, что футболок ровно две. Новый цвет, худи или другая
 * площадка добавляются строкой в этой таблице и загруженной картинкой —
 * React-код при этом не меняется, как и требует ТЗ.
 */
@Injectable()
export class ImageCardTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageCardStorageService,
  ) {}

  list() {
    return this.prisma.imageCardTemplate.findMany({
      orderBy: [{ shirtColor: 'asc' }, { title: 'asc' }],
    });
  }

  async get(id: string) {
    const template = await this.prisma.imageCardTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException('Шаблон карточки не найден');
    return template;
  }

  create(dto: DtoCreateImageCardTemplate) {
    return this.prisma.imageCardTemplate.create({
      data: {
        title: dto.title,
        shirtColor: dto.shirtColor.trim().toLowerCase(),
      },
    });
  }

  /**
   * Правка шаблона. Любое изменение области размещения поднимает версию:
   * по ней видно, что карточки, собранные раньше, рисовались по другим
   * координатам, и их вид не «поедет» задним числом.
   */
  async update(id: string, dto: DtoUpdateImageCardTemplate) {
    const template = await this.get(id);
    const data: Prisma.ImageCardTemplateUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.shirtColor !== undefined) {
      data.shirtColor = dto.shirtColor.trim().toLowerCase();
    }
    if (dto.active !== undefined) data.active = dto.active;

    let areaChanged = false;
    if (dto.placementArea) {
      const area = parseRect(dto.placementArea);
      this.assertInsideCanvas(
        area,
        template.canvasWidth,
        template.canvasHeight,
      );
      if (!isUsableArea(area)) {
        throw new BadRequestException('Область размещения не задана');
      }
      data.placementArea = area as unknown as Prisma.InputJsonObject;
      areaChanged = true;
    }
    if (dto.safeArea !== undefined) {
      if (dto.safeArea === null) {
        data.safeArea = Prisma.DbNull;
      } else {
        const safe = parseRect(dto.safeArea);
        this.assertInsideCanvas(
          safe,
          template.canvasWidth,
          template.canvasHeight,
        );
        data.safeArea = safe as unknown as Prisma.InputJsonObject;
      }
      areaChanged = true;
    }
    if (areaChanged) data.version = { increment: 1 };

    return this.prisma.imageCardTemplate.update({ where: { id }, data });
  }

  /**
   * Загрузка картинки шаблона.
   *
   * Область размещения при первой загрузке ставим по умолчанию — прямоугольник
   * на груди в пропорции 3:4. Пустая рамка в ноль пикселей сделала бы шаблон
   * нерабочим до ручной настройки, а так им можно пользоваться сразу и
   * уточнить границы мышью.
   */
  async uploadImage(id: string, file: UploadedFileLike) {
    const template = await this.get(id);
    const saved = await this.storage.saveTemplate(file);

    const current = parseRect(template.placementArea);
    const width = Math.round(saved.width * 0.5);
    const defaults = isUsableArea(current)
      ? {}
      : {
          placementArea: {
            x: Math.round((saved.width - width) / 2),
            y: Math.round(saved.height * 0.22),
            width,
            // Пропорция области 3:4, как у самой карточки Ozon.
            height: Math.round((width * 4) / 3),
          } as unknown as Prisma.InputJsonObject,
        };

    // Прошлый файл намеренно не удаляем: на него ссылаются уже собранные
    // карточки, и без него они перестали бы перерисовываться.
    return this.prisma.imageCardTemplate.update({
      where: { id },
      data: {
        templateFile: saved.filename,
        canvasWidth: saved.width,
        canvasHeight: saved.height,
        version: { increment: 1 },
        ...defaults,
      },
    });
  }

  async readImage(id: string): Promise<Buffer> {
    const template = await this.get(id);
    if (!template.templateFile) {
      throw new NotFoundException('У шаблона нет картинки');
    }
    return this.storage.readTemplate(template.templateFile);
  }

  /**
   * Удаление шаблона. Разрешено, только пока на него не ссылается ни одна
   * карточка: иначе исчезнет история того, чем эти карточки собирали.
   * Ненужный шаблон правильно не удалять, а снять галку «активен».
   */
  async remove(id: string) {
    await this.get(id);
    const used = await this.prisma.imageCardGenerated.count({
      where: { templateId: id },
    });
    if (used > 0) {
      throw new BadRequestException(
        `Шаблон использован в ${used} карточках — его нельзя удалить. Снимите галку «активен», и он перестанет предлагаться в новых пачках.`,
      );
    }
    const template = await this.get(id);
    await this.storage.removeTemplate(template.templateFile);
    await this.prisma.imageCardTemplate.delete({ where: { id } });
    return { ok: true };
  }

  private assertInsideCanvas(area: Rect, width: number, height: number): void {
    if (!width || !height) return;
    if (
      area.x < 0 ||
      area.y < 0 ||
      area.x + area.width > width ||
      area.y + area.height > height
    ) {
      throw new BadRequestException(
        `Область выходит за пределы шаблона (${width} × ${height} px)`,
      );
    }
  }
}
