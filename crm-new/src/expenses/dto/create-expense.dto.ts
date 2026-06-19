import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EnumExpenseCategory } from 'src/generated/prisma/enums';

export class DtoCreateExpense {
  @IsEnum(EnumExpenseCategory)
  category!: EnumExpenseCategory;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
