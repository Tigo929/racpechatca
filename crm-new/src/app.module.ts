import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderPhotoModule } from './order-photo/order-photo.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SalaryModule } from './salary/salary.module';
import { ReportsModule } from './reports/reports.module';
import { ExpensesModule } from './expenses/expenses.module';
import { StockModule } from './stock/stock.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    OrderPhotoModule,
    SalaryModule,
    ReportsModule,
    ExpensesModule,
    StockModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
