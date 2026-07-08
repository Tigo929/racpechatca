import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
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

  @IsString()
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  isUrgent?: boolean;
}
