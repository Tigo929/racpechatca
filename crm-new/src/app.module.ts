import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderPhotoModule } from './order-photo/order-photo.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SalaryModule } from './salary/salary.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    OrderPhotoModule,
    SalaryModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
