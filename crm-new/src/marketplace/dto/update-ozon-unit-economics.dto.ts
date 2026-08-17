import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Себестоимость и расходы продавца — общие на весь кабинет. */
export class DtoUpdateOzonUnitEconomics {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  blankCost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  printCost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  packagingCost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  otherCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  returnRatePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  advertisingPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  taxPercent?: number;

  @IsOptional()
  @IsIn(['income', 'profit'])
  taxBase?: 'income' | 'profit';

  @IsOptional()
  @IsIn(['min', 'max'])
  logisticsMode?: 'min' | 'max';

  /** null — вернуться к проценту, который отдаёт Ozon. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  commissionOverridePercent?: number | null;
}
