import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional } from 'class-validator';
import {
  EnumProductCategory,
  EnumSourceOrder,
  EnumStatus,
} from 'src/generated/prisma/enums';

export default class DtoAllOrdersforQuery {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number;
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
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
}
