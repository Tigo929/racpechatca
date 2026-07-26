import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { StickerService } from 'src/order-photo/sticker.service';
import { TelegramStickerLinkService } from './telegram-sticker-link.service';

@Controller('telegram/tshirt-orders')
export class TelegramStickerController {
  constructor(
    private readonly stickerService: StickerService,
    private readonly stickerLinks: TelegramStickerLinkService,
  ) {}

  @Get(':idOrder/sticker.pdf')
  async getSticker(
    @Param('idOrder') idOrder: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.stickerLinks.isValid(idOrder, token ?? '')) {
      throw new ForbiddenException('Недействительная ссылка на стикер');
    }

    const { buffer, filename } =
      await this.stickerService.generateTshirtSticker(idOrder);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buffer);
  }
}
