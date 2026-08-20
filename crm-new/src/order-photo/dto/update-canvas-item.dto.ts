import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class DtoUpdateCanvasItem {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  formatCanvas?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  clientPrice?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  contractorPrice?: number;

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
}
