import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { MarketplaceAccessGuard } from './marketplace-access.guard';
import { EnumRole } from 'src/generated/prisma/enums';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonOrdersService } from './ozon/ozon-orders.service';
import { OzonCrmOrderService } from './ozon-crm-order.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

/**
 * Заказы Ozon: список отправлений и заведение отправления в заказ CRM.
 *
 * Заведение — не перенос всей экономики, а только производственная часть:
 * цвет, размер и принт из артикула, номера заказа и отправления. Деньги
 * остаются на площадке (см. ozon/ozon-crm-order.ts).
 */
/** Что кладёт в запрос JwtAuthGuard: тот же приём, что в карточке заказа. */
interface RequestUser {
  id: string;
}

@Controller('marketplace/ozon')
@UseGuards(JwtAuthGuard, RolesGuard, MarketplaceAccessGuard)
// Заказы ведёт и менеджер по оформлению, а не только владелец — в отличие
// от доступов к кабинету, которые остаются админскими.
@Roles(EnumRole.ADMIN, EnumRole.ORDER_MANAGER, EnumRole.MARKETPLACE_CLIENT)
export class OzonOrdersController {
  constructor(
    private readonly accounts: MarketplaceAccountService,
    private readonly orders: OzonOrdersService,
    private readonly crmOrders: OzonCrmOrderService,
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

  /**
   * Есть ли уже заказ CRM по этому отправлению. Нужен списку: кнопка должна
   * говорить «Открыть заказ», а не предлагать завести второй.
   */
  @Get(':accountId/orders/:postingNumber/crm-order')
  async crmOrder(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('postingNumber') postingNumber: string,
  ) {
    await this.accounts.credentials(accountId);
    const order = await this.crmOrders.findByPosting(postingNumber);
    return { order };
  }

  /**
   * Завести отправление в CRM и вернуть заказ. Повторное нажатие открывает
   * тот же заказ: отправление связано с заказом уникальной колонкой.
   */
  @Post(':accountId/orders/:postingNumber/crm-order')
  async createCrmOrder(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('postingNumber') postingNumber: string,
    @CurrentUser() me: RequestUser,
  ) {
    const creds = await this.accounts.credentials(accountId);
    return this.crmOrders.createFromPosting(creds, postingNumber, me.id);
  }
}
