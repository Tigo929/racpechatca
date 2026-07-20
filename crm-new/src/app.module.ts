import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { OrderPhotoModule } from './order-photo/order-photo.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SalaryModule } from './salary/salary.module';
import { ReportsModule } from './reports/reports.module';
import { ExpensesModule } from './expenses/expenses.module';
import { StockModule } from './stock/stock.module';
import { PartnerModule } from './partner/partner.module';
import { TasksModule } from './tasks/tasks.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // 5 запросов на /lead с одного IP за 60 секунд
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    AuthModule,
    UsersModule,
    OrderPhotoModule,
    SalaryModule,
    ReportsModule,
    ExpensesModule,
    StockModule,
    PartnerModule,
    TasksModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
