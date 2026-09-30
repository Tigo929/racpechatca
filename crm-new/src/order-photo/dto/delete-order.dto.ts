import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Почему заявку удаляют.
 *
 * Причина обязательна: удаление без объяснения и есть та потеря данных,
 * ради которой всё это заводится. Пока это свободный текст — когда
 * наберётся достаточно записей, самые частые станут готовыми вариантами.
 */
export class DtoDeleteOrder {
  @IsString()
  @MinLength(3, { message: 'Причина слишком короткая — напишите словами.' })
  @MaxLength(500)
  reason!: string;
}
