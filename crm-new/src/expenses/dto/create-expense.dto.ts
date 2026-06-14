import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EnumProductCategory } from 'src/generated/prisma/enums';

export class DtoCreateExpense {
  @IsEnum(EnumProductCategory)
  category!: EnumProductCategory;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
