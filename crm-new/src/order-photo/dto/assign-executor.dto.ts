import { IsOptional, IsString, IsUUID } from 'class-validator';

export class DtoAssignExecutor {
  @IsUUID()
  executorId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
