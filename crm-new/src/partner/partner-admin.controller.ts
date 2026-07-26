import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TechSpecStorageService,
  TECH_SPEC_MAX_BYTES,
  TECH_SPEC_MAX_FILES,
} from './tech-spec-storage.service';
import { PartnerOutboundService } from './partner-outbound.service';
import { getTechSpecPathAt } from './tech-spec-paths';

/**
 * Админские действия по отправке заказа партнёру: загрузка ТЗ-фото
 * (согласованного макета) и кнопка «Отправить исполнителю».
 */
@Controller('order-photo')
@UseGuards(JwtAuthGuard, RolesGuard)
// Менеджер по оформлению ведёт заказы наравне с админом: отправка партнёру и
// ТЗ-фото — часть оформления заказа-футболки.
@Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
export class PartnerAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: TechSpecStorageService,
    private readonly outbound: PartnerOutboundService,
  ) {}

  /** Прикрепить ТЗ-фото (согласованный с клиентом макет) к заказу. */
  @Post(':idOrder/techspec-photo')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: TECH_SPEC_MAX_BYTES, files: TECH_SPEC_MAX_FILES },
    }),
  )
  async uploadTechSpecPhoto(
    @Param('idOrder') idOrder: string,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    if (files.length === 0) throw new BadRequestException('Файл не передан');
    if (files.length > TECH_SPEC_MAX_FILES) {
      throw new BadRequestException(
        `Можно прикрепить не больше ${TECH_SPEC_MAX_FILES} файлов`,
      );
    }
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const filenames = await this.storage.saveMany(idOrder, files);
    return this.prisma.orderPhoto.update({
      where: { id: idOrder },
      data: {
        techSpecPhotoPath: filenames[0] ?? null,
        techSpecPhotoPaths: filenames,
      },
      include: {
        items: true,
        tshirtItems: true,
        executor: { select: { id: true, username: true } },
      },
    });
  }

  /** Просмотр прикреплённого ТЗ-фото (для админа в карточке). */
  @Get(':idOrder/techspec-photo')
  async viewTechSpecPhoto(
    @Param('idOrder') idOrder: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.streamTechSpecPhoto(idOrder, 0, res);
  }

  /** Просмотр конкретного ТЗ-файла по порядковому номеру, начиная с нуля. */
  @Get(':idOrder/techspec-photo/:index')
  async viewTechSpecPhotoByIndex(
    @Param('idOrder') idOrder: string,
    @Param('index') indexRaw: string,
    @Res() res: Response,
  ): Promise<void> {
    const index = Number(indexRaw);
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('Некорректный номер ТЗ-файла');
    }
    await this.streamTechSpecPhoto(idOrder, index, res);
  }

  private async streamTechSpecPhoto(
    idOrder: string,
    index: number,
    res: Response,
  ): Promise<void> {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      select: { techSpecPhotoPath: true, techSpecPhotoPaths: true },
    });
    const filename = getTechSpecPathAt(order, index);
    if (!filename) {
      throw new NotFoundException('ТЗ-фото не прикреплено');
    }
    const { buffer, contentType } = await this.storage.read(filename);
    res.setHeader('Content-Type', contentType);
    res.end(buffer);
  }

  /** Отправить заказ исполнителю-партнёру (push + ссылки на ТЗ-фото и стикер). */
  @Post(':idOrder/send-to-partner')
  async sendToPartner(@Param('idOrder') idOrder: string) {
    await this.outbound.sendOrder(idOrder);
    return this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      include: {
        items: true,
        tshirtItems: true,
        executor: { select: { id: true, username: true } },
      },
    });
  }
}
