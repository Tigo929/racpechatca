import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, MaxLength, MinLength } from 'class-validator';
import { EnumTypePaper } from 'src/generated/prisma/enums';

export default class DtoCreateItemOrder {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim())
  formatPaper!: string;

  @IsEnum(EnumTypePaper)
  typePaper!: EnumTypePaper;

  @IsNumber()
  @Type(() => Number)
  quantity!: number;

  @IsNumber()
  @Type(() => Number)
  price!: number;
}
