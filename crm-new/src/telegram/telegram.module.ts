import { Module } from '@nestjs/common';
import { GulianIntegrationModule } from 'src/gulian-integration/gulian-integration.module';
import { TshirtPartnerTelegramService } from 'src/order-photo/tshirt-partner-telegram.service';
import { StickerModule } from 'src/order-photo/sticker.module';
import { PartnerSettingsModule } from 'src/partner/partner-settings.module';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramStickerController } from './telegram-sticker.controller';
import { TelegramStickerLinkService } from './telegram-sticker-link.service';

@Module({
  imports: [StickerModule, PartnerSettingsModule, GulianIntegrationModule],
  controllers: [TelegramWebhookController, TelegramStickerController],
  providers: [
    TelegramService,
    TelegramStickerLinkService,
    TshirtPartnerTelegramService,
  ],
  exports: [
    TelegramService,
    TelegramStickerLinkService,
    TshirtPartnerTelegramService,
  ],
})
export class TelegramModule {}