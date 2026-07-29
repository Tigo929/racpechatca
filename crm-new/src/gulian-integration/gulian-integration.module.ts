import { Module } from '@nestjs/common';
import { PartnerSettingsModule } from 'src/partner/partner-settings.module';
import { GulianClient } from './gulian-client';
import { GulianOutboxService } from './gulian-outbox.service';
import { GulianWorkerService } from './gulian-worker.service';

@Module({
  imports: [PartnerSettingsModule],
  providers: [GulianClient, GulianOutboxService, GulianWorkerService],
  exports: [GulianClient, GulianOutboxService, GulianWorkerService],
})
export class GulianIntegrationModule {}