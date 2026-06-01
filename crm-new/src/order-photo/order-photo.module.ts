import { Module } from '@nestjs/common';
import { OrderPhotoService } from './order-photo.service';
import { OrderItemService } from './order-item.service';
import { TshirtItemService } from './tshirt-item.service';
import { OrderPhotoController } from './order-photo.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [OrderPhotoController],
  providers: [OrderPhotoService, OrderItemService, TshirtItemService, PrismaService],
})
export class OrderPhotoModule {}
