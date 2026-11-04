import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class DtoCreateCanvasItem {
  /**
   * Подпись позиции — её ставит сервер по выбранному размеру. Поле осталось,
   * чтобы отказ объяснял причину («размер выбирается из прайса»), а не
   * ругался на лишнее поле в запросе.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  formatCanvas?: string;

  /**
   * Размер из прайса производства («20x30») — обязателен.
   *
   * По нему берутся обе цены: розничная (её платит клиент) и оптовая (её
   * платим мы). Размер, которого в прайсе нет, отбивается: с ним в заказ
   * попадала цена, вписанная руками, и заработок по позиции не с чем было
   * сверить. Проверку делает сервис — у него отказ с объяснением.
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sizeKey?: string;

  /** Материал по прайсу производства. По умолчанию синтетика. */
  @IsOptional()
  @IsIn(['SYNTHETIC', 'COTTON'])
  material?: 'SYNTHETIC' | 'COTTON';


  @IsInt()
  @Type(() => Number)
  @Min(1)
  quantity!: number;

  /*
   * Цена клиенту. Нулевая не проходит: цену ставит прайс, но прайс отдаётся
   * только администратору, и у менеджера поле осталось бы нулевым. Холст
   * за 0 ₽ потом не отличить от настоящего — в отчёте он выглядит проданным
   * в убыток на всю себестоимость. Подарок оформляется скидкой на заказ.
   */
  @IsInt()
  @Type(() => Number)
  @Min(1, {
    message:
      'Укажите цену клиенту: позиция холста за 0 ₽ в отчёте выглядит проданной в убыток.',
  })
  clientPrice!: number;

  /**
   * Цена производства за штуку. Для размера из прайса её считает сервер,
   * и присланное значение игнорируется: занизить себестоимость значит
   * уйти в минус незаметно.
   */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  contractorPrice?: number;

  /**
   * Покрытие лаком. Цены — за штуку: сколько берёт поставщик и сколько
   * назвали клиенту. Выключенный доп свои цены обнуляет.
   */
  @IsOptional()
  @IsBoolean()
  varnish?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  varnishClientPrice?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  varnishContractorPrice?: number;

  /** Багет (рама). Цены — за штуку, как у лака. */
  @IsOptional()
  @IsBoolean()
  frame?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  frameClientPrice?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  frameContractorPrice?: number;
}
