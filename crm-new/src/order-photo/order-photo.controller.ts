import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { EnumRole } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { StripPricesInterceptor } from 'src/interceptors/strip-prices.interceptor';
import { OrderPhotoService } from './order-photo.service';
import { OrderItemService } from './order-item.service';
import { TshirtItemService } from './tshirt-item.service';
import { StickerService } from './sticker.service';
import DtoCreateOrder from './dto/create-order.dto';
import DtoAllOrdersforQuery from './dto/all-oreders-for-query.dto';
import UpdateStatus from './dto/update-status.dto';
import { DtoUpdateOrder } from './dto/update-order.dto';
import DtoUpdateItemOrder from './dto/update-item.dto';
import DtoCreateItemOrder from './dto/create-item-order.dto';
import { DtoCreateTshirtItem } from './dto/create-tshirt-item.dto';
import { DtoUpdateTshirtItem } from './dto/update-tshirt-item.dto';
import { DtoAssignExecutor } from './dto/assign-executor.dto';
import { DtoSetReview } from './dto/set-review.dto';

interface RequestUser {
  id: string;
  username: string;
  role: string;
}

@Controller('order-photo')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(StripPricesInterceptor)
export class OrderPhotoController {
  constructor(
    private readonly orderPhotoService: OrderPhotoService,
    private readonly orderItemService: OrderItemService,
    private readonly tshirtItemService: TshirtItemService,
    private readonly stickerService: StickerService,
  ) {}

  // ── Admin-only: create / update / delete order ─────────────────────────────

  @Post()
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  createOrder(@Body() dto: DtoCreateOrder, @CurrentUser() me: RequestUser) {
    return this.orderPhotoService.createOrder(dto, me.id);
  }

  @Patch(':idOrder')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  updateOrder(@Param('idOrder') idOrder: string, @Body() dto: DtoUpdateOrder) {
    return this.orderPhotoService.updateOrder(idOrder, dto);
  }

  @Delete(':idOrder')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  deleteOrder(@Param('idOrder') idOrder: string) {
    return this.orderPhotoService.deleteOrder(idOrder);
  }

  // ── Admin-only: assign executor ────────────────────────────────────────────

  @Patch(':idOrder/assign')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  assignExecutor(
    @Param('idOrder') idOrder: string,
    @Body() dto: DtoAssignExecutor,
    @CurrentUser() me: RequestUser,
  ) {
    return this.orderPhotoService.assignExecutor(idOrder, dto, me.id);
  }

  // ── Admin-only: PDF-стикер заказа-футболки (58×40 мм) ───────────────────────

  @Get(':idOrder/sticker')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  async getSticker(
    @Param('idOrder') idOrder: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } =
      await this.stickerService.generateTshirtSticker(idOrder);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(buffer);
  }

  // ── Обе роли: клиентский PDF-стикер на пакет (58×40 мм) ─────────────────────
  // Печатают и админ, и исполнитель — исполнителю доступен только свой заказ.

  @Get(':idOrder/client-sticker')
  async getClientSticker(
    @Param('idOrder') idOrder: string,
    @CurrentUser() me: RequestUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } =
      await this.stickerService.generateClientSticker(idOrder, me.id, me.role);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(buffer);
  }

  // ── Admin-only: отметка отзыва клиента ──────────────────────────────────────

  @Patch(':idOrder/review')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  setReview(@Param('idOrder') idOrder: string, @Body() dto: DtoSetReview) {
    return this.orderPhotoService.setReviewLeft(idOrder, dto.reviewLeft);
  }

  // ── Admin-only: add / update / delete items ────────────────────────────────

  @Post(':idOrder/items')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  addItemToOrder(
    @Param('idOrder') idOrder: string,
    @Body() dto: DtoCreateItemOrder,
  ) {
    return this.orderItemService.addItemToOrder(idOrder, dto);
  }

  @Patch('items/:idItem')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  updateItemOrder(
    @Param('idItem') idItem: string,
    @Body() dto: DtoUpdateItemOrder,
  ) {
    return this.orderItemService.updateItemOrder(idItem, dto);
  }

  @Delete('items/:idItem')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  deleteItemOrder(@Param('idItem') idItem: string) {
    return this.orderItemService.deleteItemOrder(idItem);
  }

  @Post(':idOrder/tshirt-items')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  addTshirtItem(
    @Param('idOrder') idOrder: string,
    @Body() dto: DtoCreateTshirtItem,
  ) {
    return this.tshirtItemService.addTshirtItem(idOrder, dto);
  }

  @Patch('tshirt-items/:idItem')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  updateTshirtItem(
    @Param('idItem') idItem: string,
    @Body() dto: DtoUpdateTshirtItem,
  ) {
    return this.tshirtItemService.updateTshirtItem(idItem, dto);
  }

  @Delete('tshirt-items/:idItem')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  deleteTshirtItem(@Param('idItem') idItem: string) {
    return this.tshirtItemService.deleteTshirtItem(idItem);
  }

  // ── Both roles: read orders + items, update status ─────────────────────────

  @Get()
  getAllOrders(
    @Query() query: DtoAllOrdersforQuery,
    @CurrentUser() me: RequestUser,
  ) {
    return this.orderPhotoService.getAllOrders(query, me.id, me.role);
  }

  @Get('stats')
  getOrderStats(
    @Query() query: DtoAllOrdersforQuery,
    @CurrentUser() me: RequestUser,
  ) {
    return this.orderPhotoService.getOrderStats(query, me.id, me.role);
  }

  @Get('items/:idItem')
  getItemById(@Param('idItem') idItem: string, @CurrentUser() me: RequestUser) {
    return this.orderItemService.getItemById(idItem, me.id, me.role);
  }

  @Get('tshirt-items/:idItem')
  getTshirtItem(
    @Param('idItem') idItem: string,
    @CurrentUser() me: RequestUser,
  ) {
    return this.tshirtItemService.getTshirtItem(idItem, me.id, me.role);
  }

  @Get(':idOrder')
  getOrderById(
    @Param('idOrder') idOrder: string,
    @CurrentUser() me: RequestUser,
  ) {
    return this.orderPhotoService.getOrderById(idOrder, me.id, me.role);
  }

  @Patch(':idOrder/status')
  updateStatusOrder(
    @Param('idOrder') idOrder: string,
    @Body() dto: UpdateStatus,
    @CurrentUser() me: RequestUser,
  ) {
    return this.orderPhotoService.updateStatusOrder(
      idOrder,
      dto,
      me.id,
      me.role,
    );
  }
}
