import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumRole } from 'src/generated/prisma/enums';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonOrdersService } from './ozon/ozon-orders.service';

/**
 * Заказы Ozon. Пока только чтение: увидеть, что горит по срокам отгрузки,
 * не заходя в кабинет. Перенос в заказы CRM (склад, партнёр, зарплата) —
 * следующий шаг, там уже нужны решения по процессу.
 */
@Controller('marketplace/ozon')
@UseGuards(JwtAuthGuard, RolesGuard)
// Заказы ведёт и менеджер по оформлению, а не только владелец — в отличие
// от доступов к кабинету, которые остаются админскими.
@Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER)
export class OzonOrdersController {
  constructor(
    private readonly accounts: MarketplaceAccountService,
    private readonly orders: OzonOrdersService,
  ) {}

  @Get(':accountId/orders')
  async list(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('sinceDays') sinceDays?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const creds = await this.accounts.credentials(accountId);
    return this.orders.list(creds, {
      sinceDays: sinceDays ? Number(sinceDays) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
