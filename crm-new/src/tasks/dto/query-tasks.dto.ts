import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EnumTaskStatus } from 'src/generated/prisma/enums';

export class DtoQueryTasks {
  @IsOptional()
  @IsEnum(EnumTaskStatus)
  status?: EnumTaskStatus;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
