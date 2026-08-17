import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumRole } from 'src/generated/prisma/enums';
import {
  OzonPhotoStorageService,
  OZON_PHOTO_MAX_BYTES,
  OZON_PHOTO_MAX_FILES,
} from './ozon/ozon-photo-storage.service';

/**
 * Фотографии карточек Ozon.
 *
 * Загрузка — только администратору, а вот отдача файла **намеренно без
 * авторизации**: карточку наполняет не браузер продавца, а сам Ozon — он
 * приходит за картинкой по ссылке своим роботом и никаких наших токенов не
 * предъявит. Поэтому охранники висят на конкретном методе, а не на классе.
 *
 * Публичность ограничена узко: отдаётся только файл, имя которого совпадает
 * с маской `ozon-<uuid>.jpg` (проверка в хранилище), то есть перебрать или
 * вытащить что-то постороннее из каталога загрузок нельзя.
 */
@Controller('marketplace/ozon/photos')
export class OzonPhotoController {
  constructor(private readonly storage: OzonPhotoStorageService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(EnumRole.ADMIN)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: OZON_PHOTO_MAX_BYTES, files: OZON_PHOTO_MAX_FILES },
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Req() req: Request,
  ): Promise<{ urls: string[] }> {
    if (files.length === 0) throw new BadRequestException('Файл не передан');

    const origin = `${req.protocol}://${req.get('host') ?? ''}`;
    const urls: string[] = [];
    for (const file of files) {
      const filename = await this.storage.save(file);
      urls.push(this.storage.publicUrl(filename, origin));
    }
    return { urls };
  }

  /**
   * Отдача картинки. Кэш годовой и immutable: имя файла содержит uuid и
   * никогда не переиспользуется, а Ozon может запрашивать картинку не раз.
   */
  @Get(':filename')
  // Лимит выше общего: Ozon тянет по 14 картинок на карточку, а публикация
  // идёт пачками — общий потолок в 300 запросов на адрес он бы выбрал.
  @Throttle({ default: { limit: 2000, ttl: 60_000 } })
  async serve(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.storage.read(filename);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(buffer);
  }
}
