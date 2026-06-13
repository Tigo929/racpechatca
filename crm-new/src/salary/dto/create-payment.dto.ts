import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DtoCreatePayment {
  @IsUUID()
  executorId!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
