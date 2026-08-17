import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonApiClient } from './ozon/ozon-api.client';
import { OzonService } from './ozon/ozon.service';

/**
 * Интеграции с маркетплейсами. Ozon — первая площадка; следующая добавляется
 * своим подкаталогом и значением EnumMarketplace, общий слой доступов
 * (MarketplaceAccountService) переиспользуется как есть.
 */
@Module({
  imports: [PrismaModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceAccountService, OzonApiClient, OzonService],
  exports: [MarketplaceAccountService, OzonApiClient, OzonService],
})
export class MarketplaceModule {}
