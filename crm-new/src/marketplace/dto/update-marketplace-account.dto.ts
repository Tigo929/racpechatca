import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DtoUpdateMarketplaceAccount {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  externalId?: string;

  /**
   * Новый ключ. Форма не показывает старый и не присылает его обратно —
   * пустое поле означает «ключ оставить как есть».
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
