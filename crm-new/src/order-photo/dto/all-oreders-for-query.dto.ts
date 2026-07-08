import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EnumProductCategory,
  EnumSourceOrder,
  EnumStatus,
} from 'src/generated/prisma/enums';

export default class DtoAllOrdersforQuery {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsEnum(EnumStatus)
  @IsOptional()
  status?: EnumStatus;

  @IsEnum(EnumSourceOrder)
  @IsOptional()
  sourceOrder?: EnumSourceOrder;

  @IsEnum(EnumProductCategory)
  @IsOptional()
  productCategory?: EnumProductCategory;

  // Фильтр по отметке отзыва. Строкой ('true'/'false'), чтобы implicit-conversion
  // не превратил 'false' в boolean true. Сравниваем явно в сервисе.
  @IsIn(['true', 'false'])
  @IsOptional()
  reviewLeft?: 'true' | 'false';

  // Полнотекстовый поиск по номеру заказа и контакту клиента.
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim())
  search?: string;
}
