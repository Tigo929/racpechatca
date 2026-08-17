import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Правка констант шаблона категории «Футболка». `*DictionaryValueId` — то,
 * что реально уходит в Ozon; `*Label` — подпись рядом для человека, обычно
 * приходят парой из подсказки поиска по словарю (см. attribute-search).
 */
export class DtoUpdateOzonCatalogTemplate {
  @IsOptional()
  @IsString()
  vatRate?: string;

  @IsOptional()
  @IsBoolean()
  needsMarkingCode?: boolean;

  @IsOptional()
  @IsString()
  brandLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  brandDictionaryValueId?: number;

  @IsOptional()
  @IsString()
  countryLabel?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  countryDictionaryValueId?: number;

  @IsOptional()
  @IsString()
  materialLabel?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  materialDictionaryValueId?: number;

  @IsOptional()
  @IsString()
  materialComposition?: string;

  @IsOptional()
  @IsString()
  styleLabel?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  styleDictionaryValueId?: number;

  @IsOptional()
  @IsString()
  seasonLabel?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  seasonDictionaryValueId?: number;

  @IsOptional()
  @IsString()
  careInstructions?: string;

  @IsOptional()
  @IsString()
  sleeveLabel?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sleeveDictionaryValueId?: number;

  @IsOptional()
  @IsString()
  necklineLabel?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  necklineDictionaryValueId?: number;

  @IsOptional()
  @IsString()
  packageTypeLabel?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  packageTypeDictionaryValueId?: number;

  @IsOptional()
  @IsString()
  tnvedLabel?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  tnvedDictionaryValueId?: number;

  /** { XS: { weightG, widthMm, heightMm, lengthMm }, ... } — ключи произвольные, глубоко не валидируем. */
  @IsOptional()
  @IsObject()
  sizeDimensions?: Record<
    string,
    { weightG: number; widthMm: number; heightMm: number; lengthMm: number }
  >;
}
