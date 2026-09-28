import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EnumPrintLocation, EnumTshirtSize } from 'src/generated/prisma/enums';

export class DtoCreateTshirtItem {
  @IsString()
  color!: string;

  @IsEnum(EnumTshirtSize)
  size!: EnumTshirtSize;

  @IsEnum(EnumPrintLocation)
  printLocation!: EnumPrintLocation;

  /**
   * Артикул площадки у позиции: «JDM-1-1-black-S». Ставится только при
   * заведении заказа из кабинета Ozon — из него выведены цвет и размер,
   * и он же печатается на листе макета.
   */
  @IsOptional()
  @IsString()
  marketplaceArticle?: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  quantity!: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  price!: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  designCost?: number;

  /** Себестоимость печати позиции. Если не задано — берём из настроек. */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  thermalCost?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  blankCost?: number;

  @IsOptional()
  @IsString()
  designUrl?: string;

  @IsOptional()
  @IsString()
  designNote?: string;

  @IsOptional()
  @IsBoolean()
  clientItem?: boolean;
}
