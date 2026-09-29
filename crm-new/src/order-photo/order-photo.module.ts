import { Module } from '@nestjs/common';
import { OrderPhotoService } from './order-photo.service';
import { ClientDraftService } from './client-draft.service';
import { ClientGreetingService } from './client-greeting.service';
import { OrderItemService } from './order-item.service';
import { TshirtItemService } from './tshirt-item.service';
import { CanvasItemService } from './canvas-item.service';
import { StickerModule } from './sticker.module';
import { OrderPhotoController } from './order-photo.controller';
import { LeadController } from './lead.controller';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import { GulianModule } from 'src/gulian/gulian.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { ReviewReminderService } from './review-reminder.service';
import { ShipmentReminderService } from './shipment-reminder.service';
import { DailyPlanService } from './daily-plan.service';
import { ShipmentLeadService } from './shipment-lead.service';
import { PartnerSettingsModule } from 'src/partner/partner-settings.module';
import { TshirtPartnerTelegramService } from './tshirt-partner-telegram.service';
import { SiteLeadTokenGuard } from './site-lead-token.guard';
import { PushModule } from 'src/push/push.module';
import { MetrikaOrdersModule } from 'src/metrika/orders/metrika-orders.module';

@Module({
  imports: [
    TelegramModule,
    StickerModule,
    PartnerSettingsModule,
    GulianModule,
    PushModule,
    MetrikaOrdersModule,
  ],
  controllers: [LeadController, OrderPhotoController],
  providers: [
    OrderPhotoService,
    ClientGreetingService,
    ClientDraftService,
    OrderItemService,
    TshirtItemService,
    CanvasItemService,
    OrderFinancialIntegrityService,
    ReviewReminderService,
    ShipmentReminderService,
    DailyPlanService,
    ShipmentLeadService,
    TshirtPartnerTelegramService,
    SiteLeadTokenGuard,
  ],
  // Заведение заказа из кабинета Ozon собирает заказ тем же методом, что
  // и оформление руками: второй ветки создания заказов быть не должно.
  exports: [OrderPhotoService],
})
export class OrderPhotoModule {}
