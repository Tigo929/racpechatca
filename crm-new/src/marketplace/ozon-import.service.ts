import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EnumOzonSyncStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { MarketplaceAccountService } from './marketplace-account.service';
import { OzonCatalogTemplateService } from './ozon-catalog-template.service';
import {
  OzonCatalogService,
  type OzonImportInfoItem,
} from './ozon/ozon-catalog.service';
import type { OzonCredentials } from './ozon/ozon-api.client';
import {
  buildImportItem,
  chunk,
  IMPORT_BATCH_SIZE,
  type VariantDimensions,
} from './ozon/ozon-attributes';

/**
 * Публикация принтов в Ozon и слежение за судьбой асинхронной загрузки.
 *
 * `/v3/product/import` не создаёт товар мгновенно — отвечает `task_id`,
 * и понять, прижился ли товар (или Ozon отбил его за плохой атрибут), можно
 * только опросив `/v1/product/import/info`. Это ровно та же схема, что уже
 * есть в проекте для статуса заказов у партнёра
 * (`partner-status-poll.service.ts`) — переиспользуем форму, не механизм.
 */
@Injectable()
export class OzonImportService {
  private readonly logger = new Logger(OzonImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: MarketplaceAccountService,
    private readonly templates: OzonCatalogTemplateService,
    private readonly catalog: OzonCatalogService,
  ) {}

  /** Отправляет выбранные принты в Ozon: режет варианты на пачки ≤100 и создаёт по батчу на каждую. */
  async submit(marketplaceAccountId: string, printIds: string[]) {
    if (!printIds.length)
      throw new BadRequestException('Не выбрано ни одного принта');

    const template = await this.templates.getOrCreate(marketplaceAccountId);
    const prints = await this.prisma.ozonPrint.findMany({
      where: { id: { in: printIds }, marketplaceAccountId },
      include: { variants: true },
    });
    if (!prints.length)
      throw new BadRequestException('Принты не найдены в этом кабинете');

    const variants = prints.flatMap((p) =>
      p.variants.map((v) => ({ print: p, variant: v })),
    );
    if (!variants.length) {
      throw new BadRequestException(
        'У выбранных принтов нет ни одного варианта — нечего публиковать',
      );
    }

    const creds = await this.accounts.credentials(marketplaceAccountId);
    const sizeDimensions = template.sizeDimensions as unknown as Record<
      string,
      VariantDimensions
    >;

    const batches = chunk(variants, IMPORT_BATCH_SIZE);
    const results: { batchId: string; taskId: string; count: number }[] = [];

    for (const batch of batches) {
      const items = batch.map(({ print, variant }) =>
        buildImportItem(
          {
            descriptionCategoryId: template.descriptionCategoryId,
            typeId: template.typeId,
            vatRate: template.vatRate,
            needsMarkingCode: template.needsMarkingCode,
            brandDictionaryValueId: template.brandDictionaryValueId,
            countryDictionaryValueId: template.countryDictionaryValueId,
            materialDictionaryValueId: template.materialDictionaryValueId,
            materialComposition: template.materialComposition,
            styleDictionaryValueId: template.styleDictionaryValueId,
            seasonDictionaryValueId: template.seasonDictionaryValueId,
            careInstructions: template.careInstructions,
            sleeveDictionaryValueId: template.sleeveDictionaryValueId,
            necklineDictionaryValueId: template.necklineDictionaryValueId,
            packageTypeDictionaryValueId: template.packageTypeDictionaryValueId,
            tnvedDictionaryValueId: template.tnvedDictionaryValueId,
            sizeDimensions,
          },
          {
            slug: print.slug,
            name: print.name,
            description: print.description,
            hashtags: print.hashtags,
            mainPhotoUrl: print.mainPhotoUrl,
            extraPhotoUrls: print.extraPhotoUrls,
            price: print.price,
            oldPrice: print.oldPrice,
            gender: print.gender,
            patternTags: print.patternTags,
            unionKey: print.unionKey,
          },
          {
            offerId: variant.offerId,
            colorLabel: variant.colorLabel,
            colorDictionaryValueId: variant.colorDictionaryValueId,
            size: variant.size,
            priceOverride: variant.priceOverride,
          },
        ),
      );

      const taskId = await this.catalog.importProducts(creds, items);
      const variantIds = batch.map(({ variant }) => variant.id);

      const created = await this.prisma.ozonImportBatch.create({
        data: {
          marketplaceAccountId,
          ozonTaskId: taskId,
          variantIds,
          status: 'polling',
        },
      });

      await this.prisma.ozonVariant.updateMany({
        where: { id: { in: variantIds } },
        data: { status: EnumOzonSyncStatus.QUEUED, lastError: null },
      });
      await this.prisma.ozonPrint.updateMany({
        where: { id: { in: batch.map(({ print }) => print.id) } },
        data: { status: EnumOzonSyncStatus.QUEUED, lastError: null },
      });

      results.push({ batchId: created.id, taskId, count: batch.length });
      this.logger.log(
        `Ozon import: батч ${created.id} (${batch.length} вариантов) → task_id ${taskId}`,
      );
    }

    return { batches: results };
  }

  /** Опрашивает все открытые батчи один раз. Вызывается таймером из OzonImportPollService. */
  async pollOnce(): Promise<void> {
    const open = await this.prisma.ozonImportBatch.findMany({
      where: { status: 'polling' },
      take: 20,
      orderBy: { createdAt: 'asc' },
    });
    if (!open.length) return;

    for (const batch of open) {
      await this.pollBatch(
        batch.id,
        batch.marketplaceAccountId,
        batch.ozonTaskId,
      );
    }
  }

  private async pollBatch(
    batchId: string,
    marketplaceAccountId: string,
    taskId: string,
  ): Promise<void> {
    let creds: OzonCredentials;
    try {
      creds = await this.accounts.credentials(marketplaceAccountId);
    } catch {
      // Кабинет удалили, пока батч висел в очереди — закрываем, дальше опрашивать некого.
      await this.prisma.ozonImportBatch.update({
        where: { id: batchId },
        data: { status: 'done' },
      });
      return;
    }

    let items: OzonImportInfoItem[];
    try {
      items = await this.catalog.importInfo(creds, taskId);
    } catch (e) {
      this.logger.warn(
        `Ozon import/info для батча ${batchId} не ответил: ${e instanceof Error ? e.message : e}`,
      );
      return; // попробуем на следующем тике — не закрываем батч по сетевой ошибке
    }

    let settledCount = 0;
    for (const item of items) {
      const hasError = Boolean(item.errors?.length);
      // Именно > 0, а не «есть число»: у ещё не обработанного товара Ozon
      // отдаёт product_id = 0, и проверка на тип засчитала бы его готовым.
      // Успешно созданный отвечает status "imported" с настоящим id.
      const isDone = hasError || (item.product_id ?? 0) > 0;
      if (!isDone) continue;
      settledCount += 1;

      const variant = await this.prisma.ozonVariant.findUnique({
        where: { offerId: item.offer_id },
      });
      if (!variant) continue;

      if (hasError) {
        const message =
          item.errors?.[0]?.description ||
          item.errors?.[0]?.code ||
          'Ozon отклонил товар';
        await this.prisma.ozonVariant.update({
          where: { id: variant.id },
          data: { status: EnumOzonSyncStatus.ERROR, lastError: message },
        });
      } else {
        await this.prisma.ozonVariant.update({
          where: { id: variant.id },
          data: {
            status: EnumOzonSyncStatus.OK,
            ozonProductId: item.product_id ? BigInt(item.product_id) : null,
            lastError: null,
          },
        });
      }
    }

    if (settledCount < items.length) return; // ещё не все варианты пачки получили финальный статус

    await this.prisma.ozonImportBatch.update({
      where: { id: batchId },
      data: { status: 'done' },
    });
    await this.closeSettledPrints(batchId);
  }

  /** Как только у принта не осталось вариантов в QUEUED/SENT — фиксируем итог: OK или ERROR. */
  private async closeSettledPrints(batchId: string): Promise<void> {
    const batch = await this.prisma.ozonImportBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) return;

    const printIds = await this.prisma.ozonVariant.findMany({
      where: { id: { in: batch.variantIds } },
      select: { printId: true },
      distinct: ['printId'],
    });

    for (const { printId } of printIds) {
      const variants = await this.prisma.ozonVariant.findMany({
        where: { printId },
      });
      const stillPending = variants.some(
        (v) =>
          v.status === EnumOzonSyncStatus.QUEUED ||
          v.status === EnumOzonSyncStatus.SENT,
      );
      if (stillPending) continue;

      const hasError = variants.some(
        (v) => v.status === EnumOzonSyncStatus.ERROR,
      );
      await this.prisma.ozonPrint.update({
        where: { id: printId },
        data: {
          status: hasError ? EnumOzonSyncStatus.ERROR : EnumOzonSyncStatus.OK,
          lastError: hasError
            ? 'Часть вариантов Ozon отклонил — см. ошибки по цвету/размеру'
            : null,
        },
      });
    }
  }
}
