import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { OzonShipmentService } from './ozon-shipment.service';
import { OzonShipmentSyncService } from './ozon-shipment-sync.service';
import {
  DtoBulkLabels,
  DtoCreateShipment,
  DtoParcel,
  DtoSetDelivery,
} from './dto';

interface RequestUser {
  id: string;
  role: string;
}

/**
 * Доставка Ozon в карточке заказа. Под префиксом order-photo — он уже
 * проксируется nginx, отдельный префикс пришлось бы дописывать на сервере.
 */
@Controller('order-photo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
export class OzonShipmentController {
  constructor(
    private readonly shipments: OzonShipmentService,
    private readonly syncer: OzonShipmentSyncService,
  ) {}

  // Пачка — выше ':idOrder', иначе «bulk» прочитался бы как номер заказа.
  @Post('bulk/ozon-labels')
  async bulkLabels(@Body() dto: DtoBulkLabels, @Res() res: Response) {
    const { buffer, failed } = await this.shipments.labels(dto.ids);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="ozon-labels.pdf"');
    if (failed.length) {
      res.setHeader('X-Labels-Failed', encodeURIComponent(failed.join('\n')));
      res.setHeader('Access-Control-Expose-Headers', 'X-Labels-Failed');
    }
    res.send(buffer);
  }

  @Get(':idOrder/delivery')
  view(@Param('idOrder', ParseUUIDPipe) id: string) {
    return this.shipments.view(id);
  }

  @Patch(':idOrder/delivery')
  setDelivery(
    @Param('idOrder', ParseUUIDPipe) id: string,
    @Body() dto: DtoSetDelivery,
  ) {
    return this.shipments.setDelivery(id, {
      pickupPoint:
        dto.pickupPoint === undefined ? undefined : dto.pickupPoint || null,
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
    });
  }

  @Post(':idOrder/ozon/quote')
  quote(@Param('idOrder', ParseUUIDPipe) id: string, @Body() dto: DtoParcel) {
    return this.shipments.quote(id, dto);
  }

  @Post(':idOrder/ozon/shipment')
  create(
    @Param('idOrder', ParseUUIDPipe) id: string,
    @Body() dto: DtoCreateShipment,
    @CurrentUser() me: RequestUser,
  ) {
    return this.shipments.create(id, dto.parcel, me);
  }

  @Post(':idOrder/ozon/cancel')
  cancel(@Param('idOrder', ParseUUIDPipe) id: string) {
    return this.shipments.cancel(id);
  }

  @Post(':idOrder/ozon/sync')
  async sync(@Param('idOrder', ParseUUIDPipe) id: string) {
    await this.syncer.syncOne(id);
    return this.shipments.view(id);
  }

  @Get(':idOrder/ozon/label')
  async label(
    @Param('idOrder', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.shipments.label(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }
}
