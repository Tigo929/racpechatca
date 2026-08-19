import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { VariantDimensions } from './ozon/ozon-attributes';

/**
 * Константы карточки «Футболка», общие на весь кабинет: категория, бренд,
 * материал, состав и т.п. — то, что в живых карточках продавца не меняется
 * от принта к принту (см. docs/ozon-integration.md, «Что показал живой
 * кабинет»). Задаются один раз в настройках, а не на каждом товаре.
 */

/** Габариты по размеру, которыми предзаполняем новый кабинет — снятые с
 * реальных карточек продавца (5 строк из присланного экспорта Ozon,
 * XS/XXXL — интерполяция по соседним размерам). Каждое значение правится
 * в настройках шаблона. */
const DEFAULT_SIZE_DIMENSIONS: Record<string, VariantDimensions> = {
  XS: { weightG: 145, widthMm: 240, heightMm: 40, lengthMm: 255 },
  S: { weightG: 149, widthMm: 248, heightMm: 43, lengthMm: 261 },
  M: { weightG: 157, widthMm: 259, heightMm: 27, lengthMm: 274 },
  L: { weightG: 174, widthMm: 265, heightMm: 22, lengthMm: 268 },
  XL: { weightG: 162, widthMm: 283, heightMm: 21, lengthMm: 292 },
  XXL: { weightG: 199, widthMm: 268, heightMm: 26, lengthMm: 277 },
  XXXL: { weightG: 210, widthMm: 275, heightMm: 28, lengthMm: 285 },
};

export interface UpdateOzonCatalogTemplateInput {
  vatRate?: string;
  needsMarkingCode?: boolean;
  brandLabel?: string;
  brandDictionaryValueId?: number;
  countryLabel?: string | null;
  countryDictionaryValueId?: number | null;
  materialLabel?: string | null;
  materialDictionaryValueId?: number | null;
  materialComposition?: string | null;
  styleLabel?: string | null;
  styleDictionaryValueId?: number | null;
  seasonLabel?: string | null;
  seasonDictionaryValueId?: number | null;
  careInstructions?: string | null;
  sleeveLabel?: string | null;
  sleeveDictionaryValueId?: number | null;
  necklineLabel?: string | null;
  necklineDictionaryValueId?: number | null;
  packageTypeLabel?: string | null;
  packageTypeDictionaryValueId?: number | null;
  tnvedLabel?: string | null;
  tnvedDictionaryValueId?: number | null;
  sizeDimensions?: Record<string, VariantDimensions>;
  sharedPhotoUrls?: string[];
  defaultPrice?: number;
  defaultStock?: number;
  defaultOldPrice?: number;
}

@Injectable()
export class OzonCatalogTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /** Шаблон создаётся лениво при первом обращении — с рабочими дефолтами, не пустой формой. */
  async getOrCreate(marketplaceAccountId: string) {
    const existing = await this.prisma.ozonCatalogTemplate.findUnique({
      where: { marketplaceAccountId },
    });
    if (existing) return existing;
    return this.prisma.ozonCatalogTemplate.create({
      data: {
        marketplaceAccountId,
        sizeDimensions:
          DEFAULT_SIZE_DIMENSIONS as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(
    marketplaceAccountId: string,
    dto: UpdateOzonCatalogTemplateInput,
  ) {
    await this.getOrCreate(marketplaceAccountId);
    return this.prisma.ozonCatalogTemplate.update({
      where: { marketplaceAccountId },
      data: {
        ...dto,
        sizeDimensions: dto.sizeDimensions
          ? (dto.sizeDimensions as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }
}
