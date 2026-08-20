import { Module } from '@nestjs/common';
import { CanvasPricingController } from './canvas-pricing.controller';

/** Публичная часть холста: прайс для сайта. */
@Module({
  controllers: [CanvasPricingController],
})
export class CanvasModule {}
