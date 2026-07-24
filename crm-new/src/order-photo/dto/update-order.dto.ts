import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  EnumCommunication,
  EnumDeliveryMethod,
  EnumSourceOrder,
} from 'src/generated/prisma/enums';

export class DtoUpdateOrder {
  @IsEnum(EnumSourceOrder)
  @IsOptional()
  sourceOrder?: EnumSourceOrder;

  @IsEnum(EnumCommunication)
  @IsOptional()
  communicationPlatform?: EnumCommunication;

  @IsString()
  @IsOptional()
  @ValidateIf(
    (o: DtoUpdateOrder) =>
      o.communicationPlatform === EnumCommunication.TELEGRAM &&
      o.urlCommunication !== undefined,
  )
  @Matches(/^@/, {
    message: 'Для Telegram укажите @username (должно начинаться с @)',
  })
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

  @IsString()
  @IsOptional()
  @MaxLength(255)
  tshirtModel?: string;
}
