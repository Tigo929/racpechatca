import { Module } from '@nestjs/common';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/**
 * Web Push. PushService экспортируем — им пользуется order-photo при создании
 * заявки, чтобы разослать уведомление подписанным браузерам.
 */
@Module({
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
