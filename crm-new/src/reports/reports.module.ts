import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  // Аналитика (этап 08) берёт P&L отсюда же — второй формулы прибыли нет.
  exports: [ReportsService],
})
export class ReportsModule {}
