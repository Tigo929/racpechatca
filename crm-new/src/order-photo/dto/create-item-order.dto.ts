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
  MinLength,
} from 'class-validator';
import {
  EnumPartnerPayout,
  EnumTypePaper,
} from 'src/generated/prisma/enums';

export default class DtoCreateItemOrder {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim())
  formatPaper!: string;

  @IsEnum(EnumTypePaper)
  typePaper!: EnumTypePaper;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  quantity!: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  price!: number;

  // Позиция со свободной (договорной) ценой: pricePosition = price, кол-во не умножается.
  @IsOptional()
  @IsBoolean()
  isFreePrice?: boolean;

  /**
   * Печать на изделии, которое принёс клиент.
   *
   * Признак приходит с формы явно, а не выводится из названия позиции:
   * свободной ценой заводят и кружку, и баннер, а тянуть их в расчёт
   * с партнёром нельзя. Себестоимость термопереноса ставит сервер —
   * из настроек, а не из тела запроса.
   */
  @IsOptional()
  @IsBoolean()
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
