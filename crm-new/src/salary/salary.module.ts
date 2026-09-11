import { Module } from '@nestjs/common';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { MetrikaOrdersModule } from 'src/metrika/orders/metrika-orders.module';

@Module({
  imports: [MetrikaOrdersModule],
  controllers: [SalaryController],
  providers: [SalaryService],
})
export class SalaryModule {}
