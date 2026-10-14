import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DtoUpdateUser {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  @Type(() => Number)
  rateBasisPoints?: number;

  /** Ставка премии за разработку дизайна (сотые процента). Для менеджера. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  @Type(() => Number)
  designRateBasisPoints?: number;

  @IsOptional()
  @IsString()
  telegramUsername?: string | null;

  /**
   * id темы (форум-топика) исполнителя в рабочей группе Telegram. При
   * назначении заказа бот пишет задачу в эту тему. null — очистить.
   */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  telegramTopicId?: number | null;

  /**
   * Личка исполнителя: числовой идентификатор его переписки с ботом.
   * Задачи и напоминания уходят туда — личное сообщение видно сразу,
   * его не нужно искать в общем потоке. null — очистить.
   *
   * Строкой: идентификаторы Telegram уже не помещаются в 32 бита.
   * Узнаётся командой /id в переписке с ботом.
   */
  @IsOptional()
  @IsString()
  telegramChatId?: string | null;
}
