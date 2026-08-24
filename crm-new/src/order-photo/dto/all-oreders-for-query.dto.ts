import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
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

  /**
   * Отбор по исполнителю: идентификатор сотрудника либо `none` — «никому не
   * назначен». Второе значение не прихоть: заказ без исполнителя не виден
   * ни в чьей загрузке, и именно такие теряются.
   *
   * На роль EXECUTOR параметр не влияет: сервис всё равно принудительно
   * оставляет ему только свои заказы, иначе чужую загрузку можно было бы
   * посмотреть подбором адреса.
   */
  @IsOptional()
  @Matches(
    /^(none|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,
    { message: 'executorId: ожидается идентификатор сотрудника или none' },
  )
  executorId?: string;
}
