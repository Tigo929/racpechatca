import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OrderPhotoService } from './order-photo.service';
import { DtoCreateLead } from './dto/create-lead.dto';
import { SiteLeadTokenGuard } from './site-lead-token.guard';

/**
 * Публичный контроллер для заявок с лендинга.
 * НЕ защищён JWT — сюда шлёт сервер сайта без пользовательской авторизации.
 * Машинный Bearer-токен обязателен, иначе любой сможет создавать мусорные лиды.
 * Rate limit: 5 запросов / 60 сек с одного IP — дополнительная защита от спама.
 */
@Controller('order-photo')
@UseGuards(SiteLeadTokenGuard, ThrottlerGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
)
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
