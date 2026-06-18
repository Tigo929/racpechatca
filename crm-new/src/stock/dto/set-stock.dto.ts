import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, Min } from 'class-validator';
import { EnumTshirtSize } from 'src/generated/prisma/enums';

export class DtoSetStock {
  @IsEnum(EnumTshirtSize)
  size!: EnumTshirtSize;

  @IsString()
  color!: string;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  quantity!: number;
}
