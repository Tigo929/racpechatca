import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { StripPricesInterceptor } from 'src/interceptors/strip-prices.interceptor';
import { OrderPhotoService } from './order-photo.service';
import { OrderItemService } from './order-item.service';
import { TshirtItemService } from './tshirt-item.service';
import DtoCreateOrder from './dto/create-order.dto';
import DtoAllOrdersforQuery from './dto/all-oreders-for-query.dto';
import UpdateStatus from './dto/update-status.dto';
import { DtoUpdateOrder } from './dto/update-order.dto';
import DtoUpdateItemOrder from './dto/update-item.dto';
import DtoCreateItemOrder from './dto/create-item-order.dto';
import { DtoCreateTshirtItem } from './dto/create-tshirt-item.dto';
import { DtoUpdateTshirtItem } from './dto/update-tshirt-item.dto';

@Controller('order-photo')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(StripPricesInterceptor)
export class OrderPhotoController {
  constructor(
    private readonly orderPhotoService: OrderPhotoService,
    private readonly orderItemService: OrderItemService,
    private readonly tshirtItemService: TshirtItemService,
  ) {}

  // ── Admin-only: create / update / delete order ─────────────────────────────

  @Post()
  @Roles(EnumRole.ADMIN)
  createOrder(@Body() dto: DtoCreateOrder) {
    return this.orderPhotoService.createOrder(dto);
  }

  @Patch(':idOrder')
  @Roles(EnumRole.ADMIN)
  updateOrder(@Param('idOrder') idOrder: string, @Body() dto: DtoUpdateOrder) {
    return this.orderPhotoService.updateOrder(idOrder, dto);
  }

  @Delete(':idOrder')
  @Roles(EnumRole.ADMIN)
  deleteOrder(@Param('idOrder') idOrder: string) {
    return this.orderPhotoService.deleteOrder(idOrder);
  }

  // ── Admin-only: add / update / delete items ────────────────────────────────

  @Post(':idOrder/items')
  @Roles(EnumRole.ADMIN)
  addItemToOrder(@Param('idOrder') idOrder: string, @Body() dto: DtoCreateItemOrder) {
    return this.orderItemService.addItemToOrder(idOrder, dto);
  }

  @Patch('items/:idItem')
  @Roles(EnumRole.ADMIN)
  updateItemOrder(@Param('idItem') idItem: string, @Body() dto: DtoUpdateItemOrder) {
    return this.orderItemService.updateItemOrder(idItem, dto);
  }

  @Delete('items/:idItem')
  @Roles(EnumRole.ADMIN)
  deleteItemOrder(@Param('idItem') idItem: string) {
    return this.orderItemService.deleteItemOrder(idItem);
  }

  @Post(':idOrder/tshirt-items')
  @Roles(EnumRole.ADMIN)
  addTshirtItem(@Param('idOrder') idOrder: string, @Body() dto: DtoCreateTshirtItem) {
    return this.tshirtItemService.addTshirtItem(idOrder, dto);
  }

  @Patch('tshirt-items/:idItem')
  @Roles(EnumRole.ADMIN)
  updateTshirtItem(@Param('idItem') idItem: string, @Body() dto: DtoUpdateTshirtItem) {
    return this.tshirtItemService.updateTshirtItem(idItem, dto);
  }

  @Delete('tshirt-items/:idItem')
  @Roles(EnumRole.ADMIN)
  deleteTshirtItem(@Param('idItem') idItem: string) {
    return this.tshirtItemService.deleteTshirtItem(idItem);
  }

  // ── Both roles: read orders + items, update status ─────────────────────────

  @Get()
  getAllOrders(@Query() query: DtoAllOrdersforQuery) {
    return this.orderPhotoService.getAllOrders(query);
  }

  // Зарплата — только администратор. Объявлено до ':idOrder', чтобы маршрут не перехватился.
  @Get('salary/summary')
  @Roles(EnumRole.ADMIN)
  getSalarySummary() {
    return this.orderPhotoService.getSalarySummary();
  }

  @Get('items/:idItem')
  getItemById(@Param('idItem') idItem: string) {
    return this.orderItemService.getItemById(idItem);
  }

  @Get('tshirt-items/:idItem')
  getTshirtItem(@Param('idItem') idItem: string) {
    return this.tshirtItemService.getTshirtItem(idItem);
  }

  @Get(':idOrder')
  getOrderById(@Param('idOrder') idOrder: string) {
    return this.orderPhotoService.getOrderById(idOrder);
  }

  @Patch(':idOrder/status')
  updateStatusOrder(@Param('idOrder') idOrder: string, @Body() dto: UpdateStatus) {
    return this.orderPhotoService.updateStatusOrder(idOrder, dto);
  }
}
