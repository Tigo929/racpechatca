import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { OrderPhotoService } from './order-photo.service';
import { DtoCreateLead } from './dto/create-lead.dto';

/**
 * Публичный контроллер для заявок с лендинга.
 * НЕ защищён гвардами — сюда шлёт форма «Рассчитать заказ» без авторизации.
 * Создаёт заказ со статусом LEAD, который попадает в CRM администратору.
 */
@Controller('order-photo')
export class LeadController {
  constructor(private readonly orderPhotoService: OrderPhotoService) {}

  @Post('lead')
  @HttpCode(201)
  async createLead(@Body() dto: DtoCreateLead) {
    const order = await this.orderPhotoService.createLead(dto);
    // Наружу отдаём только подтверждение, без внутренних данных заказа.
    return { ok: true, numberOrder: order.numberOrder };
  }
}
