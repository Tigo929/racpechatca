import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrderPhotoService } from './order-photo.service';
import { DtoCreateLead } from './dto/create-lead.dto';
import { SiteLeadTokenGuard } from './site-lead-token.guard';

/**
 * Публичный контроллер для заявок с лендинга.
 * НЕ защищён JWT — сюда шлёт сервер сайта без пользовательской авторизации.
 * Защита: машинный токен + подпись тела (см. SiteLeadTokenGuard).
 *
 * Лимит намеренно щедрый. Заявки идут с ОДНОГО IP — сервера сайта, поэтому
 * лимит по IP не отсекает спамера (его отсекает токен), зато при пяти запросах
 * в минуту резал бы настоящие заказы в час пик: ретраи сайта укладываются в
 * пару секунд и такой отказ не переживут — заявка потеряется. Оставляем потолок
 * как страховку на случай утечки токена.
 */
// ThrottlerGuard здесь не указан: он подключён глобально в AppModule, а
// повторное указание считало бы один запрос дважды.
@Controller('order-photo')
@UseGuards(SiteLeadTokenGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
)
@Throttle({ default: { ttl: 60_000, limit: 60 } })
export class LeadController {
  constructor(private readonly orderPhotoService: OrderPhotoService) {}

  @Post('lead')
  @HttpCode(201)
  async createLead(@Body() dto: DtoCreateLead) {
    const order = await this.orderPhotoService.createLead(dto);
    return { ok: true, numberOrder: order.numberOrder };
  }
}
