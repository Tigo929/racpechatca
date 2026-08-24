import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { OrderPhotoModule } from './order-photo/order-photo.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SalaryModule } from './salary/salary.module';
import { ReportsModule } from './reports/reports.module';
import { ExpensesModule } from './expenses/expenses.module';
import { PartnerModule } from './partner/partner.module';
import { PartnerSettingsModule } from './partner/partner-settings.module';
import { TasksModule } from './tasks/tasks.module';
import { ScenarioModule } from './scenarios/scenario.module';
import { AvitoModule } from './avito/avito.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { GulianModule } from './gulian/gulian.module';
import { PrismaModule } from './prisma/prisma.module';
import { CanvasModule } from './canvas/canvas.module';
import { ApprovalModule } from './approval/approval.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    /**
     * Общий потолок на адрес. Раньше стояло 5 запросов в минуту, но охранник
     * висел только на приёме заявок — остальное, включая вход по паролю, не
     * ограничивалось ничем. Теперь охранник глобальный, поэтому потолок
     * поднят до рабочего: страница заказов тянет несколько запросов сразу.
     * Строгие лимиты задаются точечно через @Throttle (вход, приём заявок).
     */
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    AuthModule,
    UsersModule,
    OrderPhotoModule,
    SalaryModule,
    ReportsModule,
    ExpensesModule,
    PartnerModule,
    PartnerSettingsModule,
    TasksModule,
    AvitoModule,
    MarketplaceModule,
    ScenarioModule,
    GulianModule,
    CanvasModule,
    ApprovalModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
