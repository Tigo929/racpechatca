import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
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

  @IsInt()
  @Type(() => Number)
  @Min(0)
  deliveryCost!: number;

  /**
   * Свободная (договорная) цена заказа. Если задана — итог берётся отсюда,
   * а не считается из позиций (позиции при этом можно не передавать).
   */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  customTotal?: number;

  /** Заказ со свободной (договорной) ценой: количество не умножается на цену. */
  @IsOptional()
  @IsBoolean()
  freePrice?: boolean;

  /**
   * Стоимость «разработка дизайна» (свободная цена, без количества). Входит в
   * итог заказа и служит базой премии менеджера по оформлению.
   */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  designDevelopmentCost?: number;

  @IsOptional()
  @IsEnum(EnumProductCategory)
  productCategory?: EnumProductCategory;

  @IsOptional()
  @IsIn([EnumStatus.LEAD, EnumStatus.NEW], {
    message: 'Начальный статус заказа может быть только LEAD или NEW',
  })
  status?: EnumStatus;

  @IsString()
  @IsOptional()
  note?: string;

  /** Модель футболки — производственные данные, передаются исполнителю-партнёру. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tshirtModel?: string;

  @IsOptional()
  @IsUUID()
  executorId?: string | null;

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
