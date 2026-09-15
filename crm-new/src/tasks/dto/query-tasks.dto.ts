import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  EnumTaskAssigneeKind,
  EnumTaskStatus,
} from 'src/generated/prisma/enums';

export class DtoQueryTasks {
  @IsOptional()
  @IsEnum(EnumTaskStatus)
  status?: EnumTaskStatus;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsEnum(EnumTaskAssigneeKind)
  assigneeKind?: EnumTaskAssigneeKind;
}
