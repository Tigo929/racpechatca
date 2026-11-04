import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DtoSetClientTelegram {
  /**
   * Ник или ссылка на Telegram покупателя. Пусто — убрать запись.
   *
   * Разбор и проверку делает сервис (client-telegram.ts): отказ должен
   * объяснять, что именно не подошло, а «value must be a string» этого
   * не объясняет.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  value?: string;
}
