import { Module } from '@nestjs/common';
import { GulianService } from './gulian.service';
import { GulianOutboxService } from './gulian-outbox.service';
import { GulianOutboxProcessorService } from './gulian-outbox-processor.service';

@Module({
  providers: [GulianService, GulianOutboxService, GulianOutboxProcessorService],
  exports: [GulianService, GulianOutboxService],
})
export class GulianModule {}