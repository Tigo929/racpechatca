import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DtoUpdateUser {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  @Type(() => Number)
  rateBasisPoints?: number;

  /** Ставка премии за разработку дизайна (сотые процента). Для менеджера. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  @Type(() => Number)
  designRateBasisPoints?: number;

  @IsOptional()
  @IsString()
  telegramUsername?: string | null;
}
