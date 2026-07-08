import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EnumTypePaper } from 'src/generated/prisma/enums';
import { Transform, Type } from 'class-transformer';

export default class DtoUpdateItemOrder {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.trim())
  formatPaper?: string;

  @IsEnum(EnumTypePaper)
  @IsOptional()
  typePaper?: EnumTypePaper;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  price?: number;
}
