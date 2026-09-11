import { Module } from '@nestjs/common';
import { StickerModule } from 'src/order-photo/sticker.module';
import { TechSpecStorageService } from './tech-spec-storage.service';
import { PartnerOutboundService } from './partner-outbound.service';
import { PartnerStatusPollService } from './partner-status-poll.service';
import { PartnerTokenGuard } from './partner-token.guard';
import { PartnerApiController } from './partner-api.controller';
import { PartnerAdminController } from './partner-admin.controller';
import { PartnerSettingsModule } from './partner-settings.module';
import { MetrikaOrdersModule } from 'src/metrika/orders/metrika-orders.module';

@Module({
  imports: [StickerModule, PartnerSettingsModule, MetrikaOrdersModule],
  controllers: [PartnerApiController, PartnerAdminController],
  providers: [
    TechSpecStorageService,
    PartnerOutboundService,
    PartnerStatusPollService,
    PartnerTokenGuard,
  ],
})
export class PartnerModule {}
