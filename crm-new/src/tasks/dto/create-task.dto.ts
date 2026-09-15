import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnumTaskAssigneeKind } from 'src/generated/prisma/enums';

export class DtoCreateTask {
  @IsString()
  @MinLength(3, { message: 'Тема задачи слишком короткая.' })
  @MaxLength(200, { message: 'Тема задачи не длиннее 200 символов.' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(EnumTaskAssigneeKind)
  assigneeKind?: EnumTaskAssigneeKind;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  /// Срок необязателен. Без него задача не попадает в дайджест.
  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата дедлайна.' })
  deadline?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  /** Сколько стоит выполнение задачи. 0 — без оплаты. */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  rewardAmount?: number;

  /** Короткий результат локального агента: что сделано и где смотреть. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  agentSummary?: string;
}
