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
import { MarketplaceAccessGuard } from './marketplace-access.guard';
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
import { OzonWarehouseService } from './ozon/ozon-warehouse.service';
import { OzonBulkStockService } from './ozon/ozon-bulk-stock.service';
import { DtoBulkStock } from './dto/ozon-bulk-stock.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

/**
 * Живой каталог кабинета: товары, которые уже заведены в Ozon, — с ценой,
 * остатком, статусом, спросом и акциями. Чтение и правка идут прямо в Ozon,
 * копии в нашей базе нет (см. OzonProductCatalogService).
 */
@Controller('marketplace/ozon')
@UseGuards(JwtAuthGuard, RolesGuard, MarketplaceAccessGuard)
@Roles(EnumRole.ADMIN, EnumRole.MARKETPLACE_CLIENT)
export class OzonProductCatalogController {
  constructor(
    private readonly accounts: MarketplaceAccountService,
    private readonly catalog: OzonProductCatalogService,
    private readonly ozon: OzonService,
    private readonly unitEconomics: OzonUnitEconomicsService,
    private readonly warehouses: OzonWarehouseService,
    private readonly bulkStock: OzonBulkStockService,
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

  /**
   * Контент-рейтинг: чего карточкам не хватает по мнению Ozon.
   * Отдельным запросом — он тяжёлый (партии по сотне SKU), и держать его
   * в списке товаров значило бы замедлять открытие раздела ради подсказки.
   */
  @Get(':accountId/catalog/content-rating')
  async contentRating(@Param('accountId', ParseUUIDPipe) accountId: string) {
    const creds = await this.accounts.credentials(accountId);
    const map = await this.catalog.contentRating(
      creds,
      await this.catalog.allSkus(creds),
    );
    return Object.fromEntries(map);
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

  /**
   * Склады кабинета — нужны, чтобы проставить остаток.
   *
   * Отдаём снимок из базы, к площадке идём только когда он устарел.
   * Раньше здесь звалась проверка подключения: она тянула ещё и список
   * товаров, то есть два запроса в Ozon на каждое открытие окна выбора
   * склада — при том что список складов меняется раз в месяцы.
   */
  @Get(':accountId/warehouses')
  async warehouseList(@Param('accountId', ParseUUIDPipe) accountId: string) {
    const creds = await this.accounts.credentials(accountId);
    return this.warehouses.list(accountId, creds);
  }

  /** Обновить список складов по кнопке — не дожидаясь истечения снимка. */
  @Post(':accountId/warehouses/sync')
  async warehouseSync(@Param('accountId', ParseUUIDPipe) accountId: string) {
    const creds = await this.accounts.credentials(accountId);
    return this.warehouses.sync(accountId, creds);
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

  /**
   * Что произойдёт, если подтвердить. Ничего не меняет: считает пары
   * «товар × склад», проверяет склады и предупреждает про обнуление.
   */
  @Post(':accountId/stocks/bulk/preview')
  async bulkStockPreview(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoBulkStock,
  ) {
    return this.bulkStock.preview(accountId, dto);
  }

  /**
   * Запуск операции. Возвращает её идентификатор сразу: отправкой
   * занимается фоновый обработчик, поэтому закрытая вкладка ничего
   * не отменяет.
   */
  @Post(':accountId/stocks/bulk')
  async bulkStockStart(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoBulkStock,
    @CurrentUser() user: { id: string } | undefined,
  ) {
    return this.bulkStock.start(accountId, user?.id ?? null, dto);
  }

  @Get(':accountId/stocks/bulk/:operationId')
  async bulkStockStatus(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('operationId', ParseUUIDPipe) operationId: string,
  ) {
    return this.bulkStock.status(accountId, operationId);
  }

  /** Повторить только неудачные пары — успешные не трогаем. */
  @Post(':accountId/stocks/bulk/:operationId/retry-errors')
  async bulkStockRetry(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('operationId', ParseUUIDPipe) operationId: string,
  ) {
    return this.bulkStock.retryErrors(accountId, operationId);
  }

  /** История массовых изменений остатков кабинета. */
  @Get(':accountId/stocks/history')
  async bulkStockHistory(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.bulkStock.history(accountId);
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
