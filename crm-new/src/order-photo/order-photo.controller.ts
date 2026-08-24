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
import { CanvasItemService } from './canvas-item.service';
import { StickerService } from './sticker.service';
import { DailyPlanService } from './daily-plan.service';
import { ReviewReminderService } from './review-reminder.service';
import { ShipmentLeadService } from './shipment-lead.service';
import { DtoSetShipmentLead } from './dto/set-shipment-lead.dto';
import { TshirtPartnerTelegramService } from './tshirt-partner-telegram.service';
import DtoCreateOrder from './dto/create-order.dto';
import DtoAllOrdersforQuery from './dto/all-oreders-for-query.dto';
import UpdateStatus from './dto/update-status.dto';
import { DtoUpdateOrder } from './dto/update-order.dto';
import DtoUpdateItemOrder from './dto/update-item.dto';
import DtoCreateItemOrder from './dto/create-item-order.dto';
import { DtoCreateTshirtItem } from './dto/create-tshirt-item.dto';
import { DtoUpdateTshirtItem } from './dto/update-tshirt-item.dto';
import { DtoCreateCanvasItem } from './dto/create-canvas-item.dto';
import { DtoUpdateCanvasItem } from './dto/update-canvas-item.dto';
import { DtoAssignExecutor } from './dto/assign-executor.dto';
import { DtoSetReview } from './dto/set-review.dto';

interface RequestUser {
  id: string;
  username: string;
  role: string;
}

/*
 * Роли на классе — «по умолчанию только сотрудники».
 *
 * RolesGuard пропускает всех, когда список ролей не задан. Пока каждый
 * вошедший был сотрудником, часть маршрутов и жила без своего @Roles: сервисы
 * фильтруют по роли внутри. С появлением внешних продавцов (клиентов сервиса,
 * а не сотрудников) это перестало быть безопасным — они получили бы и чтение
 * заказов, и смену статуса.
 *
 * Метод со своим @Roles сужает список дальше: getAllAndOverride берёт значение
 * с метода, если оно есть, и только иначе — с класса.
 */
@Controller('order-photo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN, EnumRole.EXECUTOR, EnumRole.ORDER_MANAGER)
@UseInterceptors(StripPricesInterceptor)
export class OrderPhotoController {
  constructor(
    private readonly orderPhotoService: OrderPhotoService,
    private readonly orderItemService: OrderItemService,
    private readonly tshirtItemService: TshirtItemService,
    private readonly canvasItemService: CanvasItemService,
    private readonly stickerService: StickerService,
    private readonly dailyPlanService: DailyPlanService,
    private readonly reviewReminderService: ReviewReminderService,
    private readonly tshirtPartnerTelegram: TshirtPartnerTelegramService,
    private readonly shipmentLeadService: ShipmentLeadService,
  ) {}

  // ── Admin: отправить «план дня» в рабочий чат прямо сейчас ──────────────────
  // Плановая рассылка идёт автоматически в 10:00 по Москве; этот эндпоинт — для
  // ручной отправки/проверки.
  @Post('daily-plan/run')
  @Roles(EnumRole.ADMIN)
  runDailyPlan(@Query('dry') dry?: string) {
    return this.dailyPlanService.runNow(new Date(), { dryRun: dry === 'true' });
  }

  // ── Admin: разовая пересылка напоминаний по всем заказам без отзыва ────────
  // Только ручной вызов (планировщик её не трогает) — нужна для проверки вида
  // сообщения и работы кнопки. Заказы при этом не меняются.
  // ?limit=N — сколько взять (без него все), ?dry=true — только посчитать.
  @Post('review-reminders/resend-all')
  @Roles(EnumRole.ADMIN)
  resendReviewReminders(
    @Query('limit') limit?: string,
    @Query('dry') dry?: string,
  ) {
    const parsed = Number(limit);
    return this.reviewReminderService.resendAllWithoutReview({
      limit: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
      dryRun: dry === 'true',
    });
  }

  // ── Admin: «старший дня» по отгрузкам (кого тегать в плане дня) ─────────────
  // Двухсегментные пути — не конфликтуют с одиночным параметром `:idOrder`.
  @Get('daily-plan/shipment-lead')
  @Roles(EnumRole.ADMIN)
  getShipmentLead() {
    return this.shipmentLeadService.get();
  }

  @Patch('daily-plan/shipment-lead')
  @Roles(EnumRole.ADMIN)
  setShipmentLead(@Body() dto: DtoSetShipmentLead) {
    return this.shipmentLeadService.set(dto.userId ?? null);
  }

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

  @Post(':idOrder/canvas-items')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  addCanvasItem(
    @Param('idOrder') idOrder: string,
    @Body() dto: DtoCreateCanvasItem,
  ) {
    return this.canvasItemService.addCanvasItem(idOrder, dto);
  }

  @Patch('canvas-items/:idItem')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  updateCanvasItem(
    @Param('idItem') idItem: string,
    @Body() dto: DtoUpdateCanvasItem,
  ) {
    return this.canvasItemService.updateCanvasItem(idItem, dto);
  }

  @Delete('canvas-items/:idItem')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  deleteCanvasItem(@Param('idItem') idItem: string) {
    return this.canvasItemService.deleteCanvasItem(idItem);
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

  /**
   * Загрузка по исполнителям для отбора в списке заказов.
   *
   * Исполнителю не отдаём: это сводка по всей команде, а он видит только свои
   * заказы. Отдельный эндпоинт, а не список пользователей, потому что /users
   * доступен только администратору, а отбор нужен и менеджеру по оформлению.
   */
  @Get('executor-workload')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  getExecutorWorkload(@Query() query: DtoAllOrdersforQuery) {
    return this.orderPhotoService.getExecutorWorkload(query);
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

  @Get('canvas-items/:idItem')
  getCanvasItem(
    @Param('idItem') idItem: string,
    @CurrentUser() me: RequestUser,
  ) {
    return this.canvasItemService.getCanvasItem(idItem, me.id, me.role);
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

  @Post(':idOrder/send-tshirt-telegram')
  @Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
  sendTshirtTelegram(
    @Param('idOrder') idOrder: string,
    @CurrentUser() me: RequestUser,
  ) {
    return this.orderPhotoService.dispatchTshirtToPartner(
      idOrder,
      me.id,
      me.role,
    );
  }
}
