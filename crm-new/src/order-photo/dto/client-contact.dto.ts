import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true';

export class DtoClientContactQuery {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number;

  /** Имя, телефон, ник, почта или номер заказа. */
  @IsString()
  @IsOptional()
  @MaxLength(100)
  search?: string;

  /** Только те, кому можно слать акции. */
  @IsBoolean()
  @IsOptional()
  @Transform(toBool)
  promoOnly?: boolean;
}

export class DtoClientContactExport {
  /** По умолчанию — только согласившиеся; `all=true` — все. */
  @IsBoolean()
  @IsOptional()
  @Transform(toBool)
  all?: boolean;
}

export class DtoUpdateClientContact {
  @IsBoolean()
  @IsOptional()
  marketingConsent?: boolean;

  /** Где получено согласие: «написал в Telegram», «на сайте»… */
  @IsString()
  @IsOptional()
  @MaxLength(200)
  marketingConsentSource?: string;

  @IsBoolean()
  @IsOptional()
  unsubscribed?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  ownerNote?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;
}
