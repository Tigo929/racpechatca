import { Module } from '@nestjs/common';
import { OrderPhotoService } from './order-photo.service';
import { OrderItemService } from './order-item.service';
import { TshirtItemService } from './tshirt-item.service';
import { StickerModule } from './sticker.module';
import { OrderPhotoController } from './order-photo.controller';
import { LeadController } from './lead.controller';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import { StockModule } from 'src/stock/stock.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { ReviewReminderService } from './review-reminder.service';
import { DailyPlanService } from './daily-plan.service';
import { PartnerSettingsModule } from 'src/partner/partner-settings.module';

@Module({
  imports: [StockModule, TelegramModule, StickerModule, PartnerSettingsModule],
  controllers: [LeadController, OrderPhotoController],
  providers: [
    OrderPhotoService,
    OrderItemService,
    TshirtItemService,
    OrderFinancialIntegrityService,
    ReviewReminderService,
    DailyPlanService,
  ],
})
export class OrderPhotoModule {}
