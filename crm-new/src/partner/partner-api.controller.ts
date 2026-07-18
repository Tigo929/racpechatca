import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnumProductCategory } from 'src/generated/prisma/enums';
import { StickerService } from 'src/order-photo/sticker.service';
import { PartnerTokenGuard } from './partner-token.guard';
import { TechSpecStorageService } from './tech-spec-storage.service';
import { buildPartnerOrderPayload } from './partner-payload';

/**
 * Публичный API для исполнителя-партнёра. Аутентификация — X-Partner-Token.
 * Партнёр забирает заказ (JSON), ТЗ-фото и стикер по ссылкам из вебхука.
 */
@Controller('partner/orders')
@UseGuards(PartnerTokenGuard)
export class PartnerApiController {
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sticker: StickerService,
    private readonly storage: TechSpecStorageService,
    config: ConfigService,
  ) {
    this.publicBaseUrl = config.get<string>('PUBLIC_BASE_URL') || '';
  }

  /** Полные производственные данные заказа (только футболки + чек). */
  @Get(':idOrder')
  async getOrder(@Param('idOrder') idOrder: string) {
    const order = await this.prisma.orderPhoto.findUnique({
      where: { id: idOrder },
      include: { tshirtItems: true },
    });
    if (!order || order.productCategory !== EnumProductCategory.TSHIRT) {
      throw new NotFoundException('Заказ не найден');
    }
    return buildPartnerOrderPayload(order, this.publicBaseUrl);
  }

  /** ТЗ-фото (согласованный макет). */
  @Get(':idOrder/techspec-photo')
  async getTechSpecPhoto(
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

  /** PDF-стикер заказа (58×40 мм). */
  @Get(':idOrder/sticker')
  async getSticker(
    @Param('idOrder') idOrder: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } =
      await this.sticker.generateTshirtSticker(idOrder);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(buffer);
  }
}
