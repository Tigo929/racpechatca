import {
  Body,
  Controller,
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
import { EnumRole } from 'src/generated/prisma/enums';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonProductCatalogService } from './ozon/ozon-product-catalog.service';
import { DtoOzonUpdateCardText } from './dto/update-ozon-card-text.dto';
import { OzonService } from './ozon/ozon.service';
import {
  DtoOzonArchive,
  DtoOzonUpdatePrices,
  DtoOzonUpdateStocks,
} from './dto/ozon-catalog-edit.dto';
import { DtoUpdateOzonUnitEconomics } from './dto/update-ozon-unit-economics.dto';
import { OzonUnitEconomicsService } from './ozon-unit-economics.service';

/**
 * Живой каталог кабинета: товары, которые уже заведены в Ozon, — с ценой,
 * остатком, статусом, спросом и акциями. Чтение и правка идут прямо в Ozon,
 * копии в нашей базе нет (см. OzonProductCatalogService).
 */
@Controller('marketplace/ozon')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class OzonProductCatalogController {
  constructor(
    private readonly accounts: MarketplaceAccountService,
    private readonly catalog: OzonProductCatalogService,
    private readonly ozon: OzonService,
    private readonly unitEconomics: OzonUnitEconomicsService,
  ) {}

  @Get(':accountId/catalog')
  async list(@Param('accountId', ParseUUIDPipe) accountId: string) {
    const creds = await this.accounts.credentials(accountId);
    return this.catalog.listProducts(creds);
  }

  /**
   * Подробности карточки: описание, габариты, заполненные атрибуты.
   * Отдельным запросом — Ozon держит их вне списка товаров, и грузить их
   * для всего каталога ради списка незачем.
   */
  @Get(':accountId/catalog/card')
  async card(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('offerId') offerId: string,
  ) {
    const creds = await this.accounts.credentials(accountId);
    return this.catalog.productCard(creds, offerId);
  }

  /**
   * Правка названия и описания опубликованного товара.
   *
   * Ozon принимает изменения не мгновенно, поэтому отвечаем номером задачи:
   * результат узнаётся отдельным запросом ниже. Так видно и отказ модерации
   * с причиной, а не только «запрос ушёл».
   */
  @Post(':accountId/catalog/card')
  async updateCard(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoOzonUpdateCardText,
  ) {
    const creds = await this.accounts.credentials(accountId);
    return this.catalog.updateCardText(creds, dto.offerId, {
      name: dto.name,
      description: dto.description,
    });
  }

  /** Чем закончился импорт: приняли, ещё считают или отклонили с причиной. */
  @Get(':accountId/catalog/import-status')
  async importStatus(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('taskId') taskId: string,
  ) {
    const creds = await this.accounts.credentials(accountId);
    return this.catalog.importStatus(creds, Number(taskId));
  }

  /** Юнит-экономика по всем товарам: тарифы Ozon + себестоимость продавца. */
  @Get(':accountId/economics')
  economics(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.unitEconomics.forAccount(accountId);
  }

  @Get(':accountId/economics/settings')
  economicsSettings(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.unitEconomics.getSettings(accountId);
  }

  @Patch(':accountId/economics/settings')
  updateEconomicsSettings(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoUpdateOzonUnitEconomics,
  ) {
    return this.unitEconomics.updateSettings(accountId, dto);
  }

  /** Пересчёт «что если»: та же математика при другой цене. */
  @Get(':accountId/economics/preview')
  preview(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('offerId') offerId: string,
    @Query('price') price: string,
  ) {
    return this.unitEconomics.preview(accountId, offerId, Number(price) || 0);
  }

  /** Акции площадки: в каких участвуем и сколько товаров подходит. */
  @Get(':accountId/actions')
  async actions(@Param('accountId', ParseUUIDPipe) accountId: string) {
    const creds = await this.accounts.credentials(accountId);
    return this.catalog.listActions(creds);
  }

  /** Спрос за произвольный период — для сравнения «неделя против месяца». */
  @Get(':accountId/demand')
  async demand(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('days') days?: string,
  ) {
    const creds = await this.accounts.credentials(accountId);
    const map = await this.catalog.demandBySku(creds, Number(days) || 30);
    return Object.fromEntries(map);
  }

  /** Склады кабинета — нужны, чтобы проставить остаток. */
  @Get(':accountId/warehouses')
  async warehouses(@Param('accountId', ParseUUIDPipe) accountId: string) {
    const creds = await this.accounts.credentials(accountId);
    const info = await this.ozon.checkConnection(creds);
    return info.warehouses ?? [];
  }

  @Post(':accountId/catalog/prices')
  async updatePrices(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoOzonUpdatePrices,
  ) {
    const creds = await this.accounts.credentials(accountId);
    return this.catalog.updatePrices(creds, dto.items);
  }

  @Post(':accountId/catalog/stocks')
  async updateStocks(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoOzonUpdateStocks,
  ) {
    const creds = await this.accounts.credentials(accountId);
    return this.catalog.updateStocks(creds, dto.warehouseId, dto.items);
  }

  @Post(':accountId/catalog/archive')
  async archive(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoOzonArchive,
  ) {
    const creds = await this.accounts.credentials(accountId);
    const ok = await this.catalog.setArchived(
      creds,
      dto.productIds,
      dto.archived,
    );
    return { ok };
  }
}
