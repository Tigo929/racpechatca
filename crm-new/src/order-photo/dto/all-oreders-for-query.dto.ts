import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator';
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
  // Фильтр по отметке отзыва: true/false (строкой из query).
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  reviewLeft?: boolean;
}
