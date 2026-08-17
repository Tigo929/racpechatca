import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonApiClient } from './ozon/ozon-api.client';
import { OzonService } from './ozon/ozon.service';
import { OzonCatalogService } from './ozon/ozon-catalog.service';
import { OzonCatalogTemplateService } from './ozon-catalog-template.service';
import { OzonPrintService } from './ozon-print.service';
import { OzonImportService } from './ozon-import.service';
import { OzonImportPollService } from './ozon-import-poll.service';
import { OzonCatalogController } from './ozon-catalog.controller';
import { OzonPhotoController } from './ozon-photo.controller';
import { OzonPhotoStorageService } from './ozon/ozon-photo-storage.service';

/**
 * Интеграции с маркетплейсами. Ozon — первая площадка; следующая добавляется
 * своим подкаталогом и значением EnumMarketplace, общий слой доступов
 * (MarketplaceAccountService) переиспользуется как есть.
 */
@Module({
  imports: [PrismaModule],
  // OzonPhotoController раньше OzonCatalogController: его путь
  // marketplace/ozon/photos/:file не должен попасть под :accountId-маршруты.
  controllers: [
    MarketplaceController,
    OzonPhotoController,
    OzonCatalogController,
  ],
  providers: [
    MarketplaceAccountService,
    OzonApiClient,
    OzonService,
    OzonCatalogService,
    OzonCatalogTemplateService,
    OzonPrintService,
    OzonImportService,
    OzonImportPollService,
    OzonPhotoStorageService,
  ],
  exports: [MarketplaceAccountService, OzonApiClient, OzonService],
})
export class MarketplaceModule {}
