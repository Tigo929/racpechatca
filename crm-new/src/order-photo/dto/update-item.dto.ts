import { IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { EnumTypePaper } from 'src/generated/prisma/enums';
import { Type } from 'class-transformer';
export default class DtoUpdateItemOrder {
  @IsString()
  @MinLength(1)
  @IsOptional()
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