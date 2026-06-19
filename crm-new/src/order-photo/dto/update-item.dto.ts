import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
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

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  price?: number;
}
