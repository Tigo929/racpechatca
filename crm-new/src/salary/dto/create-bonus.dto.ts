import { IsInt, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Ручная премия сотруднику. Описание обязательно: через месяц никто не
 * вспомнит, за что заплатили, а начисление остаётся в истории навсегда.
 */
export class DtoCreateBonus {
  @IsUUID()
  executorId!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  amount!: number;

  @IsString()
  @MinLength(3, { message: 'Опишите, за что премия (минимум 3 символа)' })
  @MaxLength(500)
  note!: string;
}
