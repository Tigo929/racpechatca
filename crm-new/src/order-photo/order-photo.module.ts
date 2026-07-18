import { Module } from '@nestjs/common';
import { OrderPhotoService } from './order-photo.service';
import { OrderItemService } from './order-item.service';
import { TshirtItemService } from './tshirt-item.service';
import { StickerService } from './sticker.service';
import { OrderPhotoController } from './order-photo.controller';
import { LeadController } from './lead.controller';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';
import { StockModule } from 'src/stock/stock.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { CoolabcModule } from 'src/integrations/coolabc.module';
import { ReviewReminderService } from './review-reminder.service';

@Module({
  imports: [StockModule, TelegramModule, CoolabcModule],
  controllers: [LeadController, OrderPhotoController],
  providers: [
    OrderPhotoService,
    OrderItemService,
    TshirtItemService,
    StickerService,
    OrderFinancialIntegrityService,
    ReviewReminderService,
  ],
})
export class OrderPhotoModule {}
