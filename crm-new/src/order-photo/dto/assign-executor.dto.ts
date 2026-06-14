import { IsOptional, IsString, IsUUID } from 'class-validator';

export class DtoAssignExecutor {
  @IsOptional()
  @IsUUID()
  executorId?: string | null;

  @IsOptional()
  @IsString()
  note?: string;
}
