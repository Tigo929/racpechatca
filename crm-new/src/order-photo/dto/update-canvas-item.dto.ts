import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
}
