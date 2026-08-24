import { Module } from '@nestjs/common';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { ApprovalRenderService } from './approval-render.service';
import { ApprovalStorageService } from './approval-storage.service';
import { MockupController } from './mockup.controller';
import { MockupService } from './mockup.service';

/**
 * Согласование печати: подготовка макета футболки для клиента.
 *
 * Модуль самостоятельный — из остальной CRM ему нужен только заказ (номер и
 * связь), поэтому подключается одной строкой в AppModule и ничего не ломает,
 * если его выключить.
 */
@Module({
  controllers: [ApprovalController, MockupController],
  providers: [
    ApprovalService,
    ApprovalRenderService,
    ApprovalStorageService,
    MockupService,
  ],
})
export class ApprovalModule {}
