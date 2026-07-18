import { Module } from '@nestjs/common';
import { StickerModule } from 'src/order-photo/sticker.module';
import { TechSpecStorageService } from './tech-spec-storage.service';
import { PartnerOutboundService } from './partner-outbound.service';
import { PartnerTokenGuard } from './partner-token.guard';
import { PartnerApiController } from './partner-api.controller';
import { PartnerAdminController } from './partner-admin.controller';

@Module({
  imports: [StickerModule],
  controllers: [PartnerApiController, PartnerAdminController],
  providers: [
    TechSpecStorageService,
    PartnerOutboundService,
    PartnerTokenGuard,
  ],
})
export class PartnerModule {}
