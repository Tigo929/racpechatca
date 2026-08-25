import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Вход массового изменения остатков.
 *
 * Здесь только форма: типы, границы, размеры массивов. Смысловые
 * проверки — доступен ли склад этому кабинету, не выключен ли он —
 * живут в сервисе: DTO про них знать неоткуда.
 */

/** Верхний предел выбора. Не лимит Ozon, а защита от запроса, который
 * невозможно осмысленно показать в подтверждении. */
const MAX_OFFERS = 5_000;
const MAX_WAREHOUSES = 100;

export class DtoBulkStockWarehouse {
  @IsInt()
  @Min(1)
  warehouseId!: number;

  @IsInt()
  @Min(0)
  quantity!: number;
}

export class DtoBulkStock {
  @IsIn(['SET', 'ADD'])
  mode!: 'SET' | 'ADD';

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_OFFERS)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  offerIds!: string[];

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_WAREHOUSES)
  @ValidateNested({ each: true })
  @Type(() => DtoBulkStockWarehouse)
  warehouses!: DtoBulkStockWarehouse[];
}
