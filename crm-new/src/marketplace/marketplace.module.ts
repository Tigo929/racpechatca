import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceAccountService } from './marketplace-account.service';
import { MarketplaceAccessGuard } from './marketplace-access.guard';
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
import { OzonOrdersController } from './ozon-orders.controller';
import { OzonOrdersService } from './ozon/ozon-orders.service';
import { OzonProductCatalogController } from './ozon-product-catalog.controller';
import { OzonProductCatalogService } from './ozon/ozon-product-catalog.service';
import { OzonUnitEconomicsService } from './ozon-unit-economics.service';
import { OzonWarehouseService } from './ozon/ozon-warehouse.service';

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
    OzonOrdersController,
    OzonProductCatalogController,
    OzonCatalogController,
  ],
  providers: [
    MarketplaceAccessGuard,
    MarketplaceAccountService,
    OzonApiClient,
    OzonService,
    OzonCatalogService,
    OzonCatalogTemplateService,
    OzonPrintService,
    OzonImportService,
    OzonImportPollService,
    OzonPhotoStorageService,
    OzonOrdersService,
    OzonProductCatalogService,
    OzonUnitEconomicsService,
    OzonWarehouseService,
  ],
  exports: [
    MarketplaceAccountService,
    OzonApiClient,
    OzonService,
    OzonWarehouseService,
  ],
})
export class MarketplaceModule {}
