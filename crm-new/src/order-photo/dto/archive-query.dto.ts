import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
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
} from 'src/generated/prisma/enums';

/** Отбор по корзине удалённых заказов. */
export class DtoArchiveQuery {
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

  @IsEnum(EnumSourceOrder)
  @IsOptional()
  sourceOrder?: EnumSourceOrder;

  @IsEnum(EnumProductCategory)
  @IsOptional()
  productCategory?: EnumProductCategory;

  /** Поиск по номеру заказа, причине и автору удаления. */
  @IsString()
  @IsOptional()
  @MaxLength(100)
  search?: string;

  /**
   * Показывать и разобранное: восстановленное и просроченное.
   *
   * По умолчанию выключено — корзина это то, что ещё можно вернуть.
   * История же нужна отдельно: по ней смотрят, почему заявки не доходят
   * до заказа, и там важны как раз просроченные записи.
   *
   * Строкой из запроса, но в boolean: `?includeHandled=true`.
   */
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  includeHandled?: boolean;
}
