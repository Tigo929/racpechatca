import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EnumOzonSyncStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { OzonProductCatalogService } from './ozon/ozon-product-catalog.service';
import { OzonService } from './ozon/ozon.service';
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
    private readonly products: OzonProductCatalogService,
    private readonly ozon: OzonService,
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

    /*
     * Ключ объединения берём у уже опубликованной карточки с тем же кодом
     * принта, а не свой. Иначе добавленный цвет уходит в Ozon отдельной
     * карточкой: площадка сводит товары именно по совпадению этого ключа.
     *
     * Найденный ключ сохраняем принту — чтобы следующая публикация не
     * зависела от того, ответит ли Ozon, и чтобы в базе была та же правда,
     * что в кабинете.
     */
    const unionKeys = new Map<string, string>();
    const existingBySlug = await this.products
      .existingUnionKeys(
        creds,
        prints.map((p) => p.slug),
      )
      .catch(() => new Map<string, string>());
    for (const print of prints) {
      const existing = existingBySlug.get(print.slug);
      if (existing && existing !== print.unionKey) {
        unionKeys.set(print.id, existing);
        await this.prisma.ozonPrint.update({
          where: { id: print.id },
          data: { unionKey: existing },
        });
        this.logger.log(
          `Принт ${print.slug}: подхватил ключ объединения существующей карточки Ozon`,
        );
      }
    }

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
            sharedPhotoUrls: template.sharedPhotoUrls,
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
            unionKey: unionKeys.get(print.id) ?? print.unionKey,
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
    /*
     * Варианты, которые Ozon принял именно сейчас. Им нужно доделать то,
     * чего импорт не делает: проставить остаток и выдать штрихкод. Берём
     * только те, у которых ещё не было product_id, — иначе повторная
     * публикация принта затирала бы остаток, выставленный руками.
     */
    const justPublished: { offerId: string; productId: number }[] = [];
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
        if (!variant.ozonProductId && item.product_id) {
          justPublished.push({
            offerId: variant.offerId,
            productId: item.product_id,
          });
        }
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

    if (justPublished.length) {
      await this.activatePublished(marketplaceAccountId, creds, justPublished);
    }

    if (settledCount < items.length) return; // ещё не все варианты пачки получили финальный статус

    await this.prisma.ozonImportBatch.update({
      where: { id: batchId },
      data: { status: 'done' },
    });
    await this.closeSettledPrints(batchId);
  }

  /**
   * Доводит только что созданный товар до состояния «продаётся».
   *
   * `/v3/product/import` заводит карточку, но не делает двух вещей, без
   * которых она мертва:
   *
   *  • **Остаток.** Пока он ноль, Ozon не показывает товар покупателю вообще.
   *    Карточка есть, в кабинете зелёная — а заказов нет и быть не может.
   *    Это ровно тот случай, когда «создали, а оно не продаётся».
   *  • **Штрихкод.** Без него товар не примут на складе. Свой придумывать
   *    нельзя — чужой диапазон EAN означает коллизию с чужим товаром, —
   *    поэтому просим штрихкод у самой площадки её же методом.
   *
   * Обе операции необязательные: если они не прошли, товар всё равно создан,
   * и ронять из-за них разбор ответа Ozon нельзя. Поэтому неудачи пишем в
   * лог, а не в статус варианта — иначе успешно опубликованная карточка
   * выглядела бы отклонённой.
   */
  private async activatePublished(
    marketplaceAccountId: string,
    creds: OzonCredentials,
    published: { offerId: string; productId: number }[],
  ): Promise<void> {
    const template = await this.templates.getOrCreate(marketplaceAccountId);

    if (template.defaultStock > 0) {
      try {
        const info = await this.ozon.checkConnection(creds);
        const warehouseId = info.warehouses?.[0]?.id;
        if (!warehouseId) {
          this.logger.warn(
            `Остаток новым товарам не проставлен: в кабинете не видно ни одного склада FBS`,
          );
        } else {
          const res = await this.products.updateStocks(
            creds,
            warehouseId,
            published.map((p) => ({
              offerId: p.offerId,
              stock: template.defaultStock,
            })),
          );
          const failed = res.filter((r) => !r.updated);
          this.logger.log(
            `Остаток ${template.defaultStock} проставлен: ${res.length - failed.length} из ${res.length}`,
          );
          for (const f of failed) {
            this.logger.warn(`Остаток ${f.offerId} не принят: ${f.error}`);
          }
        }
      } catch (e) {
        this.logger.warn(
          `Не удалось проставить остаток новым товарам: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    try {
      const failures = await this.products.generateBarcodes(
        creds,
        published.map((p) => p.productId),
      );
      this.logger.log(
        `Штрихкоды запрошены на ${published.length} товаров, отказов: ${failures.length}`,
      );
    } catch (e) {
      this.logger.warn(
        `Штрихкоды новым товарам не выданы: ${e instanceof Error ? e.message : e}`,
      );
    }
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
