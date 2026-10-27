import { Module } from '@nestjs/common';
import { MarketplaceModule } from 'src/marketplace/marketplace.module';
import { ApprovalDeliveryController } from './approval-delivery.controller';
import { ApprovalDeliveryService } from './approval-delivery.service';
import { ApprovalOzonChatService } from './approval-ozon-chat.service';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ApprovalRenderService } from './approval-render.service';
import { ApprovalStorageService } from './approval-storage.service';
import { MockupController } from './mockup.controller';
import { MockupService } from './mockup.service';
import { PdfRasterService } from 'src/marketplace/image-cards/pdf-raster.service';

/**
 * Согласование печати: подготовка макета футболки для клиента.
 *
 * Модуль самостоятельный — из остальной CRM ему нужен только заказ (номер и
 * связь), поэтому подключается одной строкой в AppModule и ничего не ломает,
 * если его выключить.
 */
@Module({
  // Доступы кабинета и клиент Ozon — чтобы писать покупателю в чат
  // площадки. Обратной зависимости нет: маркетплейсы о согласованиях
  // ничего не знают.
  imports: [MarketplaceModule],
  controllers: [
    ApprovalController,
    MockupController,
    ApprovalDeliveryController,
  ],
  providers: [
    ApprovalDeliveryService,
    ApprovalOzonChatService,
    ApprovalService,
    ApprovalRenderService,
    ApprovalStorageService,
    MockupService,
    // Растеризация PDF-макетов: тот же сервис, что у карточек Ozon.
    // Он без состояния, поэтому второй экземпляр ничего не стоит.
    PdfRasterService,
  ],
})
export class ApprovalModule {}
