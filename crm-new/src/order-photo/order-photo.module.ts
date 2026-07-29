import { Module } from '@nestjs/common';
import { OrderPhotoService } from './order-photo.service';
import { OrderItemService } from './order-item.service';
import { TshirtItemService } from './tshirt-item.service';
import { StickerModule } from './sticker.module';
import { OrderPhotoController } from './order-photo.controller';
import { LeadController } from './lead.controller';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import { TelegramModule } from 'src/telegram/telegram.module';
import { ReviewReminderService } from './review-reminder.service';
import { DailyPlanService } from './daily-plan.service';
import { ShipmentLeadService } from './shipment-lead.service';
import { StatusSummaryService } from './status-summary.service';
import { PartnerSettingsModule } from 'src/partner/partner-settings.module';
import { GulianIntegrationModule } from 'src/gulian-integration/gulian-integration.module';

@Module({
  imports: [TelegramModule, StickerModule, PartnerSettingsModule, GulianIntegrationModule],
  controllers: [LeadController, OrderPhotoController],
  providers: [
    OrderPhotoService,
    OrderItemService,
    TshirtItemService,
    OrderFinancialIntegrityService,
    ReviewReminderService,
    DailyPlanService,
    ShipmentLeadService,
    StatusSummaryService,
  ],
})
export class OrderPhotoModule {}
