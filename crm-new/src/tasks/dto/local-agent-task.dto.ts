import { IsEnum, IsString, MaxLength } from 'class-validator';
import { EnumTaskAssigneeKind } from 'src/generated/prisma/enums';

export class DtoLocalAgentTaskQuery {
  @IsEnum(EnumTaskAssigneeKind)
  assigneeKind!: EnumTaskAssigneeKind;
}

export class DtoLocalAgentTaskAction {
  @IsEnum(EnumTaskAssigneeKind)
  assigneeKind!: EnumTaskAssigneeKind;
}

export class DtoLocalAgentTaskReport extends DtoLocalAgentTaskAction {
  @IsString()
  @MaxLength(4000)
  summary!: string;
}
