import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class DtoOzonPriceItem {
  @IsString()
  offerId!: string;

  @IsInt()
  @Min(1, { message: 'Цена должна быть больше нуля.' })
  @Type(() => Number)
  price!: number;

  /** Зачёркнутая цена. Ozon примет её только если она выше актуальной. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  oldPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;
}

export class DtoOzonUpdatePrices {
  @IsArray()
  @ArrayNotEmpty({ message: 'Не выбрано ни одного товара.' })
  @Type(() => DtoOzonPriceItem)
  @ValidateNested({ each: true })
  items!: DtoOzonPriceItem[];
}

export class DtoOzonStockItem {
  @IsString()
  offerId!: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock!: number;
}

export class DtoOzonUpdateStocks {
  @IsInt()
  @Type(() => Number)
  warehouseId!: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'Не выбрано ни одного товара.' })
  @Type(() => DtoOzonStockItem)
  @ValidateNested({ each: true })
  items!: DtoOzonStockItem[];
}

export class DtoOzonArchive {
  @IsArray()
  @ArrayNotEmpty({ message: 'Не выбрано ни одного товара.' })
  @IsInt({ each: true })
  @Type(() => Number)
  productIds!: number[];

  @IsBoolean()
  archived!: boolean;
}
