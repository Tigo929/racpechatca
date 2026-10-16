import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Вопрос агенту.
 *
 * Разговор хранится на шлюзе, поэтому сюда приходит только его номер —
 * иначе историю (а в ней ответы инструментов на десятки тысяч знаков)
 * пришлось бы гонять через браузер при каждом вопросе.
 */
export class DtoAskAi {
  @IsString({ message: 'Напишите вопрос.' })
  @Length(2, 4000, { message: 'Вопрос должен быть от 2 до 4000 знаков.' })
  question: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  session?: string;
}
