import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EnumTypePaper } from 'src/generated/prisma/enums';

export default class DtoCreateItemOrder {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim())
  formatPaper!: string;

  @IsEnum(EnumTypePaper)
  typePaper!: EnumTypePaper;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  quantity!: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  price!: number;

  // Позиция со свободной (договорной) ценой: pricePosition = price, кол-во не умножается.
  @IsOptional()
  @IsBoolean()
  isFreePrice?: boolean;
}
