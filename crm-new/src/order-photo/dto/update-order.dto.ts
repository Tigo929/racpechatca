import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import {
  EnumCommunication,
  EnumDeliveryMethod,
  EnumSourceOrder,
  EnumStatus,
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
  @ValidateIf((o) => o.communicationPlatform === EnumCommunication.TELEGRAM && o.urlCommunication !== undefined)
  @Matches(/^@/, { message: 'Для Telegram укажите @username (должно начинаться с @)' })
  urlCommunication?: string;

  @IsEnum(EnumDeliveryMethod)
  @IsOptional()
  deliveryMethod?: EnumDeliveryMethod;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  deliveryCost?: number;
  
  @IsString()
  @IsOptional()
  note?: string;

  @IsEnum(EnumStatus)
  @IsOptional()
  status?: EnumStatus;

  @IsBoolean()
  @IsOptional()
  isUrgent?: boolean;
}
