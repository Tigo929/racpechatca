import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumMarketplace, EnumRole } from 'src/generated/prisma/enums';
import { MarketplaceAccessGuard } from './marketplace-access.guard';
import type { AuthenticatedRequest } from 'src/auth/authenticated-request';
import { MarketplaceAccountService } from './marketplace-account.service';
import { DtoCreateMarketplaceAccount } from './dto/create-marketplace-account.dto';
import { DtoUpdateMarketplaceAccount } from './dto/update-marketplace-account.dto';

/**
 * Кабинеты маркетплейсов. Доступы к чужому магазину — уровень «ключи от
 * кассы», поэтому кабинет виден только своему владельцу; админ видит все.
 *
 * MarketplaceAccessGuard разворачивает `:id` кабинета и не пускает к чужому.
 */
@Controller('marketplace')
@UseGuards(JwtAuthGuard, RolesGuard, MarketplaceAccessGuard)
@Roles(EnumRole.ADMIN, EnumRole.MARKETPLACE_CLIENT)
export class MarketplaceController {
  constructor(private readonly accounts: MarketplaceAccountService) {}

  @Get('accounts')
  list(
    @Req() req: AuthenticatedRequest,
    @Query('marketplace') marketplace?: EnumMarketplace,
  ) {
    return this.accounts.list(marketplace, req.user);
  }

  @Post('accounts')
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DtoCreateMarketplaceAccount,
  ) {
    return this.accounts.create(dto, req.user.id);
  }

  @Patch('accounts/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DtoUpdateMarketplaceAccount,
  ) {
    return this.accounts.update(id, dto);
  }

  @Delete('accounts/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.remove(id);
  }

  /** Ручная проверка связи — кнопка «Проверить» на карточке кабинета. */
  @Post('accounts/:id/check')
  check(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.check(id);
  }
}
