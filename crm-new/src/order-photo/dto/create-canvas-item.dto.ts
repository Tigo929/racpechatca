import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class DtoCreateCanvasItem {
  @IsString()
  @MaxLength(255)
  formatCanvas!: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  quantity!: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  clientPrice!: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  contractorPrice!: number;
}
