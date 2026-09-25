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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EnumCommunication,
  EnumDeliveryMethod,
  EnumProductCategory,
  EnumSourceOrder,
  EnumStatus,
} from 'src/generated/prisma/enums';
import { MARKETPLACE_NUMBER_MAX } from '../order-number';
import DtoCreateItemOrder from './create-item-order.dto';
import { DtoCreateCanvasItem } from './create-canvas-item.dto';
import { DtoCreateTshirtItem } from './create-tshirt-item.dto';

export default class DtoCreateOrder {
  /**
   * Происхождение заказа. Не указан — сервер ставит текущий основной канал
   * (`MANUAL_DEFAULT_ORIGIN`), чтобы сотруднику не приходилось каждый раз
   * выбирать одно и то же. Значение вне перечисления — 400, а не «прочее».
   */
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
  communicationPlatform!: EnumCommunication;

  @IsString()
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

  /**
   * Фактическая дата оплаты (работа D1). Имеет смысл только у заказа,
   * заводимого уже оплаченным; сейчас начальный статус ограничен LEAD/NEW,
   * поэтому поле остаётся заделом на будущее и без оплаченного статуса
   * отклоняется — придумывать дату система не должна.
   */
  @IsOptional()
  @IsString()
  clientPaidAt?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsBoolean()
  @IsOptional()
  isUrgent?: boolean;

  /**
   * Заказ с маркетплейса на печать индивидуального принта (Ozon и т.п.).
   * Такой заказ ведёт производство и макет: включает статус «Разработка
   * макета», деньги считаются на площадке, а не в CRM.
   */
  @IsBoolean()
  @IsOptional()
  isMarketplacePrint?: boolean;

  /**
   * Номер заказа на самой площадке — тот, которым заказ назван в кабинете
   * Ozon. Им заказ и показывается в CRM: наш внутренний номер покупателю
   * ничего не говорит. Необязателен: заказ с площадки лучше завести без
   * номера, чем не завести вовсе; номер можно дописать правкой карточки.
   */
  @IsString()
  @IsOptional()
  @MaxLength(MARKETPLACE_NUMBER_MAX)
  marketplaceOrderNumber?: string;

  /**
   * Плата за срочность. Входит в чек клиента отдельной строкой, но НЕ входит
   * в базу зарплаты — ни исполнителю, ни менеджеру. Учитывается только у
   * срочных заказов (isUrgent).
   */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  urgencyFee?: number;

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

  @IsOptional()
  @IsArray()
  @Type(() => DtoCreateCanvasItem)
  @ValidateNested({ each: true })
  canvasItems?: DtoCreateCanvasItem[];
}
