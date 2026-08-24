import { Module } from '@nestjs/common';
import { ImageCardTemplateController } from './image-card-template.controller';
import { ImageCardTemplateService } from './image-card-template.service';
import { ImageCardBatchController } from './image-card-batch.controller';
import { ImageCardBatchService } from './image-card-batch.service';
import { ImageCardProcessorService } from './image-card-processor.service';
import { ImageCardStorageService } from './image-card-storage.service';
import { PdfRasterService } from './pdf-raster.service';
import { ImageCardRenderService } from './image-card-render.service';
import { ImageCardGenerationService } from './image-card-generation.service';

/**
 * Генератор главных фото карточек Ozon.
 *
 * Живёт внутри раздела маркетплейсов, но отдельным модулем: у него своя
 * математика размещения, своё хранилище и свой жизненный цикл пачки, и
 * мешать это с синхронизацией каталога незачем.
 */
@Module({
  controllers: [ImageCardTemplateController, ImageCardBatchController],
  providers: [
    ImageCardTemplateService,
    ImageCardBatchService,
    ImageCardProcessorService,
    ImageCardStorageService,
    PdfRasterService,
    ImageCardRenderService,
    ImageCardGenerationService,
  ],
  exports: [ImageCardStorageService],
})
export class ImageCardsModule {}
