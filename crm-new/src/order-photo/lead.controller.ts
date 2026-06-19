import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OrderPhotoService } from './order-photo.service';
import { DtoCreateLead } from './dto/create-lead.dto';

/**
 * Публичный контроллер для заявок с лендинга.
 * НЕ защищён JWT — сюда шлёт форма «Рассчитать заказ» без авторизации.
 * Rate limit: 5 запросов / 60 сек с одного IP — защита от спама.
 */
@Controller('order-photo')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { ttl: 60_000, limit: 5 } })
export class LeadController {
  constructor(private readonly orderPhotoService: OrderPhotoService) {}

  @Post('lead')
  @HttpCode(201)
  async createLead(@Body() dto: DtoCreateLead) {
    const order = await this.orderPhotoService.createLead(dto);
    return { ok: true, numberOrder: order.numberOrder };
  }
}
