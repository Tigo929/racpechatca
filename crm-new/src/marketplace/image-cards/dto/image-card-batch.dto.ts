import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Режим генерации: только чёрная, только белая либо обе. */
export const CARD_MODES = ['BLACK', 'WHITE', 'BOTH'] as const;
export type CardMode = (typeof CARD_MODES)[number];

export class DtoCreateImageCardBatch {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsIn(CARD_MODES)
  mode?: CardMode;

  /**
   * Удалять ли белый фон у дизайна. По умолчанию включено: макеты приходят
   * с белой подложкой чаще, чем с прозрачной, и на футболке она видна
   * прямоугольником. Обратная сторона — у дизайна с белыми деталями чистка
   * съест и их, для таких галку снимают вручную.
   */
  @IsOptional()
  @IsBoolean()
  removeWhiteBackground?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPlacement?: boolean;

  /** Какими шаблонами собирать. Пусто — берутся активные по цвету. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID(undefined, { each: true })
  templateIds?: string[];
}
