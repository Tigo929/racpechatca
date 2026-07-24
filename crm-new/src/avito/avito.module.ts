import { Module } from '@nestjs/common';
import { AvitoService } from './avito.service';
import { AvitoController } from './avito.controller';
import { AvitoMessengerService } from './avito-messenger.service';

/**
 * Интеграция с Avito. Пока это только клиент API (токен + чтение профиля и
 * отзывов). Сервис экспортируем: дальше на него сядут сценарии — подтягивание
 * обращений из мессенджера и автоотметка «клиент оставил отзыв».
 */
@Module({
  controllers: [AvitoController],
  providers: [AvitoService, AvitoMessengerService],
  exports: [AvitoService, AvitoMessengerService],
})
export class AvitoModule {}
