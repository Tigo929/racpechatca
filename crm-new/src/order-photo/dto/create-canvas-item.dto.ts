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
  /** Подпись позиции. При выборе размера из прайса заполняется сервером. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  formatCanvas?: string;

  /**
   * Размер из прайса производства («20x30»). Если задан, подпись и цену
   * производства система ставит сама — руками их вводить не нужно и нельзя:
   * занизить себестоимость значит уйти в минус незаметно.
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

  @IsInt()
  @Type(() => Number)
  @Min(0)
  clientPrice!: number;

  /** Цена производства за штуку. Нужна только для нестандартного размера. */
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
