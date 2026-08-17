import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { EnumTshirtSize } from 'src/generated/prisma/enums';

/** Одна цветовая партия принта: цвет + размеры, которые надо создать. */
export class DtoOzonColorGroup {
  @IsString()
  @MinLength(1, { message: 'Укажите цвет.' })
  colorLabel!: string;

  /** dictionary_value_id атрибута «Цвет товара» — берётся из подсказки поиска по словарю. */
  @IsInt()
  @Min(1, {
    message: 'Выберите цвет из подсказки — свободный текст Ozon не примет.',
  })
  @Type(() => Number)
  colorDictionaryValueId!: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'Отметьте хотя бы один размер.' })
  @ArrayMinSize(1)
  @IsEnum(EnumTshirtSize, { each: true })
  sizes!: EnumTshirtSize[];
}
