import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Правка текстов карточки. Меняем только то, что прислали: остальное
 * сервис возьмёт из текущей карточки и вернёт обратно без изменений.
 */
export class DtoOzonUpdateCardText {
  @IsString()
  @MinLength(1)
  offerId!: string;

  /** Название — главное поле для поиска Ozon, лимит площадки 500 символов. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  description?: string;
}
