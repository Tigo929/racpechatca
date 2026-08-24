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
import { MockupService } from './mockup.service';
import { APPROVAL_MAX_BYTES } from './approval-storage.service';
import {
  DtoCreateMockupTemplate,
  DtoUpdateMockupTemplate,
} from './dto/mockup-template.dto';

/**
 * Шаблоны мокапов. Читать их нужно всем, кто делает согласования, а менять —
 * только администратору: калибровка задаёт связь сантиметров с пикселями, и
 * сбитая рамка тихо испортит все последующие макеты.
 */
@Controller('mockup-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MockupController {
  constructor(private readonly mockups: MockupService) {}

  @Get()
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  list() {
    return this.mockups.list();
  }

  /** Фотография шаблона. Отдаём потоком: в редакторе она — фон холста. */
  @Get(':id/image')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.mockups.readImage(id);
    res.setHeader('Content-Type', 'image/webp');
    // Фотографии мокапов меняются редко, а редактор дёргает их постоянно.
    // Кэш приватный: снимок доступен только вошедшему сотруднику.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buffer);
  }

  @Post()
  @Roles(EnumRole.ADMIN)
  create(@Body() dto: DtoCreateMockupTemplate) {
    return this.mockups.create(dto);
  }

  @Patch(':id')
  @Roles(EnumRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DtoUpdateMockupTemplate,
  ) {
    return this.mockups.update(id, dto);
  }

  @Post(':id/image')
  @Roles(EnumRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: APPROVAL_MAX_BYTES } }),
  )
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.mockups.uploadImage(id, file);
  }

  @Delete(':id')
  @Roles(EnumRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.mockups.remove(id);
  }
}
