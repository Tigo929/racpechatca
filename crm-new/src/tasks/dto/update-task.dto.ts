import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { EnumTaskStatus } from 'src/generated/prisma/enums';
import { DtoCreateTask } from './create-task.dto';

export class DtoUpdateTask extends PartialType(DtoCreateTask) {
  @IsOptional()
  @IsEnum(EnumTaskStatus)
  status?: EnumTaskStatus;
}

export class DtoUpdateTaskStatus {
  @IsEnum(EnumTaskStatus)
  status!: EnumTaskStatus;
}
