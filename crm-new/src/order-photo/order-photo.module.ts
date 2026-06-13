import { Module } from '@nestjs/common';
import { OrderPhotoService } from './order-photo.service';
import { OrderItemService } from './order-item.service';
import { TshirtItemService } from './tshirt-item.service';
import { OrderPhotoController } from './order-photo.controller';
import { LeadController } from './lead.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderFinancialIntegrityService } from './order-financial-integrity.service';

@Module({
  controllers: [LeadController, OrderPhotoController],
  providers: [
    OrderPhotoService,
    OrderItemService,
    TshirtItemService,
    OrderFinancialIntegrityService,
    PrismaService,
  ],
})
export class OrderPhotoModule {}
