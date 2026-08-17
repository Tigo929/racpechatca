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
import { EnumRole } from 'src/generated/prisma/enums';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonCatalogTemplateService } from './ozon-catalog-template.service';
import { OzonPrintService } from './ozon-print.service';
import { OzonImportService } from './ozon-import.service';
import { OzonCatalogService } from './ozon/ozon-catalog.service';
import { DtoUpdateOzonCatalogTemplate } from './dto/update-ozon-catalog-template.dto';
import { DtoCreateOzonPrint } from './dto/create-ozon-print.dto';
import { DtoCreateOzonPrintsBulk } from './dto/create-ozon-prints-bulk.dto';
import { DtoUpdateOzonPrint } from './dto/update-ozon-print.dto';
import { DtoOzonColorGroup } from './dto/ozon-color-group.dto';
import { DtoPublishOzonPrints } from './dto/publish-ozon-prints.dto';

/**
 * Карточки товара Ozon: шаблон констант категории + принты (карточки) с их
 * вариантами цвет×размер. Доступы к кабинету — уровень ADMIN, тот же охранник,
 * что и у marketplace.controller.ts.
 */
@Controller('marketplace/ozon')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRole.ADMIN)
export class OzonCatalogController {
  constructor(
    private readonly accounts: MarketplaceAccountService,
    private readonly templates: OzonCatalogTemplateService,
    private readonly prints: OzonPrintService,
    private readonly importService: OzonImportService,
    private readonly catalog: OzonCatalogService,
  ) {}

  @Get(':accountId/template')
  getTemplate(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.templates.getOrCreate(accountId);
  }

  @Patch(':accountId/template')
  updateTemplate(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoUpdateOzonCatalogTemplate,
  ) {
    return this.templates.update(accountId, dto);
  }

  /** Живой поиск по словарю атрибута (цвет, тематика рисунка) — для подсказок в форме. */
  @Get(':accountId/attribute-search')
  async searchAttributeValue(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('attributeId') attributeId: string,
    @Query('q') query: string,
  ) {
    const [creds, template] = await Promise.all([
      this.accounts.credentials(accountId),
      this.templates.getOrCreate(accountId),
    ]);
    return this.catalog.searchAttributeValue(creds, {
      descriptionCategoryId: template.descriptionCategoryId,
      typeId: template.typeId,
      attributeId: Number(attributeId),
      query: query ?? '',
    });
  }

  @Get(':accountId/prints')
  listPrints(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.prints.list(accountId);
  }

  @Post(':accountId/prints')
  createPrint(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoCreateOzonPrint,
  ) {
    return this.prints.create(accountId, dto);
  }

  @Post(':accountId/prints/bulk')
  createPrintsBulk(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoCreateOzonPrintsBulk,
  ) {
    return this.prints.createBulk(accountId, dto.prints);
  }

  @Post(':accountId/prints/publish')
  publish(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: DtoPublishOzonPrints,
  ) {
    return this.importService.submit(accountId, dto.printIds);
  }

  @Patch('prints/:id')
  updatePrint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DtoUpdateOzonPrint,
  ) {
    return this.prints.update(id, dto);
  }

  @Post('prints/:id/variants')
  addColorGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DtoOzonColorGroup,
  ) {
    return this.prints.addColorGroup(id, dto);
  }

  @Delete('prints/:id')
  removePrint(@Param('id', ParseUUIDPipe) id: string) {
    return this.prints.remove(id);
  }
}
