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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { EnumMarketplace, EnumRole } from 'src/generated/prisma/enums';
import { MarketplaceAccountService } from './marketplace-account.service';
import { DtoCreateMarketplaceAccount } from './dto/create-marketplace-account.dto';
import { DtoUpdateMarketplaceAccount } from './dto/update-marketplace-account.dto';

/**
 * Кабинеты маркетплейсов. Доступы к чужому магазину — уровень «ключи от
 * кассы», поэтому раздел только для администратора.
 */
@Controller('marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class MarketplaceController {
  constructor(private readonly accounts: MarketplaceAccountService) {}

  @Get('accounts')
  list(@Query('marketplace') marketplace?: EnumMarketplace) {
    return this.accounts.list(marketplace);
  }

  @Post('accounts')
  create(@Body() dto: DtoCreateMarketplaceAccount) {
    return this.accounts.create(dto);
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
