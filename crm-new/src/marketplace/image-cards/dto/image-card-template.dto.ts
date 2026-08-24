import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Прямоугольник в пикселях шаблона. */
export class DtoRect {
  @IsInt() @Type(() => Number) @Min(0) x!: number;
  @IsInt() @Type(() => Number) @Min(0) y!: number;
  @IsInt() @Type(() => Number) @Min(1) width!: number;
  @IsInt() @Type(() => Number) @Min(1) height!: number;
}

export class DtoCreateImageCardTemplate {
  @IsString()
  @MinLength(2)
  title!: string;

  /** Ключ цвета изделия: black, white. */
  @IsString()
  @MinLength(1)
  shirtColor!: string;
}

export class DtoUpdateImageCardTemplate {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  shirtColor?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DtoRect)
  placementArea?: DtoRect;

  /**
   * Необязательная безопасная рамка. Явный null убирает её —
   * поэтому тип допускает null, а не только отсутствие поля.
   */
  @IsOptional()
  @IsObject()
  safeArea?: DtoRect | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
