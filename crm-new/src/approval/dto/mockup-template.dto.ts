import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { EnumApprovalSide } from 'src/generated/prisma/enums';

export class DtoCreateMockupTemplate {
  /** Ключ шаблона: латиница, цифры и подчёркивания — он попадает в ссылки и логи. */
  @Matches(/^[a-z0-9_]{3,64}$/, {
    message: 'Ключ шаблона: латиница в нижнем регистре, цифры и подчёркивания',
  })
  key!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(1)
  color!: string;

  @IsEnum(EnumApprovalSide)
  side!: EnumApprovalSide;

  @IsOptional()
  @IsString()
  garmentType?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;
}

/**
 * Калибровка шаблона. Зона печати задаётся в пикселях загруженной фотографии,
 * её реальный размер — в миллиметрах. Одно без другого бессмысленно: именно
 * эта пара превращает «28 × 35 см» из подписи в размер на картинке.
 */
export class DtoUpdateMockupTemplate {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  color?: string;

  @IsOptional()
  @IsEnum(EnumApprovalSide)
  side?: EnumApprovalSide;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  printAreaX?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  printAreaY?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  printAreaWidth?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  printAreaHeight?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  printAreaWidthMm?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  printAreaHeightMm?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;
}
