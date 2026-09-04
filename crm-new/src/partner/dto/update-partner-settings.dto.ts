import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class DtoUpdatePartnerSettings {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  thermalTransferCost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  blankTshirtCost?: number;

  // Ставка партнёра в сотых процента: 3000 = 30%. Ограничиваем 0–100%.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  partnerRateBasisPoints?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  partnerName?: string;

  /** Кто печатает холсты — показываем в отчёте. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  canvasContractorName?: string;

  /** Шаблон ссылки на переписку в MAX: {phone} / {phone_plus}. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  maxLinkTemplate?: string;

  /**
   * Скидка производства на холст в сотых процента: 2000 = 20%. Договорная,
   * поэтому в настройках: прайс приходит файлом и лежит в коде, а условия
   * меняются переговорами — скоро придут оптовые цены.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  canvasDiscountBasisPoints?: number;

  /** Своя доставка производства по Москве: сколько платим мы. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  canvasDeliveryCost?: number;

  /** Сколько за неё называем клиенту. Разница — заработок, а не транзит. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  canvasDeliveryPrice?: number;

  /** Цена доставки Яндекс ПВЗ для клиента (по умолчанию 300). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  deliveryPriceYandexPvz?: number;

  /**
   * Кого всегда упоминать в общем чате при заявке с сайта — через запятую.
   * Дежурный менеджер тегается сам; это список сверх него, чтобы владелец
   * видел заявки лично, не занимая роль менеджера по оформлению.
   */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  leadMentionUsernames?: string;
}
