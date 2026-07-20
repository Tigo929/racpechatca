import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DtoCreateTask {
  @IsString()
  @MinLength(3, { message: 'Тема задачи слишком короткая.' })
  @MaxLength(200, { message: 'Тема задачи не длиннее 200 символов.' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsUUID()
  assigneeId!: string;

  /// Срок необязателен. Без него задача не попадает в дайджест.
  @IsOptional()
  @IsDateString({}, { message: 'Некорректная дата дедлайна.' })
  deadline?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
