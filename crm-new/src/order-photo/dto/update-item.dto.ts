import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  EnumPartnerPayout,
  EnumTypePaper,
} from 'src/generated/prisma/enums';
import { Transform, Type } from 'class-transformer';

export default class DtoUpdateItemOrder {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.trim())
  formatPaper?: string;

  @IsEnum(EnumTypePaper)
  @IsOptional()
  typePaper?: EnumTypePaper;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isFreePrice?: boolean;

  /**
   * Печать на изделии заказчика. Признак можно и снять: тогда позиция уходит
   * из расчёта с партнёром, а снимок себестоимости плёнки обнуляется — иначе
   * в базе осталась бы цифра, которая ни на что не влияет, но сбивает с толку.
   */
  @IsBoolean()
  @IsOptional()
  printOnClientItem?: boolean;

  /**
   * Как платим партнёру за позицию: не платим, доля от маржи (печать по
   * изделию заказчика) или процент от суммы (печать термотрансферов).
   * Режим приходит с формы явно: свободной ценой заводят и кружку, и
   * баннер, и угадывать по названию, что из этого работа исполнителя,
   * нельзя — цена ошибки измеряется в рублях выплаты.
   */
  @IsOptional()
  @IsEnum(EnumPartnerPayout)
  partnerPayout?: EnumPartnerPayout;

  /**
   * Своя ставка для этой позиции в сотых процента (3000 = 30%).
   * Не передана — сервер берёт значение из настроек и фиксирует его
   * снимком, чтобы правка настроек не двигала уже оформленный заказ.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  partnerRateBasisPoints?: number;
}
