import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class DtoSaveDraft {
  /** Продукт, по которому идёт оформление. Меняется, если менеджер переключил. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  scenarioKey?: string;

  /**
   * Только изменённые поля — на сервере они дописываются к уже собранному.
   * Проверять состав здесь нечем: набор задаёт сценарий, а не DTO. Лишние
   * ключи отбрасывает движок (pickRelevantAnswers).
   */
  @IsOptional()
  @IsObject()
  answers?: Record<string, string | number | boolean | null>;
}
