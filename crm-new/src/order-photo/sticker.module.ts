import { Module } from '@nestjs/common';
import { StickerService } from './sticker.service';

// Стикер нужен и админ-контроллеру заказов, и партнёрскому API — выносим
// в отдельный модуль, чтобы переиспользовать без дублирования провайдера.
@Module({
  providers: [StickerService],
  exports: [StickerService],
})
export class StickerModule {}
