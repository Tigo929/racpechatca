import { Module } from '@nestjs/common';
import { CanvasPricingController } from './canvas-pricing.controller';
import { CanvasProductionController } from './canvas-production.controller';
import { PartnerSettingsModule } from 'src/partner/partner-settings.module';

/**
 * Холст: публичный прайс для сайта и закрытый прайс производства для расчёта
 * себестоимости внутри CRM. Второй под ролью ADMIN — это условия договора.
 */
@Module({
  imports: [PartnerSettingsModule],
  controllers: [CanvasPricingController, CanvasProductionController],
})
export class CanvasModule {}
