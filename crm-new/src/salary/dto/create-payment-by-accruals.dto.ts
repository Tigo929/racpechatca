import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class DtoCreatePaymentByAccruals {
  @IsUUID()
  executorId!: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  accrualIds!: string[];

  @IsOptional()
  @IsString()
  note?: string;
}
