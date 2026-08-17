import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';
import { EnumTshirtGender } from 'src/generated/prisma/enums';

/** Правка принта-черновика — то же, что при создании, но всё необязательно. */
export class DtoUpdateOzonPrint {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  hashtags?: string;

  @IsOptional()
  @IsUrl(
    {},
    {
      message:
        'Ссылка на главное фото должна быть прямой ссылкой на изображение.',
    },
  )
  mainPhotoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(14)
  extraPhotoUrls?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  price?: number;

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
}
