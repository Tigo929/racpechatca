import { Module } from '@nestjs/common';
import { StickerModule } from 'src/order-photo/sticker.module';
import { TelegramService } from './telegram.service';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramStickerController } from './telegram-sticker.controller';
import { TelegramStickerLinkService } from './telegram-sticker-link.service';
import { TelegramUpdateService } from './telegram-update.service';
import { TelegramPollingService } from './telegram-polling.service';

@Module({
  imports: [StickerModule],
  controllers: [TelegramWebhookController, TelegramStickerController],
  providers: [
    TelegramService,
    TelegramStickerLinkService,
    TelegramUpdateService,
    TelegramPollingService,
  ],
  exports: [TelegramService, TelegramStickerLinkService],
})
export class TelegramModule {}
