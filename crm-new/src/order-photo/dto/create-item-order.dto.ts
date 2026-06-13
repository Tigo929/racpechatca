import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, MinLength } from 'class-validator';
import { EnumTypePaper } from 'src/generated/prisma/enums';

export default class DtoCreateItemOrder {
  @IsString()
  @MinLength(1)
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
