import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrderPhotoService } from './order-photo.service';
import { DtoCreateLead } from './dto/create-lead.dto';
import { SiteLeadTokenGuard } from './site-lead-token.guard';
import { ClientGreetingService } from './client-greeting.service';
import { isGreetingStatus } from './client-greeting';

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
  constructor(
    private readonly orderPhotoService: OrderPhotoService,
    private readonly greeting: ClientGreetingService,
  ) {}

  @Post('lead')
  @HttpCode(201)
  async createLead(@Body() dto: DtoCreateLead) {
    const order = await this.orderPhotoService.createLead(dto);
    return { ok: true, numberOrder: order.numberOrder };
  }

  /*
   * Очередь первых сообщений клиентам.
   *
   * Тот же guard, что и у приёма заявок: это тот же доверенный контур —
   * наши же процессы на нашем сервере. Второй токен пришлось бы отдельно
   * заводить, хранить и не забывать менять, а защищает он ровно то же самое.
   *
   * Наружу отдаётся минимум: никнейм, имя и номер заказа. Телефон, сумма
   * и состав заказа воркеру не нужны — значит, и знать он их не должен.
   */
  @Get('greeting/pending')
  async pendingGreetings(@Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '20', 10);
    return {
      items: await this.greeting.pending(
        Number.isFinite(parsed) ? parsed : 20,
      ),
    };
  }

  @Post('greeting/mark')
  @HttpCode(200)
  async markGreeting(@Body() body: { id?: string; status?: string }) {
    const id = (body.id ?? '').trim();
    const status = (body.status ?? '').trim();
    if (!id) throw new BadRequestException('Не указан заказ.');
    if (!isGreetingStatus(status)) {
      throw new BadRequestException(`Неизвестный итог: ${status}`);
    }
    await this.greeting.mark(id, status);
    return { ok: true };
  }
}
