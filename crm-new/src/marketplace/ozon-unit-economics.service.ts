import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MarketplaceAccountService } from './marketplace-account.service';
import {
  OzonProductCatalogService,
  type OzonProductTariffs,
} from './ozon/ozon-product-catalog.service';
import {
  calculateUnitEconomics,
  type UnitEconomicsResult,
  type UnitEconomicsSettings,
} from './ozon/ozon-unit-economics';

/**
 * Юнит-экономика по каждому товару кабинета.
 *
 * Себестоимость лежит у нас (её задаёт продавец), тарифы площадки читаются
 * из Ozon при каждом запросе: комиссия и логистика меняются на его стороне,
 * и хранить их копию значило бы считать деньги по устаревшим цифрам.
 */

export interface UpdateUnitEconomicsInput {
  blankCost?: number;
  printCost?: number;
  packagingCost?: number;
  otherCost?: number;
  returnRatePercent?: number;
  advertisingPercent?: number;
  taxPercent?: number;
  taxBase?: 'income' | 'profit';
  logisticsMode?: 'min' | 'max';
  /** null — вернуться к проценту, который отдаёт Ozon. */
  commissionOverridePercent?: number | null;
}

/** Настройки в виде, удобном интерфейсу: проценты, а не сотые доли. */
export interface UnitEconomicsSettingsView {
  blankCost: number;
  printCost: number;
  packagingCost: number;
  otherCost: number;
  returnRatePercent: number;
  advertisingPercent: number;
  taxPercent: number;
  taxBase: 'income' | 'profit';
  logisticsMode: 'min' | 'max';
  commissionOverridePercent: number | null;
}

export interface ProductEconomicsView {
  offerId: string;
  tariffs: OzonProductTariffs | null;
  economics: UnitEconomicsResult | null;
}

const bpToPercent = (bp: number) => bp / 100;
const percentToBp = (p: number) => Math.round(p * 100);

@Injectable()
export class OzonUnitEconomicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: MarketplaceAccountService,
    private readonly catalog: OzonProductCatalogService,
  ) {}

  async getSettings(accountId: string): Promise<UnitEconomicsSettingsView> {
    const row =
      (await this.prisma.ozonUnitEconomics.findUnique({
        where: { marketplaceAccountId: accountId },
      })) ??
      (await this.prisma.ozonUnitEconomics.create({
        data: { marketplaceAccountId: accountId },
      }));

    return {
      blankCost: row.blankCost,
      printCost: row.printCost,
      packagingCost: row.packagingCost,
      otherCost: row.otherCost,
      returnRatePercent: bpToPercent(row.returnRateBasisPoints),
      advertisingPercent: bpToPercent(row.advertisingBasisPoints),
      taxPercent: bpToPercent(row.taxBasisPoints),
      taxBase: row.taxBase === 'profit' ? 'profit' : 'income',
      logisticsMode: row.logisticsMode === 'min' ? 'min' : 'max',
      commissionOverridePercent:
        row.commissionOverrideBasisPoints === null
          ? null
          : bpToPercent(row.commissionOverrideBasisPoints),
    };
  }

  async updateSettings(
    accountId: string,
    dto: UpdateUnitEconomicsInput,
  ): Promise<UnitEconomicsSettingsView> {
    await this.getSettings(accountId);
    await this.prisma.ozonUnitEconomics.update({
      where: { marketplaceAccountId: accountId },
      data: {
        blankCost: dto.blankCost,
        printCost: dto.printCost,
        packagingCost: dto.packagingCost,
        otherCost: dto.otherCost,
        returnRateBasisPoints:
          dto.returnRatePercent !== undefined
            ? percentToBp(dto.returnRatePercent)
            : undefined,
        advertisingBasisPoints:
          dto.advertisingPercent !== undefined
            ? percentToBp(dto.advertisingPercent)
            : undefined,
        taxBasisPoints:
          dto.taxPercent !== undefined
            ? percentToBp(dto.taxPercent)
            : undefined,
        taxBase: dto.taxBase,
        logisticsMode: dto.logisticsMode,
        commissionOverrideBasisPoints:
          dto.commissionOverridePercent === undefined
            ? undefined
            : dto.commissionOverridePercent === null
              ? null
              : percentToBp(dto.commissionOverridePercent),
      },
    });
    return this.getSettings(accountId);
  }

  /**
   * Экономика по всем товарам кабинета: цена берётся из каталога, тарифы —
   * из Ozon, себестоимость — из настроек.
   */
  async forAccount(accountId: string): Promise<ProductEconomicsView[]> {
    const creds = await this.accounts.credentials(accountId);
    const [settings, products, tariffs] = await Promise.all([
      this.getSettings(accountId),
      this.catalog.listProducts(creds),
      this.catalog.tariffsByOfferId(creds),
    ]);

    return products.map((p) => {
      const t = tariffs.get(p.offerId) ?? null;
      if (!t) return { offerId: p.offerId, tariffs: null, economics: null };
      return {
        offerId: p.offerId,
        tariffs: t,
        economics: calculateUnitEconomics(
          p.price,
          this.toTariffs(t, settings),
          this.toCalcSettings(settings),
        ),
      };
    });
  }

  /** Пересчёт «что если»: та же математика, но с произвольной ценой. */
  async preview(
    accountId: string,
    offerId: string,
    price: number,
  ): Promise<ProductEconomicsView> {
    const creds = await this.accounts.credentials(accountId);
    const [settings, tariffs] = await Promise.all([
      this.getSettings(accountId),
      this.catalog.tariffsByOfferId(creds),
    ]);
    const t = tariffs.get(offerId) ?? null;
    if (!t) return { offerId, tariffs: null, economics: null };

    return {
      offerId,
      tariffs: t,
      economics: calculateUnitEconomics(
        price,
        this.toTariffs(t, settings),
        this.toCalcSettings(settings),
      ),
    };
  }

  private toTariffs(t: OzonProductTariffs, s: UnitEconomicsSettingsView) {
    const useMax = s.logisticsMode === 'max';
    return {
      commissionPercent: s.commissionOverridePercent ?? t.commissionPercent,
      acquiring: t.acquiring,
      firstMile: useMax ? t.firstMileMax : t.firstMileMin,
      directFlow: useMax ? t.directFlowMax : t.directFlowMin,
      lastMile: t.lastMile,
      returnFlow: t.returnFlow,
    };
  }

  private toCalcSettings(s: UnitEconomicsSettingsView): UnitEconomicsSettings {
    return {
      blankCost: s.blankCost,
      printCost: s.printCost,
      packagingCost: s.packagingCost,
      otherCost: s.otherCost,
      returnRatePercent: s.returnRatePercent,
      advertisingPercent: s.advertisingPercent,
      taxPercent: s.taxPercent,
      taxBase: s.taxBase,
    };
  }
}
