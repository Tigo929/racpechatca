import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  EnumCommunication,
  EnumDeliveryMethod,
  EnumProductCategory,
  EnumSourceOrder,
  EnumStatus,
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

  /**
   * Свободная (договорная) цена заказа. Если задана — итог берётся отсюда,
   * а не считается из позиций (позиции при этом можно не передавать).
   */
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  customTotal?: number;

  @IsOptional()
  @IsEnum(EnumProductCategory)
  productCategory?: EnumProductCategory;

  @IsOptional()
  @IsEnum(EnumStatus)
  status?: EnumStatus;

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
