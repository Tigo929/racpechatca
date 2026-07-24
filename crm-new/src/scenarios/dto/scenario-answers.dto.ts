import { IsObject, IsOptional } from 'class-validator';

export class DtoScenarioAnswers {
  /**
   * Ответы менеджера: ключ шага → значение. Структура свободная, потому что
   * набор полей задаёт сценарий, а не DTO. Лишние ключи не опасны — движок
   * отбрасывает всё, чего нет в сценарии (см. pickRelevantAnswers).
   */
  @IsOptional()
  @IsObject()
  answers?: Record<string, string | number | boolean | null>;
}
