import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  EnumCommunication,
  EnumDeliveryMethod,
  EnumProductCategory,
  EnumSourceOrder,
} from 'src/generated/prisma/enums';
import DtoCreateItemOrder from './create-item-order.dto';
import { DtoCreateTshirtItem } from './create-tshirt-item.dto';

export default class DtoCreateOrder {
  @IsEnum(EnumSourceOrder)
  sourceOrder!: EnumSourceOrder;

  @IsEnum(EnumCommunication)
  communicationPlatform!: EnumCommunication;

  @IsString()
  @ValidateIf(
    (o: DtoCreateOrder) =>
      o.communicationPlatform === EnumCommunication.TELEGRAM,
  )
  @Matches(/^@/, {
    message: 'Для Telegram укажите @username (должно начинаться с @)',
  })
  urlCommunication!: string;

  @IsEnum(EnumDeliveryMethod)
  deliveryMethod!: EnumDeliveryMethod;

  @IsNumber()
  @Type(() => Number)
  deliveryCost!: number;

  @IsOptional()
  @IsEnum(EnumProductCategory)
  productCategory?: EnumProductCategory;

  @IsOptional()
  status?: any; // EnumStatus — cast to any until LEAD lands in local generated client

  @IsString()
  @IsOptional()
  note?: string;

  @IsOptional()
  @IsArray()
  @Type(() => DtoCreateItemOrder)
  @ValidateNested({ each: true })
  items?: DtoCreateItemOrder[];

  @IsOptional()
  @IsArray()
  @Type(() => DtoCreateTshirtItem)
  @ValidateNested({ each: true })
  tshirtItems?: DtoCreateTshirtItem[];
}
