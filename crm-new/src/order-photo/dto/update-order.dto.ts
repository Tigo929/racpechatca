import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EnumCommunication,
  EnumDeliveryMethod,
  EnumSourceOrder,
} from 'src/generated/prisma/enums';

import { MARKETPLACE_NUMBER_MAX } from '../order-number';

export class DtoUpdateOrder {
  @IsEnum(EnumSourceOrder)
  @IsOptional()
  sourceOrder?: EnumSourceOrder;

  /**
   * Скидка клиенту в рублях. Не больше товара с дизайном: доставку и плату
   * за срочность скидка не трогает, лишнее сервер обрежет сам.
   */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  discountAmount?: number;

  @IsEnum(EnumCommunication)
  @IsOptional()
  communicationPlatform?: EnumCommunication;

  @IsString()
  @IsOptional()
  urlCommunication?: string;

  @IsEnum(EnumDeliveryMethod)
  @IsOptional()
  deliveryMethod?: EnumDeliveryMethod;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  deliveryCost?: number;

  /** Стоимость «разработка дизайна» — входит в итог и в базу премии менеджера. */
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  designDevelopmentCost?: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  isUrgent?: boolean;

  /** Плата за срочность: в чек клиента входит, в базу зарплаты — нет. */
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  urgencyFee?: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  tshirtModel?: string;

  /**
   * Номер заказа на площадке. Правится отдельно от остальных полей: его
   * узнают не всегда в момент оформления, а пустая строка означает «номера
   * нет» — заказ снова показывается внутренним номером.
   */
  @IsString()
  @IsOptional()
  @MaxLength(MARKETPLACE_NUMBER_MAX)
  marketplaceOrderNumber?: string;

  /**
   * Фактически внесённая клиентом предоплата (рублей). Записывается один раз
   * реальной суммой; остаток дальше считается как «сумма заказа − предоплата»,
   * а не как 50% от текущей суммы. См. computePrepayment.
   */
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  prepaidAmount?: number;
}
