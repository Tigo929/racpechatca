import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  /*
   * Процент партнёра от суммы позиции, когда себестоимость не вычитается —
   * печать термотрансферов. Отдельное число, а не общая ставка: база у них
   * разная (сумма против маржи), и одинаковые сегодня 30 % когда-нибудь
   * разойдутся. Значение по умолчанию для новых позиций: в оформленных
   * лежит снимок, и правка настройки их не двигает.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  transferRateBasisPoints?: number;

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

  /*
   * Условия, которых больше нет: долг производству равен оптовой цене
   * прайса, скидка из розницы не вычитается и выбирать систему не из чего
   * (см. canvas/canvas-production-price.ts).
   *
   * Поля оставлены принимаемыми, но не сохраняются. Глобальная валидация
   * отвечает 400 на неизвестное поле, и настройки, открытые в соседней
   * вкладке до выкладки, присылают их при каждом сохранении: отказывать
   * человеку в сохранении настроек из-за двух мёртвых полей хуже, чем
   * молча их выбросить.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  canvasDiscountBasisPoints?: number;

  @IsOptional()
  @IsIn(['RETAIL', 'WHOLESALE'])
  canvasPriceMode?: 'RETAIL' | 'WHOLESALE';

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
