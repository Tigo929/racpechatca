import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
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
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-request';
import { ImageCardBatchService } from './image-card-batch.service';
import { ImageCardGenerationService } from './image-card-generation.service';
import { PdfRasterService } from './pdf-raster.service';
import { IMAGE_CARD_MAX_BYTES } from './image-card-storage.service';
import { DtoCreateImageCardBatch } from './dto/image-card-batch.dto';
import { DtoUpdateImageCard } from './dto/image-card-update.dto';
import { DtoBulkCards } from './dto/image-card-bulk.dto';
// archiver 8 экспортирует классы, а не функцию: ZipArchive — то, что
// раньше вызывалось как archiver('zip').
import { ZipArchive } from 'archiver';
import { cleanBaseName } from './image-card-naming';

/**
 * Пачки генерации карточек Ozon.
 *
 * Права — существующие: администратор и внешний продавец, который наполняет
 * свои карточки сам. Новых ролей не заводим.
 */
@Controller('marketplace/ozon/card-batches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN, EnumRole.MARKETPLACE_CLIENT)
export class ImageCardBatchController {
  private readonly logger = new Logger(ImageCardBatchController.name);

  constructor(
    private readonly batches: ImageCardBatchService,
    private readonly generation: ImageCardGenerationService,
    private readonly pdf: PdfRasterService,
  ) {}

  /**
   * Готовность окружения. Фронт спрашивает это до загрузки, чтобы честно
   * сказать «PDF здесь не обработается», а не принять файл и молча уронить
   * его в ошибку.
   */
  @Get('capabilities')
  async capabilities() {
    return { pdf: await this.pdf.isAvailable() };
  }

  @Get()
  list() {
    return this.batches.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.batches.get(id);
  }

  @Post()
  create(
    @Body() dto: DtoCreateImageCardBatch,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.batches.create(dto, user?.id ?? null);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DtoCreateImageCardBatch,
  ) {
    return this.batches.updateSettings(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.batches.remove(id);
  }

  /** Один исходник на запрос: пачка целиком в лимит nginx не влезает. */
  @Post(':id/sources')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_CARD_MAX_BYTES } }),
  )
  addSource(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.batches.addSource(id, file);
  }

  /**
   * Поставить карточки в работу: пары «исходник × шаблон» по выбранному
   * режиму. Сама отрисовка идёт фоном — держать запрос открытым на сотне
   * композитов нельзя.
   */
  @Post(':id/generate')
  generate(@Param('id', ParseUUIDPipe) id: string) {
    return this.generation.generate(id);
  }

  /**
   * Кнопка «Сгенерировать финальные PNG».
   *
   * includeReview=true нужен, чтобы захватить карточки со статусом «требует
   * проверки»: без явного подтверждения они в готовое не уходят.
   */
  @Post(':id/finalize')
  finalizeBatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { includeReview?: boolean } = {},
  ) {
    return this.generation.finalize(id, body.includeReview === true);
  }

  /**
   * Готовые карточки одним архивом.
   *
   * Поток, а не файл в памяти: сотня PNG по паре мегабайт — это сотни
   * мегабайт, которые незачем держать в куче процесса целиком.
   */
  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { title, files } = await this.batches.listFinalFiles(id);
    if (files.length === 0) {
      throw new BadRequestException(
        'В пачке нет готовых карточек — сначала нажмите «Сгенерировать финальные PNG»',
      );
    }

    const name = `${cleanBaseName(title) || 'ozon-cards'}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );

    const archive = new ZipArchive({ zlib: { level: 6 } });
    // PNG уже сжат, поэтому уровень средний: выше только грел бы процессор.
    archive.on('error', (error) => {
      this.logger.error('Не удалось собрать архив', error);
      res.destroy(error);
    });
    archive.pipe(res);
    for (const file of files) {
      archive.file(file.fullPath, { name: file.entryName });
    }
    await archive.finalize();
  }

  /** Массовое действие над отмеченными карточками сетки. */
  @Post(':id/cards/bulk')
  bulkCards(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DtoBulkCards) {
    return this.generation.bulk(id, dto.ids, dto.action);
  }

  /** Карточки пачки — из них собирается сетка проверки. */
  @Get(':id/cards')
  cards(@Param('id', ParseUUIDPipe) id: string) {
    return this.batches.listCards(id);
  }

  @Get('cards/:cardId/preview')
  async preview(
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.batches.readPreview(cardId);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.end(buffer);
  }

  /** Шаблон, которым собрана карточка, — подложка ручного редактора. */
  @Get('cards/:cardId/template')
  async cardTemplate(
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.batches.readCardTemplate(cardId);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buffer);
  }

  /** Одобрить, пропустить, вернуть в работу либо подвинуть принт. */
  @Patch('cards/:cardId')
  updateCard(
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: DtoUpdateImageCard,
  ) {
    return this.generation.updateCard(cardId, dto);
  }

  /** Вернуть карточку к автоматическому размещению. */
  @Post('cards/:cardId/regenerate')
  regenerateCard(@Param('cardId', ParseUUIDPipe) cardId: string) {
    return this.generation.regenerateCard(cardId);
  }

  @Post('sources/:sourceId/retry')
  retrySource(@Param('sourceId', ParseUUIDPipe) sourceId: string) {
    return this.batches.retrySource(sourceId);
  }

  @Delete('sources/:sourceId')
  removeSource(@Param('sourceId', ParseUUIDPipe) sourceId: string) {
    return this.batches.removeSource(sourceId);
  }

  /** Растр исходника — превью того, что пойдёт на футболку. */
  @Get('sources/:sourceId/raster')
  async raster(
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.batches.readRaster(sourceId);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.end(buffer);
  }
}
