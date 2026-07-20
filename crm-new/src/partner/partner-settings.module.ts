import { Module } from '@nestjs/common';
import { PartnerSettingsService } from './partner-settings.service';
import { PartnerSettingsController } from './partner-settings.controller';

/**
 * Настройки расчёта с партнёром вынесены в отдельный модуль: сервис нужен и
 * партнёрскому модулю, и заказам (побочный эффект на «Оплачен»), а держать
 * его здесь позволяет обойтись без циклической зависимости между модулями.
 */
@Module({
  controllers: [PartnerSettingsController],
  providers: [PartnerSettingsService],
  exports: [PartnerSettingsService],
})
export class PartnerSettingsModule {}
