import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EnumOzonSyncStatus } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { OzonProductCatalogService } from './ozon/ozon-product-catalog.service';
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
import { resolveDefaultWarehouses } from './ozon/ozon-default-warehouses';
import { OzonWarehouseService } from './ozon/ozon-warehouse.service';

/**
 * Публикация принтов в Ozon и слежение за судьбой асинхронной загрузки.
 *
 * `/v3/product/import` не создаёт товар мгновенно — отвечает `task_id`,
 * и понять, прижился ли товар (или Ozon отбил его за плохой атрибут), можно
 * только опросив `/v1/product/import/info`. Это ровно та же схема, что уже
 * есть в проекте для статуса заказов у партнёра
 * (`partner-status-poll.service.ts`) — переиспользуем форму, не механизм.
 */
/**
 * Сколько раз пробуем проставить остаток, прежде чем оставить вариант в покое.
 * Опрос идёт раз в полминуты, то есть на попытки уходит около получаса —
 * этого хватает даже медленной модерации Ozon.
 */
const MAX_STOCK_ATTEMPTS = 60;

@Injectable()
export class OzonImportService {
  private readonly logger = new Logger(OzonImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: MarketplaceAccountService,
    private readonly templates: OzonCatalogTemplateService,
    private readonly catalog: OzonCatalogService,
    private readonly products: OzonProductCatalogService,
    private readonly warehouses: OzonWarehouseService,
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
            mainPhotoUrl: variant.mainPhotoUrl,
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
        data: {
          status: EnumOzonSyncStatus.QUEUED,
          lastError: null,
          // Публикация означает «сделать продаваемым», поэтому остаток
          // проставляется заново: отметка и счётчик попыток обнуляются.
          stockAppliedAt: null,
          stockAttempts: 0,
        },
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

    for (const batch of open) {
      await this.pollBatch(
        batch.id,
        batch.marketplaceAccountId,
        batch.ozonTaskId,
      );
    }

    await this.applyPendingStocks();
  }

  /**
   * Дожимает остаток у опубликованных вариантов.
   *
   * Отдельным проходом, а не сразу после импорта, потому что Ozon на
   * немедленную попытку отвечает «Product is not created»: карточка заведена,
   * но товар ещё не готов принимать остатки. Одна попытка тут ничего не
   * стоит — на живом кабинете так не прошло ни одного из десяти вариантов, и
   * все они остались непродаваемыми при зелёном статусе.
   *
   * Уже выставленный остаток не трогаем: сначала читаем, что в кабинете, и
   * заполняем только нули. Иначе «остаток при публикации» затирал бы цифру,
   * которую поставили руками, — а повторная публикация карточки бывает.
   */
  async applyPendingStocks(): Promise<void> {
    const pending = await this.prisma.ozonVariant.findMany({
      where: {
        status: EnumOzonSyncStatus.OK,
        stockAppliedAt: null,
        stockAttempts: { lt: MAX_STOCK_ATTEMPTS },
      },
      select: { id: true, offerId: true, print: { select: { marketplaceAccountId: true } } },
      take: 200,
    });
    if (!pending.length) return;

    // По кабинетам: склад и доступы у каждого свои.
    const byAccount = new Map<string, { id: string; offerId: string }[]>();
    for (const v of pending) {
      const key = v.print.marketplaceAccountId;
      byAccount.set(key, [...(byAccount.get(key) ?? []), { id: v.id, offerId: v.offerId }]);
    }

    for (const [accountId, variants] of byAccount) {
      try {
        await this.applyStocksForAccount(accountId, variants);
      } catch (e) {
        this.logger.warn(
          `Остатки кабинета ${accountId} не проставлены: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  private async applyStocksForAccount(
    marketplaceAccountId: string,
    variants: { id: string; offerId: string }[],
  ): Promise<void> {
    const template = await this.templates.getOrCreate(marketplaceAccountId);
    if (template.defaultStock <= 0) {
      // Проставлять нечего — снимаем с очереди, иначе будем ходить сюда вечно.
      await this.markStockApplied(variants.map((v) => v.id));
      return;
    }

    const creds = await this.accounts.credentials(marketplaceAccountId);

    // Что уже лежит в кабинете. Вариант с ненулевым остатком считаем
    // сделанным: цифру мог поставить человек, и перебивать её нельзя.
    const current = await this.products.stockByOfferId(creds).catch(() => null);
    const alreadyStocked = variants.filter((v) => (current?.get(v.offerId) ?? 0) > 0);
    if (alreadyStocked.length) {
      await this.markStockApplied(alreadyStocked.map((v) => v.id));
    }
    const toFill = variants.filter((v) => !alreadyStocked.includes(v));
    if (!toFill.length) return;

    // Куда писать остаток, решает шаблон. Раньше здесь брался
    // `warehouses[0]` — первый склад из ответа площадки, молча: у продавца
    // с несколькими складами товар оказывался доступен только в одном
    // городе, и объяснения этому в интерфейсе не было.
    const known = await this.warehouses.list(marketplaceAccountId, creds);
    const choice = resolveDefaultWarehouses(
      template.defaultWarehouseIds.map(Number),
      known.warehouses.map((w) => ({
        warehouseId: w.id,
        name: w.name,
        isEditable: w.isEditable,
        disabledReason: w.disabledReason,
        archived: false,
      })),
    );
    for (const warning of choice.warnings) this.logger.warn(warning);
    if (!choice.targets.length) return;

    // Позиция считается закрытой, только когда остаток принят на КАЖДОМ
    // выбранном складе. Иначе товар, доехавший до одного города из трёх,
    // молча ушёл бы из очереди повторов и остался бы наполовину доступным.
    const acceptedOn = new Map<string, number>();
    const failed: string[] = [];
    for (const warehouseId of choice.targets) {
      const results = await this.products.updateStocks(
        creds,
        warehouseId,
        toFill.map((v) => ({ offerId: v.offerId, stock: template.defaultStock })),
      );
      for (const r of results) {
        if (r.updated) {
          acceptedOn.set(r.offerId, (acceptedOn.get(r.offerId) ?? 0) + 1);
        } else {
          failed.push(`${r.offerId} → склад ${warehouseId}: ${r.error ?? 'без причины'}`);
        }
      }
    }

    const okIds: string[] = [];
    for (const variant of toFill) {
      if ((acceptedOn.get(variant.offerId) ?? 0) === choice.targets.length) {
        okIds.push(variant.id);
      }
    }

    if (okIds.length) await this.markStockApplied(okIds);
    if (failed.length) {
      await this.prisma.ozonVariant.updateMany({
        where: { id: { in: toFill.filter((v) => !okIds.includes(v.id)).map((v) => v.id) } },
        data: { stockAttempts: { increment: 1 } },
      });
      this.logger.log(
        `Остаток ${template.defaultStock}: принято ${okIds.length}, отложено ${failed.length} (${failed[0]}) — повторим`,
      );
    } else if (okIds.length) {
      this.logger.log(`Остаток ${template.defaultStock} проставлен: ${okIds.length}`);
    }
  }

  private markStockApplied(ids: string[]) {
    return this.prisma.ozonVariant.updateMany({
      where: { id: { in: ids } },
      data: { stockAppliedAt: new Date() },
    });
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
   * Штрихкод только что созданному товару.
   *
   * Без штрихкода товар не примут на складе. Свой придумывать нельзя — чужой
   * диапазон EAN означает коллизию с чужим товаром, — поэтому просим у самой
   * площадки её же методом; product_id она принимает сразу.
   *
   * Остаток здесь не ставится: на него Ozon сразу после импорта отвечает
   * «Product is not created» — товар создан не до конца. Им занимается
   * applyPendingStocks(), которая дожимает попытки фоном.
   *
   * Операция необязательная: не прошла — товар всё равно создан, и ронять
   * из-за неё разбор ответа Ozon нельзя. Поэтому неудача идёт в лог, а не в
   * статус варианта: иначе успешно опубликованная карточка выглядела бы
   * отклонённой.
   */
  private async activatePublished(
    _marketplaceAccountId: string,
    creds: OzonCredentials,
    published: { offerId: string; productId: number }[],
  ): Promise<void> {
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
