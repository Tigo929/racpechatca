import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  TechSpecStorageService,
  TECH_SPEC_MAX_BYTES,
} from './tech-spec-storage.service';
import { PartnerOutboundService } from './partner-outbound.service';

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
    FileInterceptor('file', { limits: { fileSize: TECH_SPEC_MAX_BYTES } }),
  )
  async uploadTechSpecPhoto(
    @Param('idOrder') idOrder: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const filename = await this.storage.save(idOrder, file);
    return this.prisma.orderPhoto.update({
      where: { id: idOrder },
      data: { techSpecPhotoPath: filename },
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
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      select: { techSpecPhotoPath: true },
    });
    if (!order?.techSpecPhotoPath) {
      throw new NotFoundException('ТЗ-фото не прикреплено');
    }
    const { buffer, contentType } = await this.storage.read(
      order.techSpecPhotoPath,
    );
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
