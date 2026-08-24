import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ImageCardTemplateService } from './image-card-template.service';
import { IMAGE_CARD_MAX_BYTES } from './image-card-storage.service';
import {
  DtoCreateImageCardTemplate,
  DtoUpdateImageCardTemplate,
} from './dto/image-card-template.dto';

/**
 * Шаблоны карточек Ozon.
 *
 * Роли берём существующие, новых не заводим: администратор и внешний
 * продавец, который наполняет свои карточки сам. Правка шаблона — за
 * администратором: сбитая область размещения тихо испортит все карточки,
 * собранные после неё.
 */
@Controller('marketplace/ozon/card-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImageCardTemplateController {
  constructor(private readonly templates: ImageCardTemplateService) {}

  @Get()
  @Roles(EnumRole.ADMIN, EnumRole.MARKETPLACE_CLIENT)
  list() {
    return this.templates.list();
  }

  /** Картинка шаблона — фон холста в админке и в редакторе карточек. */
  @Get(':id/image')
  @Roles(EnumRole.ADMIN, EnumRole.MARKETPLACE_CLIENT)
  async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.templates.readImage(id);
    res.setHeader('Content-Type', 'image/png');
    // Шаблоны меняются редко, а редактор дёргает их постоянно. Кэш приватный:
    // картинка доступна только вошедшему сотруднику.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buffer);
  }

  @Post()
  @Roles(EnumRole.ADMIN)
  create(@Body() dto: DtoCreateImageCardTemplate) {
    return this.templates.create(dto);
  }

  @Patch(':id')
  @Roles(EnumRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DtoUpdateImageCardTemplate,
  ) {
    return this.templates.update(id, dto);
  }

  @Post(':id/image')
  @Roles(EnumRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_CARD_MAX_BYTES } }),
  )
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.templates.uploadImage(id, file);
  }

  @Delete(':id')
  @Roles(EnumRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.remove(id);
  }
}
