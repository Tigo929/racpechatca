import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { EnumTshirtGender } from 'src/generated/prisma/enums';
import { DtoOzonColorGroup } from './ozon-color-group.dto';

export class DtoCreateOzonPrint {
  /** Внутренний код принта; если не задан — строится из названия. */
  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  @MinLength(3, { message: 'Название слишком короткое.' })
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  hashtags?: string;

  @IsUrl(
    {},
    {
      message:
        'Ссылка на главное фото должна быть прямой ссылкой на изображение.',
    },
  )
  mainPhotoUrl!: string;

  @IsOptional()
  @IsArray()
  @IsUrl(
    {},
    {
      each: true,
      message:
        'Ссылки на доп. фото должны быть прямыми ссылками на изображения.',
    },
  )
  @ArrayMaxSize(14, {
    message: 'Ozon принимает не больше 14 дополнительных фото.',
  })
  extraPhotoUrls?: string[];

  @IsInt()
  @Min(1, { message: 'Цена должна быть больше нуля.' })
  @Type(() => Number)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  oldPrice?: number;

  @IsOptional()
  @IsEnum(EnumTshirtGender)
  gender?: EnumTshirtGender;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patternTags?: string[];

  /**
   * Значение поля Ozon «Объединить на одной карточке». Пусто — берём код
   * принта: обычно объединять надо ровно его цвета. Отдельное поле нужно,
   * когда карточка в кабинете уже собрана под другим значением.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  unionKey?: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Нужен хотя бы один цвет с размерами.' })
  @ArrayMinSize(1)
  @Type(() => DtoOzonColorGroup)
  @ValidateNested({ each: true })
  colorGroups!: DtoOzonColorGroup[];
}
